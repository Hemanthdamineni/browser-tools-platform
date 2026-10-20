import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './markdown-table-format.meta';

/** East Asian wide and full-width code points count as two columns (wcwidth ranges). */
const WIDE_RANGES: readonly (readonly [start: number, end: number])[] = [
  [0x1100, 0x115f],
  [0x2329, 0x232a],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

function isWide(codePoint: number): boolean {
  return WIDE_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function cellWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += isWide(ch.codePointAt(0)!) ? 2 : 1;
  }
  return width;
}

function paddedCell(cell: string, width: number, align: Align): string {
  const contentWidth = cellWidth(cell);
  const remaining = Math.max(0, width - contentWidth);
  if (align === 'right') return ' '.repeat(remaining) + cell;
  if (align === 'center') {
    const leftPad = remaining >> 1;
    return ' '.repeat(leftPad) + cell + ' '.repeat(remaining - leftPad);
  }
  return cell + ' '.repeat(remaining);
}

/** Build a divider cell whose display width matches the column width. */
function dividerCell(width: number, align: Align): string {
  if (width <= 1) return ':';
  if (align === 'left') return ':' + '-'.repeat(width - 1);
  if (align === 'right') return '-'.repeat(width - 1) + ':';
  return ':' + '-'.repeat(width - 2) + ':';
}

function renderRow(cells: string[], widths: number[], aligns: Align[], isDivider: boolean): string {
  return (
    '| ' +
    widths
      .map((width, i) => {
        const align = aligns[i] ?? 'left';
        return isDivider ? dividerCell(width, align) : paddedCell(cells[i] ?? '', width, align);
      })
      .join(' | ') +
    ' |'
  );
}

/**
 * Split a row on unescaped pipes, ignoring the leading and trailing pipes
 * that fence a Markdown table, and trimming each cell's outer whitespace.
 */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '\\' && s[i + 1] === '|') {
      current += '\\|';
      i += 1;
    } else if (ch === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** True when the line is a Markdown divider, e.g. |---|, |:--:|, | -: |, | --- | */
function isDivider(line: string): boolean {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  if (!body) return false;
  return body.split('|').every((part) => part.trim() === '' || /^:?-+:?$/.test(part.trim()));
}

type Align = 'left' | 'center' | 'right';

function alignFor(part: string): Align {
  const p = part.trim();
  const left = p.startsWith(':');
  const right = p.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const lines = input.text.split('\n');
  const output: string[] = [];
  let i = 0;
  let tables = 0;

  while (i < lines.length) {
    const headerLine = lines[i]!;
    const dividerLine = lines[i + 1];
    if (dividerLine !== undefined && isDivider(dividerLine)) {
      const header = splitRow(headerLine);
      const dividerAligns = splitRow(dividerLine).map(alignFor);
      const body: string[][] = [];
      let j = i + 2;
      while (j < lines.length) {
        const line = lines[j]!;
        if (isDivider(line)) break;
        const cells = splitRow(line);
        if (cells.length === 1 && cells[0] === '') break; // blank line ends the table
        body.push(cells);
        j += 1;
      }

      const allRows = [header, ...body];
      const numCols = Math.max(
        header.length,
        dividerAligns.length,
        ...allRows.map((r) => r.length),
      );
      const widths = Array.from({ length: numCols }, (_, c) =>
        Math.max(...allRows.map((r) => cellWidth(r[c] ?? '')), 1),
      );
      const aligns: Align[] = Array.from({ length: numCols }, (_, c) => dividerAligns[c] ?? 'left');

      output.push(renderRow(header, widths, aligns, false));
      output.push(
        renderRow(
          dividerAligns.map((a) => a),
          widths,
          aligns,
          true,
        ),
      );
      for (const row of body) output.push(renderRow(row, widths, aligns, false));

      tables += 1;
      i = j;
    } else {
      output.push(headerLine);
      i += 1;
    }
  }

  return {
    output: output.join('\n'),
    render: 'code',
    language: 'markdown',
    filename: 'formatted-table.md',
    stats: { tables, 'lines in output': output.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
