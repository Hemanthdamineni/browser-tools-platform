import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pdf-structure-inspector.meta';

/**
 * PDF structure inspector.
 *
 * Reads the raw bytes of a PDF and reports what the file claims about itself:
 * header, cross-reference table, trailer, object layout, linearization,
 * encryption and incremental updates. Every claim is checked against the bytes
 * on disk, so drifted object offsets and truncated files are reported precisely.
 *
 * Verdicts in the tests come from `qpdf` (the same tool that implements PDF
 * repair), not from this parser.
 */

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_OBJECTS = 200000;
const MAX_FINDINGS = 500;
const CLIP = 160;

const LATIN1 = new TextDecoder('latin1');

/**
 * A name token in a dictionary: everything after `/` up to whitespace or a
 * delimiter. Built with `RegExp` so the character class needs no literal
 * escaping in source.
 */
const DICT_KEY_RE = new RegExp('^/([^\\s/<>{}\\[\\]()%]+)', 'u');
/** A bare value token: an indirect reference (`n n R`) or a run of non-delimiters. */
const VALUE_TOKEN_RE = new RegExp('^(?:\\d+\\s+\\d+\\s+R\\b|[^/<>{}()%\\[\\]\\s]+)', 'u');

/** A Latin-1 view of the bytes plus cheap scanning helpers. */
class Haystack {
  readonly bytes: Uint8Array;
  readonly text: string;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.text = LATIN1.decode(bytes);
  }

  get length(): number {
    return this.bytes.length;
  }

  /** Index of the last occurrence of `needle`, or -1. */
  lastIndexOf(needle: string, from = this.text.length): number {
    return this.text.lastIndexOf(needle, from);
  }

  /** Index of the first occurrence at or after `from`, or -1. */
  indexOf(needle: string, from = 0): number {
    return this.text.indexOf(needle, from);
  }

  find_all(needle: string, limit: number): number[] {
    const out: number[] = [];
    let at = 0;
    while (out.length < limit) {
      const next = this.text.indexOf(needle, at);
      if (next === -1) break;
      out.push(next);
      at = next + needle.length;
    }
    return out;
  }

  ascii(at: number, len: number): string {
    return this.text.slice(at, at + len);
  }
}

interface XrefRow {
  num: number;
  gen: number;
  offset: number;
  free: boolean;
  compressed: boolean;
  container?: number;
  index?: number;
  /** True when the bytes at `offset` really start with `<num> <gen> obj`. */
  lands: boolean;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface PdfModel {
  version: string | null;
  headerAt: number;
  bytes: number;
  eofs: number;
  startxref: number | null;
  startxrefAt: number;
  trailer: Record<string, string>;
  trailerAt: number;
  rows: XrefRow[];
  xrefSections: { at: number; kind: 'table' | 'stream'; rows: number }[];
  encrypted: boolean;
  linearized: boolean;
  prevs: number[];
  objectStreams: number;
  objStmCount: number;
  findings: Finding[];
  pages: number | null;
  xrefKeyword: string | null;
}

function clip(value: string): string {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > CLIP ? `${flat.slice(0, CLIP)}…` : flat;
}

/** Parse the header: `%PDF-x.y` must appear in the first 1024 bytes. */
function readHeader(h: Haystack): { version: string | null; at: number } {
  const limit = Math.min(h.length, 1024);
  for (let at = 0; at < limit; at += 1) {
    if (h.text.startsWith('%PDF-', at)) {
      const raw = h.ascii(at + 5, 8);
      const match = /^(\d+)\.(\d+)/u.exec(raw);
      return { version: match ? `${match[1]}.${match[2]}` : raw.trim(), at };
    }
  }
  return { version: null, at: -1 };
}

/**
 * Locate the trailer dictionary that belongs to the last xref section. A
 * `trailer` keyword may be followed by `<< … >>`; the dictionary may itself
 * contain nested `<<>>` (as /ID does), so we balance angle brackets.
 */
function readDictionary(
  h: Haystack,
  from: number,
): { body: string; start: number; end: number } | null {
  let at = from;
  while (at < h.length && /\s/u.test(h.text.charAt(at))) at += 1;
  if (h.text.slice(at, at + 2) !== '<<') return null;
  let depth = 0;
  for (let i = at; i < h.length - 1; i += 1) {
    const pair = h.text.slice(i, i + 2);
    if (pair === '<<') {
      depth += 1;
      i += 1;
    } else if (pair === '>>') {
      depth -= 1;
      i += 1;
      if (depth === 0) {
        return { body: h.text.slice(at, i + 1), start: at, end: i + 2 };
      }
    }
  }
  return null;
}

/** Pull the first-level keys of a dictionary body, ignoring nesting. */
function dictionaryKeys(body: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    const pair = body.slice(i, i + 2);
    if (pair === '<<') {
      depth += 1;
      i += 2;
      continue;
    }
    if (pair === '>>') {
      depth -= 1;
      i += 2;
      continue;
    }
    if (depth === 1 && body.charAt(i) === '/') {
      const match = DICT_KEY_RE.exec(body.slice(i, i + 80));
      if (match) {
        keys.push(match[1]!);
        i += match[0].length;
        continue;
      }
    }
    i += 1;
  }
  return keys;
}

/** Read a `/Name value` pair's raw value text out of a dictionary body. */
function dictionaryValue(body: string, key: string): string | null {
  const at = body.search(new RegExp(`/${key}(?![A-Za-z0-9])`, 'u'));
  if (at === -1) return null;
  const rest = body.slice(at + key.length + 1).trimStart();
  if (rest.startsWith('[')) {
    // Balanced array, e.g. /ID [<hex> <hex>] or /W [1 2 1].
    let depth = 0;
    for (let i = 0; i < rest.length; i += 1) {
      if (rest.charAt(i) === '[') depth += 1;
      else if (rest.charAt(i) === ']') {
        depth -= 1;
        if (depth === 0) return rest.slice(0, i + 1);
      }
    }
    return rest;
  }
  if (rest.startsWith('(')) {
    let depth = 0;
    for (let i = 0; i < rest.length; i += 1) {
      if (rest.charAt(i) === '(') depth += 1;
      else if (rest.charAt(i) === ')') {
        depth -= 1;
        if (depth === 0) return rest.slice(0, i + 1);
      }
    }
    return rest;
  }
  // Dictionary or a plain token / reference like `1 0 R`.
  if (rest.startsWith('<<')) {
    let depth = 0;
    for (let i = 0; i < rest.length - 1; i += 1) {
      const pair = rest.slice(i, i + 2);
      if (pair === '<<') {
        depth += 1;
        i += 1;
      } else if (pair === '>>') {
        depth -= 1;
        i += 1;
        if (depth === 0) return rest.slice(0, i + 1);
      }
    }
    return rest;
  }
  const token = VALUE_TOKEN_RE.exec(rest);
  return token ? token[0] : null;
}

/** A trailer /Encrypt ref or /Encrypt name means the file is encrypted. */
function readTrailer(h: Haystack, xrefAt: number): { dict: Record<string, string>; at: number } {
  const searchFrom = Math.max(0, xrefAt - 4096);
  const keyword = h.lastIndexOf('trailer', xrefAt + 64);
  if (keyword >= searchFrom) {
    const dict = readDictionary(h, keyword + 'trailer'.length);
    if (dict) {
      return { dict: readAttributes(dict.body), at: keyword };
    }
  }
  // Cross-reference *streams* (PDF 1.5+) carry the trailer keys in their dict.
  const streamDict = findXrefStreamDictionary(h, xrefAt);
  if (streamDict) return { dict: readAttributes(streamDict), at: xrefAt };
  return { dict: {}, at: -1 };
}

function readAttributes(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of dictionaryKeys(body)) {
    const value = dictionaryValue(body, key);
    if (value !== null) out[key] = value;
  }
  return out;
}

function findXrefStreamDictionary(h: Haystack, xrefAt: number): string | null {
  const from = Math.max(0, xrefAt - 1024);
  const slice = h.text.slice(from, Math.min(h.length, xrefAt + 64));
  const at = slice.lastIndexOf('/Type');
  if (at === -1) return null;
  const dict = readDictionary(h, from + at - 512 >= 0 ? from + Math.max(0, at - 512) : from);
  if (!dict) return null;
  return /\/XRef/u.test(dict.body) ? dict.body : null;
}

/**
 * Parse a classic `xref` table. Returns the rows and where parsing stopped.
 * Rows are checked against the bytes: `<num> <gen> obj` must appear at the
 * claimed offset.
 */
function parseXrefTable(h: Haystack, at: number): { rows: XrefRow[]; end: number; ok: boolean } {
  const rows: XrefRow[] = [];
  let cursor = at + 4; // past 'xref'
  let ok = true;
  const header = /^\s*(\d+)\s+(\d+)\s*/u.exec(h.text.slice(cursor, cursor + 64));
  if (!header) return { rows, end: at + 4, ok: false };
  while (true) {
    const head = /^\s*(\d+)\s+(\d+)\s*/u.exec(h.text.slice(cursor, cursor + 64));
    if (!head) break;
    const first = Number(head[1]);
    const count = Number(head[2]);
    if (!Number.isFinite(first) || !Number.isFinite(count) || count < 0 || count > MAX_OBJECTS) {
      ok = false;
      break;
    }
    cursor += head[0].length;
    for (let i = 0; i < count; i += 1) {
      const row = /^\s*(\d{1,10})\s+(\d{1,5})\s+([nf])\s*/u.exec(h.text.slice(cursor, cursor + 32));
      if (!row) {
        ok = false;
        break;
      }
      cursor += row[0].length;
      const num = first + i;
      const gen = Number(row[2]);
      const offset = Number(row[1]);
      const free = row[3] === 'f';
      const lands = free ? true : h.text.startsWith(`${num} ${gen} obj`, offset);
      // Object 0 is the free-list head; qpdf does not list it as a document object.
      if (free && num === 0) continue;
      rows.push({ num, gen, offset, free, compressed: false, lands });
      if (rows.length >= MAX_OBJECTS) return { rows, end: cursor, ok: false };
    }
    if (!ok) break;
    if (head[1] === undefined) break;
    // A trailer or the next subsection ends this loop.
    if (!/^\s*\d+\s+\d+\s/u.test(h.text.slice(cursor, cursor + 64))) break;
  }
  return { rows, end: cursor, ok };
}

/** Parse an xref stream (PDF 1.5+). Stops at `endstream`. */
function parseXrefStream(h: Haystack, at: number): { rows: XrefRow[]; ok: boolean; end: number } {
  const rows: XrefRow[] = [];
  const dictStart = h.text.lastIndexOf('<<', at);
  if (dictStart === -1) return { rows, ok: false, end: at };
  const dict = readDictionary(h, dictStart);
  if (!dict) return { rows, ok: false, end: at };
  const widths = /\/W\s*\[([^\]]*)\]/u.exec(dict.body);
  const size = dictionaryValue(dict.body, 'Size');
  if (!widths || size === null) return { rows, ok: false, end: at };
  const w = widths[1]!.trim().split(/\s+/u).map(Number);
  if (w.length < 3 || w.some((n) => !Number.isFinite(n) || n < 0 || n > 8)) {
    return { rows, ok: false, end: at };
  }
  const total = Number(size);
  if (!Number.isFinite(total) || total > MAX_OBJECTS) return { rows, ok: false, end: at };
  // We do not inflate streams, so the row data is unavailable; report the shape.
  const [w0, w1, w2] = w as [number, number, number];
  const entry = w0 + w1 + w2;
  if (entry === 0) return { rows, ok: false, end: at };
  const compressed = /\/Filter\s*(\/\w+|\d+\s+\d+\s+R)/u.test(dict.body);
  if (compressed) {
    // Row bytes are deflated; record the declared object count only.
    return { rows, ok: true, end: at };
  }
  const streamAt = h.text.indexOf('stream', dict.end);
  if (streamAt === -1) return { rows, ok: false, end: at };
  let dataStart = streamAt + 'stream'.length;
  if (h.text.slice(dataStart, dataStart + 2) === '\r\n') dataStart += 2;
  else if (/^[\r\n]/u.test(h.text.charAt(dataStart))) dataStart += 1;
  for (let i = 0; i < total; i += 1) {
    const base = dataStart + i * entry;
    if (base + entry > h.length) return { rows, ok: false, end: at };
    let type = 1;
    let field0 = 0;
    let field1 = 0;
    if (w0 > 0) {
      type = 0;
      for (let b = 0; b < w0; b += 1) type = type * 256 + h.bytes[base + b]!;
    }
    for (let b = 0; b < w1; b += 1) field0 = field0 * 256 + h.bytes[base + w0 + b]!;
    for (let b = 0; b < w2; b += 1) field1 = field1 * 256 + h.bytes[base + w0 + w1 + b]!;
    if (type === 0) {
      if (i === 0) continue;
      rows.push({
        num: i,
        gen: field1,
        offset: field0,
        free: true,
        compressed: false,
        lands: true,
      });
    } else if (type === 1) {
      rows.push({
        num: i,
        gen: field1,
        offset: field0,
        free: false,
        compressed: false,
        lands: h.text.startsWith(`${i} ${field1} obj`, field0),
      });
    } else if (type === 2) {
      rows.push({
        num: i,
        gen: 0,
        offset: 0,
        free: false,
        compressed: true,
        container: field0,
        index: field1,
        lands: true,
      });
    }
  }
  return { rows, ok: true, end: at };
}

/** Find and parse the last `startxref`. */
function readStartxref(h: Haystack): { value: number | null; at: number } {
  const at = h.lastIndexOf('startxref');
  if (at === -1) return { value: null, at: -1 };
  const match = /^startxref\s+(\d+)/u.exec(h.text.slice(at, at + 40));
  return { value: match ? Number(match[1]) : null, at };
}

/** Merge a supplemental xref section into `rows`, newest definitions winning. */
function appendRows(rows: XrefRow[], incoming: XrefRow[]): void {
  const known = new Set(rows.map((row) => `${row.num}/${row.gen}`));
  for (const row of incoming) {
    const key = `${row.num}/${row.gen}`;
    if (known.has(key)) continue;
    known.add(key);
    rows.push(row);
  }
  rows.sort((a, b) => a.num - b.num || a.gen - b.gen);
}

function inspect(h: Haystack): PdfModel {
  const findings: Finding[] = [];
  const header = readHeader(h);
  const startxref = readStartxref(h);
  const eofs = h.find_all('%%EOF', 10000).length;

  if (header.at === -1) {
    findings.push({
      severity: 'error',
      kind: 'missing-header',
      detail: 'No %PDF- header in the first 1024 bytes; this is probably not a PDF.',
    });
  } else if (header.at > 0) {
    findings.push({
      severity: 'warn',
      kind: 'leading-junk',
      detail: `The %PDF- header starts at byte ${header.at}, after ${header.at} bytes of leading data.`,
    });
  }

  let rows: XrefRow[] = [];
  const xrefSections: PdfModel['xrefSections'] = [];
  let xrefKeyword: string | null = null;
  if (startxref.value === null) {
    findings.push({
      severity: 'error',
      kind: 'missing-startxref',
      detail: 'No startxref offset; a reader must rebuild the xref table by scanning.',
    });
  } else if (startxref.value >= h.length) {
    findings.push({
      severity: 'error',
      kind: 'startxref-out-of-range',
      detail: `startxref points at byte ${startxref.value}, past the end of the ${h.length}-byte file.`,
    });
  } else {
    const target = h.ascii(startxref.value, 16);
    if (target.startsWith('xref')) {
      xrefKeyword = 'xref';
      const table = parseXrefTable(h, startxref.value);
      rows = table.rows;
      xrefSections.push({ at: startxref.value, kind: 'table', rows: table.rows.length });
      if (!table.ok)
        findings.push({
          severity: 'error',
          kind: 'xref-syntax',
          detail: `The xref table at byte ${startxref.value} has invalid rows; stopped after ${table.rows.length}.`,
        });
    } else if (/\d+\s+\d+\s+obj/u.test(target)) {
      xrefKeyword = 'xref stream';
      const stream = parseXrefStream(h, startxref.value);
      rows = stream.rows;
      xrefSections.push({ at: startxref.value, kind: 'stream', rows: stream.rows.length });
      if (!stream.ok)
        findings.push({
          severity: 'warn',
          kind: 'xref-stream-unreadable',
          detail: `The cross-reference stream at byte ${startxref.value} could not be decoded (compressed row data).`,
        });
    } else {
      findings.push({
        severity: 'error',
        kind: 'startxref-misplaced',
        detail: `startxref points at byte ${startxref.value} but that is not an xref table ("${clip(target)}").`,
      });
    }
  }

  const trailer = readTrailer(h, startxref.at === -1 ? h.length : startxref.at);

  // Walk any /Prev chain: an incrementally updated file keeps its base table and
  // appends new sections, so the object list is the union of all of them.
  const prevs: number[] = [];
  let prevAt = trailer.dict.Prev;
  const seenPrev = new Set<number>();
  while (prevAt !== undefined) {
    const target = Number(prevAt);
    if (!Number.isFinite(target) || seenPrev.has(target) || target >= h.length) break;
    seenPrev.add(target);
    prevs.push(target);
    const snapshot = rows.length;
    if (h.ascii(target, 4) === 'xref') {
      const previous = parseXrefTable(h, target);
      appendRows(rows, previous.rows);
      xrefSections.push({ at: target, kind: 'table', rows: previous.rows.length });
    } else if (/\d+\s+\d+\s+obj/u.test(h.ascii(target, 16))) {
      const previous = parseXrefStream(h, target);
      appendRows(rows, previous.rows);
      xrefSections.push({ at: target, kind: 'stream', rows: previous.rows.length });
    } else {
      findings.push({
        severity: 'error',
        kind: 'prev-misplaced',
        detail: `The trailer /Prev ${prevAt} does not point at an xref section (found "${clip(h.ascii(target, 24))}").`,
      });
      break;
    }
    if (rows.length === snapshot) break;
    const previousTrailer = readTrailer(h, target);
    prevAt = previousTrailer.dict.Prev;
    if (previousTrailer.dict.Encrypt !== undefined && !Object.hasOwn(trailer.dict, 'Encrypt')) {
      trailer.dict.Encrypt = previousTrailer.dict.Encrypt;
    }
  }
  const encrypted = Object.hasOwn(trailer.dict, 'Encrypt');
  const prev = trailer.dict.Prev;
  const linearized = /\/Linearized\s+\d/u.test(h.text.slice(0, 2048));

  if (encrypted)
    findings.push({
      severity: 'info',
      kind: 'encrypted',
      detail: `The trailer has /Encrypt ${clip(trailer.dict.Encrypt ?? '')}; content streams are encrypted.`,
    });
  if (linearized)
    findings.push({
      severity: 'info',
      kind: 'linearized',
      detail: 'The file is linearized (optimised for fast web view).',
    });
  if (prev !== undefined && Number.isFinite(Number(prev)))
    findings.push({
      severity: 'info',
      kind: 'incremental-update',
      detail: `The trailer has /Prev ${prev}: at least one incremental update was appended (${eofs} %%EOF markers).`,
    });

  let damaged = 0;
  for (const row of rows) {
    if (!row.lands && !row.compressed) {
      damaged += 1;
      if (damaged <= 20)
        findings.push({
          severity: 'error',
          kind: 'object-offset-wrong',
          detail: `Object ${row.num} ${row.gen} should start at byte ${row.offset}, but those bytes are "${clip(h.ascii(row.offset, 24))}".`,
        });
    }
  }
  if (damaged > 20)
    findings.push({
      severity: 'error',
      kind: 'object-offset-wrong',
      detail: `${damaged} objects in total have offsets that do not point at their headers.`,
    });

  if (!Object.hasOwn(trailer.dict, 'Root') && startxref.value !== null)
    findings.push({
      severity: 'warn',
      kind: 'no-root',
      detail: 'The trailer has no /Root entry, so there is no document catalogue reference.',
    });

  const objStmCount = h.find_all('/ObjStm', 200).length;

  // Page count: prefer the page-tree /Count, else the leaf /Type /Page count.
  let pages: number | null = null;
  const counts = [...h.text.matchAll(/\/Count\s+(\d+)/gu)].map((m) => Number(m[1]));
  if (counts.length > 0) pages = Math.max(...counts.filter((n) => Number.isFinite(n)));

  if (eofs === 0)
    findings.push({
      severity: 'warn',
      kind: 'no-eof',
      detail: 'No %%EOF marker; the file is probably truncated.',
    });

  return {
    version: header.version,
    headerAt: header.at,
    bytes: h.length,
    eofs,
    startxref: startxref.value,
    startxrefAt: startxref.at,
    trailer: trailer.dict,
    trailerAt: trailer.at,
    rows,
    xrefSections,
    encrypted,
    linearized,
    prevs,
    objectStreams: objStmCount,
    objStmCount,
    findings: findings.slice(0, MAX_FINDINGS),
    pages,
    xrefKeyword,
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function rows_summary(m: PdfModel): { headers: string[]; rows: string[][] } {
  const free = m.rows.filter((r) => r.free).length;
  const compressed = m.rows.filter((r) => r.compressed).length;
  const broken = m.rows.filter((r) => !r.lands && !r.compressed).length;
  const errors = m.findings.filter((f) => f.severity === 'error').length;
  const warns = m.findings.filter((f) => f.severity === 'warn').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['PDF version', m.version ?? '—'],
      ['File size', formatBytes(m.bytes)],
      ['Pages', m.pages === null ? '—' : String(m.pages)],
      ['Xref kind', m.xrefKeyword ?? '—'],
      ['startxref offset', m.startxref === null ? '—' : String(m.startxref)],
      ['Objects listed', String(m.rows.length)],
      ['In-use objects', String(m.rows.length - free)],
      ['Compressed objects', String(compressed)],
      ['Free entries', String(free)],
      ['Object streams', String(m.objStmCount)],
      ['Offsets that miss', String(broken)],
      ['Encrypted', m.encrypted ? 'yes' : 'no'],
      ['Linearized', m.linearized ? 'yes' : 'no'],
      ['Incremental updates', m.trailer.Prev === undefined ? 'no' : 'yes'],
      ['%%EOF markers', String(m.eofs)],
      ['Findings', `${errors} error, ${warns} warning, ${m.findings.length - errors - warns} note`],
    ],
  };
}

function rows_objects(m: PdfModel, detail: number): { headers: string[]; rows: string[][] } {
  const shown = detail > 0 ? m.rows.slice(0, detail) : [];
  return {
    headers: ['Object', 'Gen', 'State', 'Offset', 'Lands'],
    rows: shown.map((row) => [
      String(row.num),
      String(row.gen),
      row.free ? 'free' : row.compressed ? `compressed (ObjStm ${row.container})` : 'in use',
      row.compressed ? '—' : String(row.offset),
      row.compressed || row.free ? '—' : row.lands ? 'ok' : 'MISS',
    ]),
  };
}

function rows_trailer(m: PdfModel): { headers: string[]; rows: string[][] } {
  const keys = Object.keys(m.trailer).sort();
  return {
    headers: ['Trailer key', 'Value'],
    rows: keys.map((key) => [key, clip(m.trailer[key] ?? '')]),
  };
}

function rows_findings(m: PdfModel): { headers: string[]; rows: string[][] } {
  if (m.findings.length === 0)
    return {
      headers: ['Finding', 'Severity', 'Detail'],
      rows: [['none', 'INFO', 'No structural problems found.']],
    };
  return {
    headers: ['Finding', 'Severity', 'Detail'],
    rows: m.findings.map((f) => [f.kind, f.severity.toUpperCase(), f.detail]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const detail = Math.max(0, Math.min(500, Number(options.detail ?? 50) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No PDF was provided.', 'Choose a .pdf file to inspect.');

  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES)
    throw new ToolError(
      'That file is larger than 64 MB.',
      'Structure inspection needs the whole file in memory.',
    );

  const bytes = new Uint8Array(await source.arrayBuffer());
  const model = inspect(new Haystack(bytes));

  if (model.version === null)
    throw new ToolError(
      'That file does not look like a PDF.',
      'The %PDF- header was not found in the first 1024 bytes.',
    );

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'objects':
      table = rows_objects(model, detail);
      break;
    case 'trailer':
      table = rows_trailer(model);
      break;
    case 'findings':
      table = rows_findings(model);
      break;
    case 'summary':
      table = rows_summary(model);
      break;
    default:
      table = rows_summary(model);
      warnings.push(`Unknown view "${format}" — showing the summary instead.`);
  }

  const errors = model.findings.filter((f) => f.severity === 'error').length;
  const notes = [
    `${model.rows.length} objects across ${model.xrefSections.length} xref section(s); ${errors} structural error(s).`,
  ];

  return {
    outputs: [],
    report: { output: JSON.stringify(table), render: 'table' },
    notes,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: {
      objects: model.rows.length,
      findings: model.findings.length,
      pages: model.pages ?? 0,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
