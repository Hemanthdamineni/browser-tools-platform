import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-to-markdown.meta';

interface CsvRow {
  cells: string[];
  quoted: boolean[];
  line: number;
}

/** RFC 4180 parser: comma separated, double-quote quoting, doubled quotes inside. */
function parseCsv(input: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let quoted: boolean[] = [];
  let cur = '';
  let wasQuoted = false;
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  const endCell = () => {
    cells.push(cur);
    quoted.push(wasQuoted);
    cur = '';
    wasQuoted = false;
  };
  const endRow = () => {
    endCell();
    const blank = cells.length === 1 && cells[0] === '' && quoted[0] === false;
    if (!blank) rows.push({ cells, quoted, line: rowLine });
    cells = [];
    quoted = [];
    rowLine = line;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      wasQuoted = true;
    } else if (ch === ',') {
      endCell();
    } else if (ch === '\r') {
      // ignore; newline handles it
    } else if (ch === '\n') {
      endRow();
      line++;
      rowLine = line;
    } else {
      cur += ch;
    }
  }
  if (inQuotes) {
    throw new ToolError('Unterminated quoted field in the CSV.', 'Every opening double quote needs a closing quote.');
  }
  if (cur !== '' || cells.length > 0) endRow();
  return rows;
}

const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function escapeCell(cell: string): string {
  return cell.replace(/\|/g, '\\|').replace(/\r|\n/g, ' ');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const justify = String(o.justify) as 'auto' | 'left' | 'center' | 'right' | 'none';

  const text = (input.text ?? '').trim();
  if (!text) throw new ToolError('Paste a CSV table to convert.', 'The first row is treated as the header by default.');

  const rows = parseCsv(text);
  if (rows.length === 0) throw new ToolError('No CSV rows were found.', 'Check that the input is non-empty.');

  const hasHeader = o.header !== false;
  const width = rows[0]!.cells.length;
  if (width === 0) throw new ToolError('The CSV has no columns.', 'Add at least one column.');

  if (hasHeader) {
    if (rows.length === 1) throw new ToolError('The CSV has a header but no data rows.', 'Add at least one data row.');
  }

  for (const row of rows) {
    if (row.cells.length !== width) {
      throw new ToolError(`Row ${row.line} has ${row.cells.length} fields but the table has ${width}.`, 'Every row must have the same number of fields as the header.');
    }
  }

  const start = hasHeader ? 1 : 0;
  const headerCells = hasHeader ? rows[0]!.cells : [];
  const dataRows = rows.slice(start);

  const table: string[] = [];
  if (hasHeader) table.push(`| ${headerCells.map(escapeCell).join(' | ')} |`);

  // Alignment separator row.
  if (justify !== 'none') {
    const separators: string[] = [];
    for (let c = 0; c < width; c++) {
      const numeric = justify === 'auto' && dataRows.every((r) => r.cells[c] === '' || NUMERIC.test(r.cells[c]!));
      const token = justify === 'left' ? '---' : justify === 'center' ? ':---:' : justify === 'right' ? '---:' : justify === 'auto' ? (numeric ? '---:' : '---') : '---';
      separators.push(token);
    }
    table.push(`| ${separators.join(' | ')} |`);
  }

  for (const row of dataRows) {
    table.push(`| ${row.cells.map(escapeCell).join(' | ')} |`);
  }

  const output = table.join('\n') + '\n';
  const notes: string[] = [];
  notes.push(`Converted ${dataRows.length} data row${dataRows.length === 1 ? '' : 's'} across ${width} column${width === 1 ? '' : 's'} to a Markdown table.`);
  if (justify === 'none') notes.push('Alignment row omitted.');
  else if (justify === 'auto') notes.push('Columns whose values are all numeric are right-aligned (:---:); others left-aligned.');
  else if (justify === 'right') notes.push('All columns right-aligned (---:).');
  else if (justify === 'center') notes.push('All columns center-aligned (:---:).');
  else notes.push('All columns left-aligned (---).');
  if (justify !== 'auto') notes.push('Alignment is fixed per column choice, not auto-detected.');

  return {
    output,
    render: 'code',
    stats: { rows: dataRows.length, columns: width },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
