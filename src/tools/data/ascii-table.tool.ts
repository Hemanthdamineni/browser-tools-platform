import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ascii-table.meta';

const MAX_LEN = 500_000;

/** Parse delimiter-separated values with double-quote support (RFC-4180-ish). */
function parseRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < len) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      if (text[i] === '\r') i += 1;
      continue;
    }
    if (ch === '\r') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

function detectDelimiter(text: string): string {
  const sample = text.slice(0, 4000);
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = -1;
  for (const c of candidates) {
    let count = 0;
    let i = 0;
    const n = sample.length;
    while (i < n) {
      const lf = sample.indexOf('\n', i);
      const lineEnd = lf === -1 ? n : lf;
      const line = sample.slice(i, lineEnd);
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === c && !inQ) count += 1;
      }
      i = lf === -1 ? n : lf + 1;
    }
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : ',';
}

function render(rows: string[][], align: 'left' | 'center' | 'right', withHeader: boolean): string {
  if (rows.length === 0) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  // Normalize each row to the column count, padding with empty cells.
  const padded = rows.map((r) => {
    const next = r.slice(0, cols);
    while (next.length < cols) next.push('');
    return next;
  });
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.max(...padded.map((r) => r[c]!.length)),
  );
  const pad = (cell: string, w: number): string => {
    if (align === 'center') {
      const diff = w - cell.length;
      const left = Math.floor(diff / 2);
      const right = Math.ceil(diff / 2);
      return ' '.repeat(left) + cell + ' '.repeat(right);
    }
    if (align === 'right') return cell.padStart(w, ' ');
    return cell.padEnd(w, ' ');
  };
  const border = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const line = (r: string[]) => '| ' + r.map((c, idx) => pad(c, widths[idx]!)).join(' | ') + ' |';

  const out: string[] = [border];
  padded.forEach((r, idx) => {
    out.push(line(r));
    if (idx === 0 && withHeader) out.push(border);
  });
  out.push(border);
  return out.join('\n');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste CSV rows to turn into an ASCII table.');
  if (source.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under 500,000 characters.');

  const delim = String(o.delimiter ?? 'auto');
  const delimiter = delim === 'auto' ? detectDelimiter(source) : delim;
  const align = String(o.align ?? 'left') as 'left' | 'center' | 'right';
  const withHeader = o.header !== false;

  let rows = parseRecords(source, delimiter);
  if (rows.length === 0) throw new ToolError('No rows found in the input.');

  const text = render(rows, align, withHeader);

  return {
    output: text + '\n',
    render: 'text',
    language: 'text',
    stats: { columns: rows[0]?.length ?? 0, rows: rows.length },
    notes: [
      'Separated by ' + (delimiter === '\t' ? 'tab' : delimiter) + ', aligned ' + align + '.',
      rows.length > 1 && withHeader ? 'First row rendered as header.' : 'No header applied.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
