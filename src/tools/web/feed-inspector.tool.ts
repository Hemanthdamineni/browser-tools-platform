import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './feed-inspector.meta';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ISSUES = 200;
const MAX_ROWS = 200;
const CLIP = 160;

const NS = {
  atom: 'http://www.w3.org/2005/Atom',
  atom03: 'http://purl.org/atom/ns#',
  rss10: 'http://purl.org/rss/1.0/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  dc: 'http://purl.org/dc/elements/1.1/',
  itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd',
  content: 'http://purl.org/rss/1.0/modules/content/',
  media: 'http://search.yahoo.com/mrss/',
  georss: 'http://www.georss.org/georss',
  slash: 'http://purl.org/rss/1.0/modules/slash/',
} as const;

const NS_LABELS = new Map<string, string>([
  [NS.atom, 'Atom'],
  [NS.atom03, 'Atom 0.3'],
  [NS.rss10, 'RSS 1.0'],
  [NS.rdf, 'RDF'],
  [NS.dc, 'Dublin Core'],
  [NS.itunes, 'Apple Podcasts'],
  [NS.content, 'content'],
  [NS.media, 'Media RSS'],
  [NS.georss, 'GeoRSS'],
  [NS.slash, 'slash'],
]);

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const HAS_ZONE =
  /(?:Z\b|[+-]\d{4}\b|[+-]\d{2}:\d{2}\b|\b(?:UT|GMT|UTC|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b)/u;
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/iu;

type Dialect = 'rss2' | 'rss1' | 'atom';
type Level = 'error' | 'warning';

interface Issue {
  path: string;
  level: Level;
  problem: string;
  detail: string;
}

interface Enclosure {
  url: string;
  type: string;
  length: string;
}

interface ItemInfo {
  index: number;
  title: string;
  link: string;
  id: string;
  dateRaw: string;
  dateMs: number | null;
  author: string;
  hasDescription: boolean;
  enclosures: Enclosure[];
}

interface State {
  issues: Issue[];
  droppedErrors: number;
  droppedWarnings: number;
}

function report(state: State, path: string, level: Level, problem: string, detail: string): void {
  if (state.issues.length >= MAX_ISSUES) {
    if (level === 'error') state.droppedErrors += 1;
    else state.droppedWarnings += 1;
    return;
  }
  state.issues.push({ path, level, problem, detail });
}

const childrenNamed = (parent: Element, name: string): Element[] => {
  const wanted = name.toLowerCase();
  return Array.from(parent.children).filter((child) => child.localName.toLowerCase() === wanted);
};

const firstNamed = (parent: Element, name: string): Element | null =>
  childrenNamed(parent, name)[0] ?? null;

const firstNS = (parent: Element, namespace: string, name: string): Element | null => {
  const wanted = name.toLowerCase();
  return (
    Array.from(parent.children).find(
      (child) => child.namespaceURI === namespace && child.localName.toLowerCase() === wanted,
    ) ?? null
  );
};

const textOf = (element: Element | null): string =>
  element === null ? '' : (element.textContent ?? '').trim();

function clip(value: string, max = CLIP): string {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

function parseDate(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : ms;
}

function humanSize(length: string): string {
  if (!/^\d+$/u.test(length)) return length === '' ? '-' : length;
  const bytes = Number(length);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function atomLink(scope: Element, rels: string[]): string {
  for (const link of childrenNamed(scope, 'link')) {
    const rel = (link.getAttribute('rel') ?? '').trim().toLowerCase();
    if (!rels.includes(rel)) continue;
    const href = (link.getAttribute('href') ?? '').trim();
    if (href !== '') return href;
  }
  return '';
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = String(o.format ?? 'summary');
  const checkSpec = o.checkSpec !== false;

  const source = input.files[0];
  let text: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 10 MB.');
    text = await source.text();
  } else {
    text = String(input.text ?? '');
  }
  if (text.trim() === '')
    throw new ToolError('No feed was provided.', 'Paste feed XML, or drop an .xml or .rss file.');
  if (text.length > MAX_BYTES) throw new ToolError('That is more than 10 MB of feed XML.');

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, 'application/xml');
  } catch {
    throw new ToolError(
      'That is not well-formed XML.',
      'Check for unclosed tags or stray ampersands.',
    );
  }
  const root = doc.documentElement;
  if (
    root === null ||
    root.localName === 'parsererror' ||
    doc.querySelector('parsererror') !== null
  ) {
    throw new ToolError(
      'That is not well-formed feed XML.',
      'The markup could not be parsed as XML; check for unclosed tags or a missing closing element.',
    );
  }

  const rootName = root.localName.toLowerCase();
  let dialect: Dialect;
  let dialectLabel: string;
  if (rootName === 'rss') {
    dialect = 'rss2';
    const version = (root.getAttribute('version') ?? '').trim();
    dialectLabel = version === '' ? 'RSS (no version attribute)' : 'RSS ' + version;
  } else if (rootName === 'feed') {
    dialect = 'atom';
    dialectLabel = root.namespaceURI === NS.atom03 ? 'Atom 0.3 (legacy)' : 'Atom 1.0';
  } else if (rootName === 'rdf') {
    dialect = 'rss1';
    dialectLabel = 'RSS 1.0 (RDF)';
  } else {
    throw new ToolError(
      'Unrecognised feed root element <' + root.localName + '>.',
      'Expected <rss>, <feed> or <rdf:RDF>.',
    );
  }

  const state: State = { issues: [], droppedErrors: 0, droppedWarnings: 0 };
  const isAtom = dialect === 'atom';
  const itemPrefix = isAtom
    ? 'feed > entry['
    : dialect === 'rss1'
      ? 'rdf:RDF > item['
      : 'channel > item[';
  const itemLabel = (index: number): string => itemPrefix + (index + 1) + ']';

  let container: Element;
  let itemElements: Element[];
  if (dialect === 'rss2') {
    const channel = firstNamed(root, 'channel');
    if (channel === null) {
      throw new ToolError(
        'The <rss> element has no <channel>.',
        'An RSS 2.0 document must contain a channel.',
      );
    }
    container = channel;
    itemElements = childrenNamed(channel, 'item');
  } else if (dialect === 'rss1') {
    const channel = firstNamed(root, 'channel');
    if (channel === null) {
      report(
        state,
        'rdf:RDF',
        'error',
        'Missing channel',
        'An RSS 1.0 document must contain a channel element.',
      );
    }
    container = channel ?? root;
    itemElements = [
      ...childrenNamed(root, 'item'),
      ...(channel === null ? [] : childrenNamed(channel, 'item')),
    ];
  } else {
    container = root;
    itemElements = childrenNamed(root, 'entry');
  }

  if (checkSpec && dialect === 'rss2') {
    const version = (root.getAttribute('version') ?? '').trim();
    if (version === '') {
      report(
        state,
        'rss',
        'warning',
        'Missing version attribute',
        'Add version="2.0" so readers know which RSS variant this is.',
      );
    } else if (version !== '2.0') {
      report(
        state,
        'rss',
        'warning',
        'RSS ' + version + ' is not RSS 2.0',
        'Older versions differ in which elements they allow.',
      );
    }
  }
  if (isAtom && root.namespaceURI === NS.atom03) {
    report(
      state,
      'feed',
      'warning',
      'Atom 0.3 is deprecated',
      'Upgrade to the Atom 1.0 namespace ' + NS.atom + '.',
    );
  }
  if (isAtom && root.namespaceURI !== NS.atom && root.namespaceURI !== NS.atom03) {
    report(
      state,
      'feed',
      'warning',
      'Unexpected Atom namespace',
      'The root namespace is ' + (root.namespaceURI ?? '(none)') + ' rather than ' + NS.atom + '.',
    );
  }

  /* -------------------------------- metadata -------------------------------- */

  const channelTitle = textOf(firstNamed(container, 'title'));
  const channelLink = isAtom
    ? atomLink(container, ['alternate', ''])
    : textOf(firstNamed(container, 'link'));
  const channelDescription = isAtom
    ? textOf(firstNamed(container, 'subtitle'))
    : textOf(firstNamed(container, 'description'));
  const language =
    dialect === 'rss2'
      ? textOf(firstNamed(container, 'language'))
      : (root.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang') ??
        container.getAttribute('xml:lang') ??
        '');
  const updatedElement = isAtom
    ? (firstNamed(container, 'updated') ?? firstNamed(container, 'modified'))
    : (firstNamed(container, 'lastBuildDate') ??
      firstNamed(container, 'pubDate') ??
      firstNS(container, NS.dc, 'date'));
  const updatedRaw = textOf(updatedElement);
  const updatedMs = parseDate(updatedRaw);
  const generator = textOf(firstNamed(container, 'generator'));

  /* ---------------------------------- items --------------------------------- */

  const itemInfos: ItemInfo[] = itemElements.map((element, index) => {
    const title = textOf(firstNamed(element, 'title'));
    const link = isAtom
      ? atomLink(element, ['alternate', ''])
      : textOf(firstNamed(element, 'link'));
    let id = '';
    if (isAtom) id = textOf(firstNamed(element, 'id'));
    else if (dialect === 'rss1') id = (element.getAttributeNS(NS.rdf, 'about') ?? '').trim();
    else id = textOf(firstNamed(element, 'guid'));

    const dateElement = isAtom
      ? (firstNamed(element, 'published') ?? firstNamed(element, 'updated'))
      : (firstNamed(element, 'pubDate') ?? firstNS(element, NS.dc, 'date'));
    const dateRaw = textOf(dateElement);

    const authorElement = firstNamed(element, 'author');
    const author = isAtom
      ? textOf(firstNamed(authorElement ?? element, 'name'))
      : textOf(authorElement) || textOf(firstNS(element, NS.dc, 'creator'));

    const description = isAtom
      ? (firstNamed(element, 'summary') ?? firstNamed(element, 'content'))
      : firstNamed(element, 'description');

    const enclosures: Enclosure[] = [];
    if (isAtom) {
      for (const link of childrenNamed(element, 'link')) {
        if ((link.getAttribute('rel') ?? '').trim().toLowerCase() !== 'enclosure') continue;
        enclosures.push({
          url: (link.getAttribute('href') ?? '').trim(),
          type: (link.getAttribute('type') ?? '').trim(),
          length: (link.getAttribute('length') ?? '').trim(),
        });
      }
    } else {
      for (const enclosure of childrenNamed(element, 'enclosure')) {
        enclosures.push({
          url: (enclosure.getAttribute('url') ?? '').trim(),
          type: (enclosure.getAttribute('type') ?? '').trim(),
          length: (enclosure.getAttribute('length') ?? '').trim(),
        });
      }
    }

    return {
      index,
      title,
      link,
      id,
      dateRaw,
      dateMs: parseDate(dateRaw),
      author,
      hasDescription: textOf(description) !== '',
      enclosures,
    };
  });

  if (checkSpec) {
    if (dialect === 'rss1') {
      for (const name of ['title', 'link', 'description']) {
        if (textOf(firstNamed(container, name)) === '') {
          report(
            state,
            'channel > ' + name,
            'error',
            'Missing channel ' + name,
            'RSS 1.0 requires channel ' + name + '.',
          );
        }
      }
    } else if (dialect === 'rss2') {
      for (const name of ['title', 'link', 'description']) {
        if (textOf(firstNamed(container, name)) === '') {
          report(
            state,
            'channel > ' + name,
            'error',
            'Missing channel ' + name,
            'RSS 2.0 requires channel ' + name + '.',
          );
        }
      }
    } else {
      for (const name of ['id', 'title', 'updated']) {
        if (textOf(firstNamed(container, name)) === '') {
          report(
            state,
            'feed > ' + name,
            'error',
            'Missing feed ' + name,
            'Atom requires a feed ' + name + ' element.',
          );
        }
      }
      for (const link of childrenNamed(container, 'link')) {
        if ((link.getAttribute('href') ?? '').trim() === '') {
          report(
            state,
            'feed > link',
            'error',
            'Link without href',
            'Atom link elements must carry an href attribute.',
          );
        }
      }
      const entriesMissingAuthor = itemElements.filter(
        (element) => firstNamed(element, 'author') === null,
      ).length;
      if (firstNamed(container, 'author') === null && entriesMissingAuthor > 0) {
        report(
          state,
          'feed > author',
          'error',
          'Missing author',
          'Atom requires a feed author unless every entry has one; ' +
            entriesMissingAuthor +
            ' entry/entries have none.',
        );
      }
    }

    if (updatedRaw !== '' && updatedMs === null) {
      report(
        state,
        'channel > ' + (updatedElement?.localName ?? 'date'),
        'error',
        'Unparsable date',
        'The value "' + clip(updatedRaw, 60) + '" is not a recognised date.',
      );
    }
    if (updatedRaw !== '' && updatedMs !== null && !isAtom && !HAS_ZONE.test(updatedRaw)) {
      report(
        state,
        'channel > ' + (updatedElement?.localName ?? 'date'),
        'warning',
        'Date has no timezone',
        'RSS dates are RFC 822 date-times, which include a zone such as +0000 or GMT.',
      );
    }
    if (channelLink !== '' && !ABSOLUTE_URL.test(channelLink)) {
      report(
        state,
        'channel > link',
        'warning',
        'Relative feed link',
        'Use an absolute URL so readers can resolve it without knowing where the feed lives.',
      );
    }

    for (const item of itemInfos) {
      const path = itemLabel(item.index);
      if (item.title === '') {
        if (isAtom) {
          report(
            state,
            path + ' > title',
            'error',
            'Missing entry title',
            'Atom requires every entry to have a title.',
          );
        } else if (!item.hasDescription) {
          report(
            state,
            path,
            'error',
            'No title and no description',
            'RSS items must carry a title or a description.',
          );
        } else {
          report(
            state,
            path + ' > title',
            'warning',
            'Item has no title',
            'Readers fall back to the description.',
          );
        }
      }
      if (isAtom) {
        if (item.id === '')
          report(
            state,
            path + ' > id',
            'error',
            'Missing entry id',
            'Atom requires a permanent, unique id for every entry.',
          );
        if (item.dateRaw === '')
          report(
            state,
            path + ' > updated',
            'error',
            'Missing updated date',
            'Atom requires an updated date on every entry.',
          );
        if (item.link === '')
          report(
            state,
            path + ' > link',
            'warning',
            'Entry has no alternate link',
            'Add link rel="alternate" so readers can open the entry.',
          );
      } else if (item.id === '') {
        report(
          state,
          path + ' > guid',
          'warning',
          'Item has no guid',
          'Without a guid readers may treat updated items as new.',
        );
      }

      if (item.dateRaw !== '') {
        if (item.dateMs === null) {
          report(
            state,
            path + ' > date',
            'error',
            'Unparsable date',
            'The value "' + clip(item.dateRaw, 60) + '" is not a recognised date.',
          );
        } else {
          if (isAtom && !RFC3339.test(item.dateRaw.trim())) {
            report(
              state,
              path + ' > date',
              'warning',
              'Date is not RFC 3339',
              'Atom dates look like 2024-10-01T09:00:00Z; got "' + clip(item.dateRaw, 60) + '".',
            );
          }
          if (!isAtom && !HAS_ZONE.test(item.dateRaw)) {
            report(
              state,
              path + ' > date',
              'warning',
              'Date has no timezone',
              'Adding +0000 or GMT stops readers shifting the date.',
            );
          }
          if (item.dateMs > Date.now() + 24 * 60 * 60 * 1000) {
            report(
              state,
              path + ' > date',
              'warning',
              'Date is in the future',
              'Readers may hide or reorder an item dated ahead of now.',
            );
          }
        }
      }

      if (dialect === 'rss2') {
        const guid = firstNamed(itemElements[item.index] ?? container, 'guid');
        const permalink = guid?.getAttribute('isPermaLink') ?? null;
        if (permalink !== null && permalink !== 'true' && permalink !== 'false') {
          report(
            state,
            path + ' > guid',
            'warning',
            'Unexpected isPermaLink value',
            'isPermaLink should be "true" or "false", not "' + permalink + '".',
          );
        }
      }

      if (item.link !== '' && !ABSOLUTE_URL.test(item.link)) {
        report(
          state,
          path + ' > link',
          'warning',
          'Relative item link',
          'Relative links break when the feed is copied or proxied.',
        );
      }

      for (const enclosure of item.enclosures) {
        if (enclosure.url === '') {
          report(
            state,
            path + ' > enclosure',
            'error',
            'Enclosure without a url',
            'An enclosure needs a url attribute pointing at the media file.',
          );
        } else if (!ABSOLUTE_URL.test(enclosure.url)) {
          report(
            state,
            path + ' > enclosure',
            'warning',
            'Relative enclosure url',
            'Podcast clients need an absolute media URL.',
          );
        }
        if (enclosure.type === '') {
          report(
            state,
            path + ' > enclosure',
            'warning',
            'Enclosure without a type',
            'Directories reject enclosures with no MIME type.',
          );
        }
        if (enclosure.length === '') {
          report(
            state,
            path + ' > enclosure',
            'warning',
            'Enclosure without a length',
            'Include the file size in bytes so clients can show progress.',
          );
        } else if (!/^\d+$/u.test(enclosure.length)) {
          report(
            state,
            path + ' > enclosure',
            'warning',
            'Enclosure length is not a byte count',
            'Got "' + clip(enclosure.length, 40) + '".',
          );
        }
      }
    }

    const seenIds = new Map<string, number>();
    const seenLinks = new Map<string, number>();
    for (const item of itemInfos) {
      if (item.id !== '') {
        const previous = seenIds.get(item.id);
        if (previous === undefined) seenIds.set(item.id, item.index);
        else
          report(
            state,
            itemLabel(item.index) + ' > id',
            'warning',
            'Duplicate identifier',
            'The same id is already used by ' + itemLabel(previous) + '.',
          );
      }
      if (item.link !== '') {
        const previous = seenLinks.get(item.link);
        if (previous === undefined) seenLinks.set(item.link, item.index);
        else
          report(
            state,
            itemLabel(item.index) + ' > link',
            'warning',
            'Duplicate link',
            'The same link is already used by ' + itemLabel(previous) + '.',
          );
      }
    }
  }

  if (itemInfos.length === 0) {
    report(
      state,
      container === root ? 'feed' : 'channel',
      'warning',
      'The feed has no items',
      'There is nothing for a reader to display yet.',
    );
  }

  /* --------------------------------- outputs -------------------------------- */

  const errors =
    state.issues.filter((issue) => issue.level === 'error').length + state.droppedErrors;
  const warnings =
    state.issues.filter((issue) => issue.level === 'warning').length + state.droppedWarnings;
  const enclosureCount = itemInfos.reduce((total, item) => total + item.enclosures.length, 0);
  const dated = itemInfos
    .filter((item) => item.dateMs !== null)
    .map((item) => item.dateMs as number);
  const earliest = dated.length === 0 ? null : Math.min(...dated);
  const latest = dated.length === 0 ? null : Math.max(...dated);
  const usedNamespaces = new Set<string>();
  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    if (element.namespaceURI !== null) usedNamespaces.add(element.namespaceURI);
  }
  const namespaceLabels = [...usedNamespaces]
    .filter((uri) => uri !== 'http://www.w3.org/XML/1998/namespace')
    .map((uri) => NS_LABELS.get(uri) ?? uri)
    .sort();

  const notes: string[] = [];
  const resultWarnings: string[] = [];
  if (!checkSpec) notes.push('Specification checks were disabled; only the content was read.');
  if (state.droppedErrors + state.droppedWarnings > 0) {
    notes.push(
      'The problem list is capped at ' +
        MAX_ISSUES +
        '; ' +
        (state.droppedErrors + state.droppedWarnings) +
        ' more were not listed.',
    );
  }
  if (itemInfos.length > MAX_ROWS) {
    notes.push('Only the first ' + MAX_ROWS + ' of ' + itemInfos.length + ' items are listed.');
  }
  if (errors > 0) resultWarnings.push(errors + ' specification error(s) found.');

  const stats: Record<string, string | number> = {
    dialect: dialectLabel,
    items: itemInfos.length,
    enclosures: enclosureCount,
    errors,
    warnings,
  };

  const iso = (ms: number | null): string => (ms === null ? 'n/a' : new Date(ms).toISOString());

  if (format === 'items') {
    const rows = itemInfos
      .slice(0, MAX_ROWS)
      .map((item) => [
        String(item.index + 1),
        clip(item.title, 60) || 'n/a',
        clip(item.link, 60) || 'n/a',
        iso(item.dateMs),
        clip(item.id, 40) || 'n/a',
        clip(item.author, 30) || 'n/a',
        item.enclosures.length === 0
          ? '-'
          : String(item.enclosures.length) +
            (item.enclosures[0]?.type ? ' (' + item.enclosures[0].type + ')' : ''),
      ]);
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Title', 'Link', 'Date', 'Identifier', 'Author', 'Enclosure'],
          rows,
        }),
        render: 'table',
      },
      notes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'enclosures') {
    const rows: string[][] = [];
    for (const item of itemInfos) {
      for (const enclosure of item.enclosures) {
        rows.push([
          String(item.index + 1) + '. ' + (clip(item.title, 40) || 'n/a'),
          clip(enclosure.url, 70) || 'n/a',
          enclosure.type || 'n/a',
          humanSize(enclosure.length),
        ]);
      }
    }
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Item', 'URL', 'Type', 'Size'],
          rows: rows.length === 0 ? [['-', '-', '-', 'This feed has no media enclosures.']] : rows,
        }),
        render: 'table',
      },
      notes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'issues') {
    const rows =
      state.issues.length === 0
        ? [
            [
              '-',
              'ok',
              'No problems found',
              checkSpec
                ? 'The feed satisfies the checks that were enabled.'
                : 'Specification checks were disabled.',
            ],
          ]
        : state.issues.map((issue) => [issue.path, issue.level, issue.problem, issue.detail]);
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['Path', 'Level', 'Problem', 'Detail'], rows }),
        render: 'table',
      },
      notes,
      warnings: resultWarnings,
      stats,
    };
  }

  const summaryRows: string[][] = [
    ['Dialect', dialectLabel],
    ['Title', clip(channelTitle, 80) || 'n/a'],
    ['Link', clip(channelLink, 80) || 'n/a'],
    ['Description', clip(channelDescription, 120) || 'n/a'],
    ['Language', language || 'n/a'],
    [
      'Last updated',
      updatedRaw === '' ? 'n/a' : updatedMs === null ? clip(updatedRaw, 60) : iso(updatedMs),
    ],
    ['Generator', clip(generator, 60) || 'n/a'],
    ['Items', String(itemInfos.length)],
    ['Enclosures', String(enclosureCount)],
    ['Item date range', earliest === null ? 'n/a' : iso(earliest) + ' to ' + iso(latest)],
    ['Namespaces', namespaceLabels.length === 0 ? 'n/a' : namespaceLabels.join(', ')],
    ['Podcast extensions', itemInfos.some((item) => item.enclosures.length > 0) ? 'yes' : 'no'],
    ['Errors', String(errors)],
    ['Warnings', String(warnings)],
  ];

  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }),
      render: 'table',
    },
    notes,
    warnings: resultWarnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
