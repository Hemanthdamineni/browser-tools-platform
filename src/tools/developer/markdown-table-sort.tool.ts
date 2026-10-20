import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './markdown-table-sort.meta';

const MAX_ROWS = 5000;
const MAX_COLUMNS = 200;

/** Split a pipe table line into trimmed cells, respecting escaped and inline-code pipes. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let ticks = 0;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (escaped) {
      cell += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      cell += char;
      escaped = true;
      continue;
    }
    if (char === '`') {
      let end = i + 1;
      while (line[end] === '`') end += 1;
      const length = end - i;
      ticks = ticks === 0 ? length : ticks === length ? 0 : ticks;
      cell += line.slice(i, end);
      i = end - 1;
      continue;
    }
    if (char === '|' && ticks === 0) {
      cells.push(cell);
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell);
  if (line.trimStart().startsWith('|')) cells.shift();
  if (line.trimEnd().endsWith('|') && !line.trimEnd().endsWith('\\|')) cells.pop();
  return cells.map((value) => value.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  if (!cells.length || cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/** Parse a loose numeric label: 1,200 / 2.7M / 3.5% / -4. */
function parseNumber(raw: string): number | null {
  const text = raw.trim().replace(/,/g, '');
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))(m|k|%)?$/i.exec(text);
  if (!match) return null;
  let value = Number(match[1]);
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'k') value *= 1e3;
  else if (suffix === 'm') value *= 1e6;
  else if (suffix === '%') value *= 1e-2;
  return Number.isNaN(value) ? null : value;
}

/** Locate the column index from a header text or 1-based number. */
function resolveColumn(header: string[], column: string): number {
  const text = column.trim();
  if (!text)
    throw new ToolError('Choose a column.', 'Enter a header name or a 1-based column number.');
  const byHeader = header.findIndex((cell) => cell.toLowerCase() === text.toLowerCase());
  if (byHeader >= 0) return byHeader;
  if (/^\d+$/.test(text)) {
    const index = Number(text);
    if (index >= 1 && index <= header.length) return index - 1;
  }
  throw new ToolError(
    `Unknown column "${text}".`,
    `Use a header from the first row or a number from 1 to ${header.length}.`,
  );
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const columnRef = String(o.column ?? '1').trim();
  const order = String(o.order ?? 'asc');
  const sortType = String(o.sortType ?? 'auto');
  const caseSensitive = o.caseSensitive === true;

  const lines = input.text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { output: '', render: 'code', language: 'markdown' };
  if (lines.length > MAX_ROWS) {
    throw new ToolError(
      'The table is too large.',
      `Sort up to ${MAX_ROWS} non-empty rows at a time.`,
    );
  }

  const rows = lines.map(splitRow);
  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount === 0 || columnCount > MAX_COLUMNS) {
    throw new ToolError('The table has too many columns.', `Sort up to ${MAX_COLUMNS} columns.`);
  }
  // In markdown the header always exists; a separator line at index 1 splits header from data.
  for (const row of rows) while (row.length < columnCount) row.push('');

  const hasSeparator = rows.length > 1 && isSeparatorRow(rows[1]!);
  const header = hasSeparator ? rows[0]! : [];
  const dataRows = hasSeparator ? rows.slice(2) : rows.slice(1);
  if (dataRows.length === 0)
    return { output: input.text.trim(), render: 'code', language: 'markdown' };

  // When there's no separator we can't resolve by header, but numbers still work.
  const colIndex = hasSeparator ? resolveColumn(header, columnRef) : Number(columnRef) - 1;
  if (!(colIndex >= 0 && colIndex < columnCount)) {
    throw new ToolError('Column is out of range.', `Choose a column from 1 to ${columnCount}.`);
  }

  let numeric = sortType === 'numeric';
  if (sortType === 'auto') {
    numeric = dataRows.every((row) => parseNumber(row[colIndex] ?? '') !== null);
  }

  const valueOf = (row: string[]): number | string | null => {
    const raw = row[colIndex] ?? '';
    return numeric ? parseNumber(raw) : caseSensitive ? raw : raw.toLowerCase();
  };

  const sortMultiplier = order === 'desc' ? -1 : 1;
  const sorted = dataRows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const va = valueOf(a.row);
      const vb = valueOf(b.row);
      if (numeric) {
        const na = va as number | null;
        const nb = vb as number | null;
        if (na === null && nb === null) return 0;
        if (na === null) return 1; // non-numeric values sink
        if (nb === null) return -1;
        if (na === nb) return 0;
        return (na < nb ? -1 : 1) * sortMultiplier;
      }
      const sa = String(va);
      const sb = String(vb);
      if (sa < sb) return -1 * sortMultiplier;
      if (sa > sb) return 1 * sortMultiplier;
      return 0;
    })
    .map((entry) => entry.row);

  const outputLines: string[] = [];
  if (hasSeparator) outputLines.push(lines[0]!, lines[1]!);
  else outputLines.push(lines[0] ?? '');
  for (const row of sorted) outputLines.push(`| ${row.join(' | ')} |`);

  return {
    output: outputLines.join('\n'),
    render: 'code',
    language: 'markdown',
    stats: { rows: dataRows.length, columns: columnCount, column: colIndex + 1 },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
