import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-to-yaml.meta';

interface CsvRow {
  cells: string[];
  quoted: boolean[];
  line: number;
}

// RFC 4180 parser: doubled "" escapes, newlines inside quotes, blank rows skipped.
function parseCsv(input: string, delim: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let quoted: boolean[] = [];
  let cur = '';
  let wasQuoted = false;
  let inQuotes = false;
  let line = 1;
  let startLine = 1;

  const endCell = (): void => {
    cells.push(cur);
    quoted.push(wasQuoted);
    cur = '';
    wasQuoted = false;
  };
  const endRow = (): void => {
    endCell();
    const blank = cells.length === 1 && cells[0] === '' && quoted[0] === false;
    if (!blank) rows.push({ cells, quoted, line: startLine });
    cells = [];
    quoted = [];
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
    if (ch === '"' && cur === '') {
      inQuotes = true;
      wasQuoted = true;
    } else if (ch === delim) {
      endCell();
    } else if (ch === '\n') {
      endRow();
      line++;
      startLine = line;
    } else if (ch === '\r') {
      // ignore
    } else {
      cur += ch;
    }
  }
  endRow();
  return rows;
}

const KEYWORD_MINIMAL = /^(?:true|false|null|~|yes|no|on|off)$/i;
const NUMBERISH = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const HEXISH = /^0x[0-9a-fA-F]+$/;

function needsQuotes(raw: string): boolean {
  if (raw === '') return true;
  if (KEYWORD_MINIMAL.test(raw) || NUMBERISH.test(raw) || HEXISH.test(raw)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(raw)) return true;
  if (/-(?:\s|$)/.test(raw) || /\?(?:\s|$)/.test(raw)) return true;
  if (/:\s/.test(raw) || /\s#/.test(raw) || /^\s|\s$/.test(raw)) return true;
  if (/[\n\r\t]/.test(raw)) return true;
  return false;
}

function quoteString(raw: string): string {
  const escaped = raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

function scalar(raw: string, wasQuoted: boolean): string {
  if (wasQuoted) return raw === '' ? '""' : quoteString(raw);
  if (raw === '') return 'null';
  if (/^(?:true|false)$/i.test(raw)) {
    return raw.toLowerCase() === 'true' ? 'true' : 'false';
  }
  if (NUMBERISH.test(raw)) {
    const num = Number(raw);
    return Number.isFinite(num) ? String(num) : raw;
  }
  return needsQuotes(raw) ? quoteString(raw) : raw;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const delim = String(o.delimiter ?? ',') || ',';
  const header = o.header !== false;
  const source = input.text ?? '';

  if (!source.trim()) {
    throw new ToolError('Paste a CSV table to convert.', 'Example: name,age\\nteam,2');
  }
  if (source.length > 2_000_000) {
    throw new ToolError('The CSV is too large.', 'Keep it under 2,000,000 characters.');
  }

  const rows = parseCsv(source, delim);
  if (!rows.length) throw new ToolError('No data rows found in the CSV.');
  const width = Math.max(...rows.map((row) => row.cells.length));

  const keys: string[] = [];
  if (header) {
    const used = new Set<string>();
    rows[0]!.cells.forEach((cell, i) => {
      let base = cell.trim();
      if (base === '') base = `column_${i + 1}`;
      let candidate = base;
      let n = 2;
      while (used.has(candidate)) candidate = `${base}_${n++}`;
      used.add(candidate);
      keys.push(candidate);
    });
  } else {
    for (let i = 0; i < width; i++) keys.push(`column_${i + 1}`);
  }

  for (const key of keys) {
    if (key.length > 1000)
      throw new ToolError(
        'A header name is unreasonably long.',
        'Check for a missing newline between rows.',
      );
  }

  const dataRows = header ? rows.slice(1) : rows;
  if (!dataRows.length)
    throw new ToolError(
      'The CSV has a header but no data rows.',
      'Add at least one row below the header.',
    );
  if (dataRows.length > 50_000) {
    throw new ToolError('Too many rows.', 'The generator is capped at 50,000 rows.');
  }

  const lines: string[] = [];
  let cellCount = 0;
  for (const row of dataRows) {
    lines.push(
      '- ' +
        (keys[0]
          ? `${safeKey(keys[0])}: ${scalar(row.cells[0] ?? '', row.quoted[0] ?? false)}`
          : '{}'),
    );
    for (let i = 1; i < keys.length; i++) {
      const cellValue = row.cells[i] ?? '';
      const cellQuoted = row.quoted[i] ?? false;
      lines.push(`  ${safeKey(keys[i]!)}: ${scalar(cellValue, cellQuoted)}`);
      cellCount += 1;
    }
    for (let i = keys.length; i < row.cells.length; i++) {
      lines.push(`  _unmapped_${i + 1}: ${scalar(row.cells[i] ?? '', row.quoted[i] ?? false)}`);
    }
  }

  return {
    output: lines.join('\n') + '\n',
    render: 'code',
    language: 'yaml',
    stats: { records: dataRows.length, columns: keys.length, cells: cellCount + dataRows.length },
    notes: [
      `Converted ${dataRows.length} record(s) × ${keys.length} column(s) from ${delim === '\t' ? 'tab' : delim === '|' ? `pipe` : `"${delim}"`}-delimited CSV.`,
    ],
  };
}

function safeKey(raw: string): string {
  return needsQuotes(raw) ? quoteString(raw) : raw;
}

const tool: TextToolModule = { meta, run };
export default tool;
