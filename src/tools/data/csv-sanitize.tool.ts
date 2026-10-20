import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-sanitize.meta';

type Cell = { value: string; quoted: boolean };
type Row = Cell[];

const DELIMITERS: Record<string, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};

function parseCsv(text: string, delimiter: string): Row[] {
  const rows: Row[] = [];
  let row: Row = [];
  let value = '';
  let quoted = false;
  let inQuotes = false;
  let afterQuote = false;
  let atStart = true;

  const pushCell = () => {
    row.push({ value, quoted });
    value = '';
    quoted = false;
    atStart = true;
    afterQuote = false;
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        value += ch;
      }
      continue;
    }

    if (afterQuote) {
      if (ch === delimiter) {
        pushCell();
      } else if (ch === '\r' || ch === '\n') {
        pushRow();
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else if (ch === ' ' || ch === '\t') {
        value += ch;
      } else {
        throw new ToolError(
          'Unexpected character after a closing CSV quote.',
          `At character ${i + 1}.`,
        );
      }
      continue;
    }

    if (ch === delimiter) {
      pushCell();
    } else if (ch === '\r' || ch === '\n') {
      pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else if (ch === '"') {
      if (!atStart || value.length > 0) {
        throw new ToolError(
          'Unexpected quote inside an unquoted CSV field.',
          `At character ${i + 1}.`,
        );
      }
      inQuotes = true;
      quoted = true;
      atStart = false;
    } else {
      value += ch;
      atStart = false;
    }
  }

  if (inQuotes)
    throw new ToolError(
      'Unterminated quoted CSV field.',
      'A quoted field was opened but never closed.',
    );
  if (row.length || value.length || quoted || afterQuote) pushRow();
  else if (rows.length === 0 && text.length === 0) return [];

  if (rows.length > 1 && rows.at(-1)!.length === 1 && rows.at(-1)![0]!.value === '') {
    rows.pop();
  }
  return rows;
}

function isRisky(value: string, trimLeadingWhitespace: boolean): boolean {
  const candidate = trimLeadingWhitespace ? value.replace(/^[\s\p{Cc}\p{Cf}]+/u, '') : value;
  return /^[=+\-@]/u.test(candidate);
}

function encodeCell(cell: Cell, delimiter: string): string {
  const value = cell.value;
  if (cell.quoted || value.includes(delimiter) || /["\r\n]/u.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  if (!input.text) return { output: '', render: 'code', language: 'csv' };

  const delimiterKey = String(options.delimiter);
  const delimiter = DELIMITERS[delimiterKey];
  if (!delimiter) throw new ToolError('Choose a supported CSV delimiter.');
  const mode = String(options.mode);
  if (mode !== 'sanitize' && mode !== 'report') throw new ToolError('Choose a valid action.');

  const rows = parseCsv(input.text, delimiter);
  const flagged: { row: number; column: number; value: string }[] = [];
  let changed = 0;
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (isRisky(cell.value, Boolean(options.trimLeadingWhitespace))) {
        flagged.push({ row: rowIndex + 1, column: columnIndex + 1, value: cell.value });
        if (mode === 'sanitize') {
          cell.value = `'${cell.value}`;
          changed++;
        }
      }
    });
  });

  if (mode === 'report') {
    const reportRows = flagged.map((item) => [String(item.row), String(item.column), item.value]);
    return {
      output: JSON.stringify({ headers: ['Row', 'Column', 'Cell value'], rows: reportRows }),
      render: 'table',
      stats: { 'risky cells': flagged.length },
      notes: flagged.length ? undefined : ['No formula-leading cells detected.'],
    };
  }

  const output = rows
    .map((row) => row.map((cell) => encodeCell(cell, delimiter)).join(delimiter))
    .join('\r\n');
  return {
    output,
    render: 'code',
    language: 'csv',
    filename: 'sanitized.csv',
    stats: { rows: rows.length, 'risky cells': flagged.length, 'cells protected': changed },
    notes: flagged.length
      ? [
          'A protective apostrophe was prefixed to flagged values. Confirm behavior in your target spreadsheet application.',
        ]
      : ['No formula-leading cells detected.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
