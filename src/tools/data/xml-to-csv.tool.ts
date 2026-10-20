import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './xml-to-csv.meta';

const MAX_LENGTH = 2_000_000;
const MAX_RECORDS = 50_000;

type XmlEl = {
  name: string;
  attrs: Array<{ name: string; value: string }>;
  children: XmlEl[];
  text: string[];
};
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const DELIMITERS: Record<string, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, entity: string) => {
    switch (entity.toLowerCase()) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      case 'nbsp':
        return ' ';
      default:
        break;
    }
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? all : String.fromCodePoint(code);
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? all : String.fromCodePoint(code);
    }
    return all;
  });
}

function parseXml(src: string): XmlEl {
  const root: XmlEl = { name: '#root', attrs: [], children: [], text: [] };
  const stack: XmlEl[] = [root];
  let i = 0;

  const pushText = (raw: string): void => {
    if (raw) stack[stack.length - 1]!.text.push(decodeEntities(raw));
  };

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      pushText(src.slice(i));
      break;
    }
    pushText(src.slice(i, lt));

    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9);
      const stop = end === -1 ? src.length : end;
      stack[stack.length - 1]!.text.push(src.slice(lt + 9, stop));
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (src.startsWith('<?', lt) || src.startsWith('<!', lt)) {
      const end = src.indexOf('>', lt + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (src[lt + 1] === '/') {
      const end = src.indexOf('>', lt + 2);
      const name = src.slice(lt + 2, end === -1 ? src.length : end).trim();
      for (let s = stack.length - 1; s >= 1; s -= 1) {
        if (stack[s]!.name === name) {
          stack.length = s;
          break;
        }
      }
      i = end === -1 ? src.length : end + 1;
      continue;
    }

    // Opening tag: name plus quote-aware attributes.
    let j = lt + 1;
    let name = '';
    while (j < src.length && !/[\s/>]/.test(src[j]!)) {
      name += src[j];
      j += 1;
    }
    const attrs: Array<{ name: string; value: string }> = [];
    let selfClosing = false;
    while (j < src.length) {
      while (j < src.length && /\s/.test(src[j]!)) j += 1;
      if (src[j] === '>') {
        j += 1;
        break;
      }
      if (src[j] === '/' && src[j + 1] === '>') {
        selfClosing = true;
        j += 2;
        break;
      }
      let attrName = '';
      while (j < src.length && !/[\s=/>]/.test(src[j]!)) {
        attrName += src[j];
        j += 1;
      }
      while (j < src.length && /\s/.test(src[j]!)) j += 1;
      let value = '';
      if (src[j] === '=') {
        j += 1;
        while (j < src.length && /\s/.test(src[j]!)) j += 1;
        const quote = src[j];
        if (quote === '"' || quote === "'") {
          j += 1;
          const end = src.indexOf(quote, j);
          value = src.slice(j, end === -1 ? src.length : end);
          j = end === -1 ? src.length : end + 1;
        } else {
          while (j < src.length && !/[\s/>]/.test(src[j]!)) {
            value += src[j];
            j += 1;
          }
        }
      }
      if (attrName) attrs.push({ name: attrName, value: decodeEntities(value) });
    }

    if (!name) {
      i = j;
      continue;
    }

    const el: XmlEl = { name, attrs, children: [], text: [] };
    stack[stack.length - 1]!.children.push(el);
    if (!selfClosing) stack.push(el);
    i = j;
  }

  return root;
}

function elToJson(el: XmlEl, includeAttributes: boolean): Json {
  const obj: Record<string, Json> = {};
  if (includeAttributes) for (const attr of el.attrs) obj['@' + attr.name] = attr.value;

  const grouped = new Map<string, XmlEl[]>();
  for (const child of el.children) {
    const list = grouped.get(child.name);
    if (list) list.push(child);
    else grouped.set(child.name, [child]);
  }
  for (const [name, list] of grouped) {
    obj[name] =
      list.length === 1
        ? elToJson(list[0]!, includeAttributes)
        : list.map((child) => elToJson(child, includeAttributes));
  }

  const text = el.text.join('').replace(/\s+/g, ' ').trim();
  if (!Object.keys(obj).length) return text;
  if (text) obj['#text'] = text;
  return obj;
}

function findRepeating(nodes: XmlEl[]): XmlEl[] {
  let best: XmlEl[] = [];
  const visit = (el: XmlEl): void => {
    const groups = new Map<string, XmlEl[]>();
    for (const child of el.children) {
      const list = groups.get(child.name);
      if (list) list.push(child);
      else groups.set(child.name, [child]);
    }
    for (const list of groups.values()) {
      if (list.length > best.length) best = list;
      if (list.length === 1) visit(list[0]!);
      else for (const child of list) visit(child);
    }
  };
  for (const node of nodes) visit(node);
  return best;
}

function selectRecords(root: XmlEl, path: string): XmlEl[] {
  const trimmed = path.trim().replace(/^\/+/, '');
  if (!trimmed) {
    const repeating = findRepeating(root.children);
    if (repeating.length > 1) return repeating;
    return root.children.length ? root.children : [root];
  }

  const segments = trimmed.split(/[./]/).filter((seg) => seg && seg !== '$');
  const walk = (start: XmlEl[], from: number): XmlEl[] => {
    let current = start;
    for (let index = from; index < segments.length; index += 1) {
      const segment = segments[index]!;
      const next: XmlEl[] = [];
      for (const el of current)
        for (const child of el.children) if (child.name === segment) next.push(child);
      if (!next.length) return [];
      current = next;
    }
    return current;
  };

  // Accept both a full path (catalog.book) and a path relative to the document element (book).
  const full = walk([root], 0);
  return full.length ? full : walk(root.children, 0);
}

function flatten(value: Json, prefix: string, out: Map<string, string>, rootName: string): void {
  if (value === null) {
    out.set(prefix || rootName, '');
    return;
  }
  if (Array.isArray(value)) {
    out.set(prefix || rootName, JSON.stringify(value));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const nextPrefix = key === '#text' ? prefix || rootName : prefix ? `${prefix}.${key}` : key;
      flatten(child, nextPrefix, out, rootName);
    }
    return;
  }
  out.set(prefix || rootName, String(value));
}

function csvCell(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || /[\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const recordPath = String(o.recordPath ?? '');
  const delimiter = DELIMITERS[String(o.delimiter ?? 'comma')] ?? ',';
  const header = o.header !== false;
  const includeAttributes = o.includeAttributes !== false;

  const xml = input.text ?? '';
  if (!xml.trim()) {
    throw new ToolError(
      'Paste some XML to convert.',
      'Example: <books><book><title>Dune</title></book><book><title>It</title></book></books>',
    );
  }
  if (xml.length > MAX_LENGTH) {
    throw new ToolError(
      'XML is too large.',
      `Keep it under ${MAX_LENGTH.toLocaleString('en-US')} characters.`,
    );
  }

  const doc = parseXml(xml);
  if (!doc.children.length) {
    throw new ToolError(
      'No XML element found.',
      'Check that the input contains at least one well-formed opening tag.',
    );
  }

  const records = selectRecords(doc, recordPath);
  if (!records.length) {
    throw new ToolError(
      `No elements matched "${recordPath.trim()}".`,
      'Use a path of child element names such as catalog.book.',
    );
  }
  if (records.length > MAX_RECORDS) {
    throw new ToolError(
      'Too many records to convert.',
      `Convert up to ${MAX_RECORDS.toLocaleString('en-US')} records at a time.`,
    );
  }

  const columns: string[] = [];
  const rows: string[][] = records.map((record) => {
    const cells = new Map<string, string>();
    flatten(elToJson(record, includeAttributes), '', cells, record.name);
    const row: string[] = [];
    for (const [key, value] of cells) {
      let index = columns.indexOf(key);
      if (index === -1) {
        columns.push(key);
        index = columns.length - 1;
      }
      row[index] = value;
    }
    return row;
  });

  const lines: string[] = [];
  if (header) lines.push(columns.map((column) => csvCell(column, delimiter)).join(delimiter));
  for (const row of rows) {
    lines.push(columns.map((_, index) => csvCell(row[index] ?? '', delimiter)).join(delimiter));
  }

  return {
    output: lines.join('\n'),
    render: 'code',
    language: 'csv',
    stats: { records: records.length, columns: columns.length },
    notes: [`Converted ${records.length} record(s) into ${columns.length} column(s).`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
