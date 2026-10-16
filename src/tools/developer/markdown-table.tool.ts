import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './markdown-table.meta';

type Alignment = 'left' | 'center' | 'right';

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
      while (line[end] === '`') end++;
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

function separatorAlignment(cells: string[]): Alignment[] | null {
  const result: Alignment[] = [];
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/.test(cell)) return null;
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    result.push(left && right ? 'center' : right ? 'right' : 'left');
  }
  return result;
}

function separator(width: number, alignment: Alignment): string {
  const dashes = '-'.repeat(Math.max(3, width));
  if (alignment === 'center') return `:${dashes}:`;
  if (alignment === 'right') return `${dashes}:`;
  return `:${dashes}`;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const padding = Number(options.padding);
  if (!Number.isInteger(padding) || padding < 0 || padding > 4) {
    throw new ToolError('Cell padding must be a whole number from 0 to 4.');
  }
  if (typeof options.align !== 'boolean') throw new ToolError('Choose whether to align columns.');

  const sourceLines = input.text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (!sourceLines.length) return { output: '', render: 'code', language: 'markdown' };
  if (sourceLines.length > 5000) throw new ToolError('The table is too large.', 'Format up to 5,000 non-empty rows at a time.');

  const rows = sourceLines.map(splitRow);
  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount === 0 || columnCount > 200) throw new ToolError('The table has too many columns.', 'Format up to 200 columns.');
  for (const row of rows) while (row.length < columnCount) row.push('');

  let alignments: Alignment[] = Array(columnCount).fill('left');
  let separatorIndex = rows.length > 1 && separatorAlignment(rows[1]!) ? 1 : -1;
  if (separatorIndex >= 0) {
    const parsed = separatorAlignment(rows[separatorIndex]!);
    if (parsed) {
      alignments = Array.from({ length: columnCount }, (_, i) => parsed[i] ?? 'left');
      rows[separatorIndex] = Array(columnCount).fill('');
    }
  }

  if (!options.align) {
    return {
      output: rows.map((row, index) => {
        if (index === separatorIndex) return `| ${alignments.map((alignment) => separator(3, alignment)).join(' | ')} |`;
        return `| ${row.join(' | ')} |`;
      }).join('\n'),
      render: 'code',
      language: 'markdown',
      stats: { rows: rows.length - (separatorIndex >= 0 ? 1 : 0), columns: columnCount },
    };
  }

  const widths = Array.from({ length: columnCount }, (_, column) =>
    Math.max(3, ...rows.filter((_, index) => index !== separatorIndex).map((row) => [...row[column]!].length)),
  );
  const pad = ' '.repeat(padding);
  const output = rows.map((row, index) => {
    if (index === separatorIndex) {
      return `|${widths.map((width, column) => `${pad}${separator(width, alignments[column]!)}${pad}`).join('|')}|`;
    }
    return `|${row.map((cell, column) => `${pad}${cell.padEnd(widths[column]!, ' ')}${pad}`).join('|')}|`;
  }).join('\n');

  return {
    output,
    render: 'code',
    language: 'markdown',
    stats: { rows: rows.length - (separatorIndex >= 0 ? 1 : 0), columns: columnCount },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
