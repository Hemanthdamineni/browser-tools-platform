import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './css-grid.meta';

const ALIGNMENTS = new Set(['stretch', 'start', 'end', 'center']);
const CSS_VALUE =
  /^(?:[a-z-]+|\d+(?:\.\d+)?(?:px|rem|em|fr|vh|vw|%|ch|vmin|vmax)|(?:repeat|minmax|fit-content|clamp)\([^;{}]+\))(?:\s+(?:[a-z-]+|\d+(?:\.\d+)?(?:px|rem|em|fr|vh|vw|%|ch|vmin|vmax)|(?:repeat|minmax|fit-content|clamp)\([^;{}]+\)))*$/i;

function validCssValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300 || /[{};]/.test(trimmed) || !CSS_VALUE.test(trimmed)) {
    throw new ToolError(
      `${field} contains unsupported CSS track syntax.`,
      'Use track values such as repeat(3, 1fr), 240px 1fr, auto, or minmax(0, 1fr).',
    );
  }
  return trimmed;
}

function validateAreas(input: string): { matrix: string[][]; names: string[] } | null {
  const lines = input
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  if (lines.length > 50) throw new ToolError('Named areas may contain at most 50 rows.');
  const matrix = lines.map((line) => line.split(/\s+/));
  const width = matrix[0]!.length;
  if (!width || width > 50 || matrix.some((row) => row.length !== width)) {
    throw new ToolError('Every named-area row must contain the same number of cells (up to 50).');
  }
  const names = [...new Set(matrix.flat().filter((name) => name !== '.'))];
  for (const name of names) {
    if (!/^[a-zA-Z_][\w-]*$/.test(name))
      throw new ToolError(
        `Invalid named area ${JSON.stringify(name)}.`,
        'Use CSS identifiers or . for empty cells.',
      );
    const positions = matrix.flatMap((row, rowIndex) =>
      row.flatMap((cell, columnIndex) => (cell === name ? [[rowIndex, columnIndex] as const] : [])),
    );
    const rows = positions.map(([row]) => row);
    const columns = positions.map(([, column]) => column);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minColumn = Math.min(...columns);
    const maxColumn = Math.max(...columns);
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        if (matrix[row]![column] !== name)
          throw new ToolError(`Named area ${JSON.stringify(name)} must form a rectangle.`);
      }
    }
  }
  return { matrix, names };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const columns = validCssValue(String(options.columns), 'Column tracks');
  const rows = validCssValue(String(options.rows), 'Row tracks');
  const gap = validCssValue(String(options.gap), 'Gap');
  const columnGap = String(options.columnGap).trim();
  const rowGap = String(options.rowGap).trim();
  if (columnGap) validCssValue(columnGap, 'Column gap');
  if (rowGap) validCssValue(rowGap, 'Row gap');
  const justifyItems = String(options.justifyItems);
  const alignItems = String(options.alignItems);
  if (!ALIGNMENTS.has(justifyItems) || !ALIGNMENTS.has(alignItems))
    throw new ToolError('Choose valid item alignment values.');
  const selector = String(options.selector).trim() || '.layout';
  if (!/^\.?[a-zA-Z_][\w-]*(?:[.#:_-][\w-]+)*$/.test(selector))
    throw new ToolError('Enter a simple CSS selector such as .layout or #app.');
  const areas = validateAreas(String(options.areas));

  const lines = [
    `${selector} {`,
    `  display: grid;`,
    `  grid-template-columns: ${columns};`,
    `  grid-template-rows: ${rows};`,
    `  gap: ${gap};`,
  ];
  if (columnGap) lines.push(`  column-gap: ${columnGap};`);
  if (rowGap) lines.push(`  row-gap: ${rowGap};`);
  lines.push(`  justify-items: ${justifyItems};`, `  align-items: ${alignItems};`);
  if (areas)
    lines.push(
      `  grid-template-areas:`,
      ...areas.matrix.map((row) => `    "${row.join(' ')}"`),
      '  ;',
    );
  lines.push('}');
  const output = lines.join('\n');
  return {
    output,
    render: 'code',
    language: 'css',
    stats: { columns: columns.length, rows: rows.length, 'named areas': areas?.names.length ?? 0 },
    notes: areas
      ? [
          `Validated ${areas.names.length} named area(s) across ${areas.matrix.length} row(s) and ${areas.matrix[0]!.length} column(s).`,
        ]
      : [],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
