import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './http-header-analyzer.meta';
import {
  FAMILY_BY_ID,
  findFamily,
  type HeaderFamily,
  type ParsedHeader,
} from './http-header-analyzer.families';

/**
 * Unified HTTP header analyzer.
 *
 * Paste a header block (or a single header value) and every line is detected
 * by name and parsed with the rules of that header: the value is checked
 * against the grammar from the RFC, the interesting parts are broken out, and
 * problems are reported per header.
 *
 * It replaces the long-tail single-header tools (their ids stay routable as
 * redirect aliases) — see `http-header-analyzer.families.ts` for the parsers.
 */

const MAX_INPUT = 100_000;
const FIELD_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const TABLE_HEADERS = ['Header', 'Value', 'Details', 'Status', 'Assessment'];
const MAX_DETAILS = 8;
const MAX_NOTES = 20;

interface Entry {
  name: string;
  value: string;
}

/** A pasted status line (`HTTP/1.1 200 OK`) or request line (`GET / HTTP/1.1`). */
function isStartLine(line: string): boolean {
  return (
    /^HTTP\/\d(?:\.\d)?\s+\d{3}/i.test(line) || /^[A-Z]+\s+\S+\s+HTTP\/\d(?:\.\d)?$/i.test(line)
  );
}

/**
 * Split a pasted block into header entries.
 * - A leading status/request line is skipped (it is not a header).
 * - Obsolete line folding (a line starting with a space) continues the
 *   previous header.
 * - Everything after the first blank line of a raw response is the body.
 */
function parseBlock(text: string): {
  entries: Entry[];
  startLine: string | null;
  bodyIgnored: boolean;
} {
  const lines = text.split(/\r\n|\r|\n/);
  const entries: Entry[] = [];
  let startLine: string | null = null;
  let sawStartLine = false;
  let bodyIgnored = false;

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index] ?? '';
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (sawStartLine) {
        bodyIgnored = true;
        break;
      }
      continue;
    }
    if (isStartLine(line)) {
      if (entries.length === 0 && !startLine) {
        startLine = line.trim();
        sawStartLine = true;
        continue;
      }
      throw new ToolError(
        `Line ${index + 1} looks like a status line, not a header.`,
        'Only one status or request line may appear, at the top of the block.',
      );
    }
    if (/^[ \t]/.test(raw) && entries.length) {
      const last = entries[entries.length - 1]!;
      last.value = `${last.value} ${line.trim()}`.trim();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 1)
      throw new ToolError(
        `Line ${index + 1} is not a valid header line.`,
        'Every header must look like "Name: value" — pick a specific header in the options to analyze a bare value.',
      );
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!FIELD_NAME.test(name))
      throw new ToolError(
        `"${name}" on line ${index + 1} is not a valid header name.`,
        "Header names are tokens made of letters, digits and !#$%&'*+-.^_`|~.",
      );
    entries.push({ name, value });
  }

  return { entries, startLine, bodyIgnored };
}

/** `x-request-id` → `X-Request-Id`, for headers without a dedicated parser. */
function titleCase(name: string): string {
  return name
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('-');
}

/** Control characters are not allowed in a field value (HTAB excepted). */
function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if ((code < 0x20 && code !== 0x09) || code === 0x7f) return true;
  }
  return false;
}

/** True when the value carries obs-text (non-ASCII) bytes. */
function hasObsText(value: string): boolean {
  for (const char of value) {
    if ((char.codePointAt(0) ?? 0) >= 0x80) return true;
  }
  return false;
}

/** Fallback rules for headers without a dedicated parser. */
function parseGeneric(value: string): ParsedHeader {
  const issues: string[] = [];
  const notes: string[] = [];
  if (!value) notes.push('Header has an empty value');
  if (hasControlChars(value)) issues.push('Value contains control characters');
  if (hasObsText(value)) notes.push('Value contains non-ASCII characters (obs-text)');
  return {
    status: issues.length ? 'Invalid' : 'Generic',
    summary: issues.length
      ? 'Value does not follow the HTTP field-value grammar'
      : 'No dedicated parser for this header; the value passed the generic field-value check',
    details: [],
    issues,
    notes,
  };
}

function emptyResult(note: string, stats: Record<string, string | number> = {}): TextRunResult {
  return {
    output: JSON.stringify({ headers: TABLE_HEADERS, rows: [] }),
    render: 'table',
    stats,
    notes: [note],
  };
}

function detailsCell(details: string[]): string {
  if (!details.length) return '—';
  if (details.length <= MAX_DETAILS) return details.join('; ');
  return `${details.slice(0, MAX_DETAILS).join('; ')}; …+${details.length - MAX_DETAILS} more`;
}

function collectNotes(notes: string[]): string[] {
  const unique: string[] = [];
  for (const note of notes) {
    if (note && !unique.includes(note)) unique.push(note);
  }
  if (unique.length <= MAX_NOTES) return unique;
  return [...unique.slice(0, MAX_NOTES), `…and ${unique.length - MAX_NOTES} more note(s)`];
}

/** Analyze a whole pasted header block. */
function analyzeBlock(input: TextRunInput, options: OptionValues): TextRunResult {
  const onInvalid = String(options.onInvalid);
  const includeUnknown = options.includeUnknown !== false;
  const text = input.text.replace(/^\uFEFF/, '');
  if (!text.trim())
    return emptyResult('Paste one or more headers, one "Name: value" per line, to analyze.');

  const { entries, startLine, bodyIgnored } = parseBlock(text);
  if (!entries.length) return emptyResult('No headers were found in the pasted text.');

  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicateNames = [...counts.values()].filter((count) => count > 1).length;

  const rows: string[][] = [];
  const notes: string[] = [];
  const issues: string[] = [];
  let deprecated = 0;
  let unknown = 0;

  for (const entry of entries) {
    const family = findFamily(entry.name);
    const parsed = family ? family.parse(entry.value) : parseGeneric(entry.value);

    if (onInvalid === 'error' && parsed.issues.length) {
      const label = family ? family.header : titleCase(entry.name);
      throw new ToolError(
        `${label}: ${parsed.issues[0]}`,
        'Switch "When a value fails validation" back to "Report the problem" to see every header at once.',
      );
    }

    if (!family) {
      if (!includeUnknown) continue;
      unknown += 1;
    }
    if (family?.deprecated) {
      deprecated += 1;
      notes.push(`${family.header} is deprecated — ${family.deprecated}`);
    }

    const occurrences = counts.get(entry.name.toLowerCase()) ?? 1;
    if (occurrences > 1) {
      notes.push(
        `${family?.header ?? titleCase(entry.name)} appears ${occurrences} times — repeated fields are combined with commas (except Set-Cookie).`,
      );
    }

    const assessment = [parsed.summary, ...parsed.issues].join(' — ');
    const status = family?.deprecated ? 'Deprecated' : parsed.status;
    rows.push([
      family?.header ?? titleCase(entry.name),
      entry.value,
      detailsCell(parsed.details),
      status,
      family?.deprecated ? `${assessment} — Deprecated: ${family.deprecated}` : assessment,
    ]);

    for (const issue of parsed.issues)
      issues.push(`${family?.header ?? titleCase(entry.name)}: ${issue}`);
    for (const note of parsed.notes) notes.push(note);
  }

  if (startLine) notes.push(`Ignored the start line "${startLine}".`);
  if (bodyIgnored) notes.push('Ignored the body that followed the header block.');

  if (options.sort === true)
    rows.sort(
      (a, b) => (a[0] ?? '').localeCompare(b[0] ?? '') || (a[1] ?? '').localeCompare(b[1] ?? ''),
    );

  return {
    output: JSON.stringify({ headers: TABLE_HEADERS, rows }),
    render: 'table',
    stats: {
      headers: rows.length,
      issues: issues.length,
      deprecated,
      unknown,
      duplicates: duplicateNames,
    },
    notes: collectNotes([...issues, ...notes]),
  };
}

/** Analyze the pasted text as the value of one specific header. */
function analyzeSingle(
  family: HeaderFamily,
  input: TextRunInput,
  options: OptionValues,
): TextRunResult {
  const onInvalid = String(options.onInvalid);
  const raw = input.text.replace(/^\uFEFF/, '').trim();
  if (!raw) return emptyResult(`Paste a ${family.header} value to analyze.`, { headers: 0 });

  const labelled = new RegExp(`^${family.header}\\s*:\\s*`, 'i');
  const body = raw.replace(labelled, '').trim();
  const value = family.multiline ? body : body.replace(/\s*\n\s*/g, ', ');

  const parsed = family.parse(value);
  if (onInvalid === 'error' && parsed.issues.length)
    throw new ToolError(
      `${family.header}: ${parsed.issues[0]}`,
      'Switch "When a value fails validation" back to "Report the problem" to see every problem at once.',
    );

  const assessment = [parsed.summary, ...parsed.issues].join(' — ');
  const status = family.deprecated ? 'Deprecated' : parsed.status;
  const row = [
    family.header,
    value,
    detailsCell(parsed.details),
    status,
    family.deprecated ? `${assessment} — Deprecated: ${family.deprecated}` : assessment,
  ];

  return {
    output: JSON.stringify({ headers: TABLE_HEADERS, rows: [row] }),
    render: 'table',
    stats: {
      headers: 1,
      issues: parsed.issues.length,
      deprecated: family.deprecated ? 1 : 0,
      unknown: 0,
      duplicates: 0,
    },
    notes: collectNotes([
      ...parsed.issues.map((issue) => `${family.header}: ${issue}`),
      ...(family.deprecated ? [`${family.header} is deprecated — ${family.deprecated}`] : []),
      ...parsed.notes,
    ]),
  };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  if (input.text.length > MAX_INPUT)
    throw new ToolError('Header input is too large.', 'Paste headers under 100 KB.');

  const header = String(options.header);
  const onInvalid = String(options.onInvalid);
  if (onInvalid !== 'report' && onInvalid !== 'error')
    throw new ToolError('Choose how invalid values should be handled.');

  if (header === 'auto') return analyzeBlock(input, options);

  const family = FAMILY_BY_ID.get(header);
  if (!family) throw new ToolError('Choose a supported header.');
  return analyzeSingle(family, input, options);
}

export { run };

const tool: TextToolModule = { meta, run };
export default tool;
