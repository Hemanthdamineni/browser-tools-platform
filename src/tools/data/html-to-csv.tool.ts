import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-to-csv.meta';

const MAX_LEN = 1_000_000;

/** Index where the matching closing tag starts, skipping nested occurrences. */
function findClose(html: string, from: number, open: string, close: string): number {
  let depth = 1;
  let i = from;
  const re = new RegExp(open + '|<\\/' + close, 'i');
  const lower = html.toLowerCase();
  while (i < html.length) {
    const m = re.exec(lower.slice(i));
    if (!m) return -1;
    const start = i + m.index;
    i = start + m[0].length;
    if (/^<\/\s*/.test(m[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return start;
  }
  return -1;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z][a-z0-9]+));/gi, (m, hex: string, dec: string, name: string) => {
    if (hex) {
      const cp = parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
    }
    if (dec) {
      const cp = parseInt(dec, 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m;
    }
    return named[name.toLowerCase()] ?? m;
  });
}

/** Extract cell text content between matching td/th tags. */
function readCell(html: string, from: number): { text: string; next: number } {
  const lt = html.indexOf('>', from);
  const closeRe = /<\/\s*(td|th)\s*>/i;
  const m = closeRe.exec(html.slice(lt + 1));
  const end = m ? lt + 1 + m.index : html.length;
  const inner = html.slice(lt + 1, end);
  // Strip any nested table so it does not contaminate the text.
  const withoutTable = stripNestedTables(inner);
  const text = decodeEntities(stripTags(withoutTable)).replace(/[ \t\r]+/g, ' ').trim();
  return { text, next: m ? lt + 1 + m.index + m[0].length : html.length };
}

function stripNestedTables(html: string): string {
  let out = html;
  for (let i = 0; i < 8; i++) {
    const next = out.replace(/<table[\s>][\s\S]*?<\/table\s*>/gi, '');
    if (next === out) break;
    out = next;
  }
  return out;
}

function parseCells(rowHtmlRaw: string): { text: string; colspan: number; rowspan: number }[] {
  const cells: { text: string; colspan: number; rowspan: number }[] = [];
  // Nested tables never contribute cells to this row, and stripping them up
  // front keeps readCell from stopping at an inner </td>.
  const rowHtml = stripNestedTables(rowHtmlRaw);
  const re = /<(?:td|th)[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml)) !== null) {
    const openTag = m[0];
    const gt = openTag.indexOf('>');
    const attrs = gt === -1 ? '' : openTag.slice(2, gt);
    const colspan = Number((/colspan\s*=\s*["']?(\d+)/i.exec(attrs) ?? [])[1] ?? 1);
    const rowspan = Number((/rowspan\s*=\s*["']?(\d+)/i.exec(attrs) ?? [])[1] ?? 1);
    const c = readCell(rowHtml, m.index + m[0].length - 1);
    const cell = { text: c.text, colspan: Math.max(1, colspan), rowspan: Math.max(1, rowspan) };
    cells.push(cell);
    re.lastIndex = c.next;
  }
  return cells;
}

function findRowEnd(lower: string, from: number): number {
  const re = /(<table[^>]*>)|(<\/tr\s*>)/g;
  let i = from;
  const len = lower.length;
  while (i < len) {
    re.lastIndex = i;
    const m = re.exec(lower);
    if (!m) return len;
    if (m[1]) {
      const c = findClose(lower, m.index + m[1].length - 1, '<table[\\s>]', 'table');
      i = c === -1 ? len : c;
      continue;
    }
    return m.index + m[0].length;
  }
  return len;
}

function extractRows(tableHtml: string): string[] {
  const rows: string[] = [];
  const lower = tableHtml.toLowerCase();
  const re = /<tr[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    const start = m.index;
    const end = findRowEnd(lower, m.index + m[0].length);
    rows.push(tableHtml.slice(start, end));
    re.lastIndex = end;
  }
  return rows;
}

interface Table {
  rows: string[][];
}

function extractTables(html: string): Table[] {
  const tables: Table[] = [];
  const re = /<table[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const openEnd = m.index + m[0].length;
    const closeStart = findClose(html, m.index + m[0].length - 1, '<table[\\s>]', 'table');
    const end = closeStart === -1 ? html.length : closeStart;
    const inner = html.slice(openEnd, end);
    const rowsHtml = extractRows(inner);
    const cellRows = rowsHtml.map(parseCells);
    tables.push({ rows: resolveSpans(cellRows) });
    re.lastIndex = end;
  }
  return tables;
}

/** Expand colspan and rowspan into a rectangular grid of cells. */
function resolveSpans(cellRows: { text: string; colspan: number; rowspan: number }[][]): string[][] {
  const grid: string[][] = [];
  let pending = new Map<number, { remaining: number; text: string }>();
  let maxWidth = 0;

  for (const cells of cellRows) {
    const row: string[] = [];
    const nextPending = new Map<number, { remaining: number; text: string }>();

    for (const [c, p] of pending) {
      while (row.length <= c) row.push('');
      row[c] = p.text;
      if (p.remaining - 1 > 0) nextPending.set(c, { remaining: p.remaining - 1, text: p.text });
    }

    let col = 0;
    for (const cell of cells) {
      while (row.length < col + cell.colspan) row.push('');
      let free = col;
      while (row[free] !== undefined && row[free] !== '') free += 1;
      row[free] = cell.text;
      if (cell.rowspan > 1) nextPending.set(free, { remaining: cell.rowspan - 1, text: cell.text });
      col = free + cell.colspan;
    }

    maxWidth = Math.max(maxWidth, row.length);
    for (const [c] of nextPending) maxWidth = Math.max(maxWidth, c + 1);
    grid.push(row);
    pending = nextPending;
  }

  return grid.map((row) => Array.from({ length: maxWidth }, (_, i) => row[i] ?? ''));
}

function toCsv(rows: string[][]): string {
  const out: string[] = [];
  for (const row of rows) {
    out.push(row.map((cell) => (cell.includes(',') || cell.includes('"') || /\n/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell)).join(','));
  }
  return out.join('\n');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode ?? 'first');
  const skipEmptyRows = o.skipEmptyRows !== false;
  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste an HTML fragment containing a <table>.');
  if (source.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under 1,000,000 characters.');

  const tables = extractTables(source);
  const wanted = mode === 'first' ? tables.slice(0, 1) : tables;
  if (wanted.length === 0) throw new ToolError('No <table> element found in the input.', 'Paste HTML that contains a table.');

  const blocks: string[] = [];
  let tableCount = 0;
  for (const t of wanted) {
    const rows2 = skipEmptyRows
      ? t.rows.filter((r) => r.some((cell) => cell !== ''))
      : t.rows;
    if (rows2.length === 0) continue;
    blocks.push(toCsv(rows2));
    tableCount += 1;
  }
  if (blocks.length === 0) throw new ToolError('No non-empty rows found in the table(s).');

  return {
    output: blocks.join('\n\n') + '\n',
    render: 'text',
    language: 'csv',
    stats: { tables: tableCount, rows: blocks.reduce((n, b) => n + b.split('\n').length, 0) },
    notes: [
      'Exported ' + tableCount + ' table(s) from ' + (mode === 'first' ? 'the first match' : 'all matches') + '.',
      'Header row, if any, is the first <tr>.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
