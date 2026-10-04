import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-transpose.meta';

const DELIMS: Record<string, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};

function sniff(text: string): string {
  const firstRecord = text.split(/[\r\n]/, 1)[0] ?? '';
  let selected = ',';
  let maxCount = 0;
  for (const delimiter of [',', ';', '\t', '|']) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstRecord.length; i++) {
      const ch = firstRecord[i]!;
      if (ch === '"') {
        if (quoted && firstRecord[i + 1] === '"') i += 1;
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        count += 1;
      }
    }
    if (count > maxCount) {
      maxCount = count;
      selected = delimiter;
    }
  }
  return selected;
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (afterQuote) {
      if (ch === delimiter) {
        row.push(field);
        field = '';
        afterQuote = false;
      } else if (ch === '\r' || ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        afterQuote = false;
        if (ch === '\r' && text[i + 1] === '\n') i += 1;
      } else if (ch === ' ' || ch === '\t') {
        // Permit whitespace between a closing quote and the next separator.
      } else {
        throw new ToolError(
          'Unexpected character after a quoted field.',
          'Only whitespace, a delimiter, or a line break may follow a closing quote.',
        );
      }
      continue;
    }

    if (ch === '"') {
      if (field.length !== 0) {
        throw new ToolError('Unexpected quote in an unquoted field.', 'Quote the entire field.');
      }
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
    } else {
      field += ch;
    }
  }

  if (quoted) {
    throw new ToolError(
      'Unterminated quoted field in delimited data.',
      'A double quote was opened but never closed.',
    );
  }
  if (row.length > 0 || field.length > 0 || afterQuote || text.endsWith(delimiter)) {
    row.push(field);
    rows.push(row);
  }
  if (text.endsWith('\n') || text.endsWith('\r')) {
    const last = rows[rows.length - 1];
    if (last?.length === 1 && last[0] === '') rows.pop();
  }
  return rows;
}

function escapeField(value: string, delimiter: string): string {
  return /["\r\n]/.test(value) || value.includes(delimiter) || /^\s|\s$/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const delimiterName = String(options.delimiter);
  const delimiter = delimiterName === 'auto' ? sniff(input.text) : (DELIMS[delimiterName] ?? ',');
  const rows = parseDelimited(input.text, delimiter);
  if (rows.length === 0) return { output: '' };

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const transposed = Array.from({ length: columnCount }, (_, column) =>
    rows.map((row) => row[column] ?? ''),
  );
  const output = transposed
    .map((row) => row.map((value) => escapeField(value, delimiter)).join(delimiter))
    .join('\n');

  return {
    output,
    render: 'code',
    language: 'csv',
    filename: 'transposed.csv',
    stats: { rows: transposed.length, columns: rows.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
