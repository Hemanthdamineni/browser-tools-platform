import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-profiler.meta';

interface CsvRow {
  cells: string[];
  quoted: boolean[];
  line: number;
}

const DELIM_MAP: Record<string, string> = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };

function parseCsv(input: string, delim: string): CsvRow[] {
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
        } else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      wasQuoted = true;
    } else if (ch === delim) {
      endCell();
    } else if (ch === '\r') {
      /* skip */
    } else if (ch === '\n') {
      endRow();
      line++;
      rowLine = line;
    } else {
      cur += ch;
    }
  }
  endRow();
  return rows;
}

type ColType = 'string' | 'integer' | 'number' | 'boolean' | 'empty';

function inferType(values: string[]): ColType {
  if (values.length === 0) return 'empty';
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (nonEmpty.length === 0) return 'empty';
  let isInteger = true,
    isNumber = true,
    isBoolean = true;
  for (const v of nonEmpty) {
    const t = v.trim();
    const lt = t.toLowerCase();
    if (lt !== 'true' && lt !== 'false') isBoolean = false;
    if (!/^-?\d+$/.test(t)) isInteger = false;
    if (!/^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(t) || !isFinite(Number(t))) isNumber = false;
  }
  if (isBoolean) return 'boolean';
  if (isInteger) return 'integer';
  if (isNumber) return 'number';
  return 'string';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const delimKey = String(o.delimiter ?? 'comma') as keyof typeof DELIM_MAP;
  const delim = DELIM_MAP[delimKey] ?? ',';
  const showNums = Boolean(o.parseNumbers);

  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError(
      'Paste a CSV file or delimited data.',
      'The first row is used as the header.',
    );
  }

  const parsed = parseCsv(text, delim);
  if (parsed.length < 2) {
    throw new ToolError(
      'At least a header row and one data row are required.',
      'Check that the input is correctly delimited.',
    );
  }

  const headerRow = parsed[0]!;
  const dataRows = parsed.slice(1);
  const colCount = Math.max(headerRow.cells.length, ...dataRows.map((r) => r.cells.length));
  const headers =
    headerRow.cells.length === colCount
      ? headerRow.cells
      : [
          ...headerRow.cells,
          ...Array.from(
            { length: colCount - headerRow.cells.length },
            (_, i) => `Column ${headerRow.cells.length + i + 1}`,
          ),
        ];

  const rows: string[][] = [];
  for (let c = 0; c < colCount; c++) {
    const values = dataRows.map((r) => r.cells[c] ?? '');
    const colType = inferType(values);
    const missing = values.filter((v) => v.trim() === '').length;
    const unique = new Set(values.filter((v) => v.trim() !== '')).size;
    const row: string[] = [
      headers[c]!,
      colType,
      String(dataRows.length),
      String(missing),
      String(unique),
    ];
    if (showNums && (colType === 'integer' || colType === 'number')) {
      const nums = values
        .map((v) => v.trim())
        .filter((v) => v !== '')
        .map((v) => Number(v))
        .filter((n) => isFinite(n));
      if (nums.length > 0) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        row.push(String(min), String(max), mean.toFixed(2));
      } else {
        row.push('', '', '');
      }
    }
    rows.push(row);
  }

  const numericCols = showNums
    ? ['Type', 'Rows', 'Missing', 'Unique', 'Min', 'Max', 'Mean']
    : ['Type', 'Rows', 'Missing', 'Unique'];

  return {
    output: JSON.stringify({ headers: numericCols, rows }),
    render: 'table',
    stats: {
      columns: colCount,
      rows: dataRows.length,
      numericCols: rows.filter((r) => r[1] === 'number' || r[1] === 'integer').length,
    },
    notes: [
      `Profiled ${colCount} column${colCount === 1 ? '' : 's'} over ${dataRows.length} data row${dataRows.length === 1 ? '' : 's'}.`,
      'Types are inferred from non-empty values; empty columns show empty type.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
