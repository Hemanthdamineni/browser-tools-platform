import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './csv-to-html.meta';

interface CsvRow { cells: string[]; quoted: boolean[]; line: number; }

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
        if (input[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        cur += ch;
      }
      continue;
    }
    if (ch === '"' && cur === '') { inQuotes = true; wasQuoted = true; }
    else if (ch === delim) { endCell(); }
    else if (ch === '\r') { /* skip carriage returns */ }
    else if (ch === '\n') { endRow(); line++; rowLine = line; }
    else { cur += ch; }
  }
  endRow();
  return rows;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MINIMAL_CSS = `table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
th{background:#f4f4f4;font-weight:600}
tbody tr:nth-child(even){background:#fafafa}`;

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const style = String(o.style ?? 'plain');
  const delimKey = String(o.delimiter ?? 'comma') as keyof typeof DELIM_MAP;
  const delim = DELIM_MAP[delimKey] ?? ',';

  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError('Paste CSV or delimited data.', 'The first row becomes the table header.');
  }

  const parsed = parseCsv(text, delim);
  if (parsed.length === 0 || parsed.every((r) => r.cells.every((c) => c.trim() === ''))) {
    throw new ToolError('No CSV rows were detected.', 'Paste at least one row of data.');
  }

  const headerCells = parsed[0]!.cells;
  const colCount = Math.max(headerCells.length, ...parsed.slice(1).map((r) => r.cells.length));
  const headers = headerCells.length === colCount
    ? headerCells
    : [...headerCells, ...Array.from({ length: colCount - headerCells.length }, (_, i) => `Column ${headerCells.length + i + 1}`)];
  const dataRows = parsed.slice(1);

  let html = '';
  if (style === 'minimal') html += `<style>${MINIMAL_CSS}</style>\n`;
  html += '<table>\n<thead>\n<tr>';
  for (const h of headers) html += `<th>${escapeHtml(h)}</th>`;
  html += '</tr>\n</thead>\n<tbody>\n';
  for (const row of dataRows) {
    html += '<tr>';
    for (let c = 0; c < colCount; c++) {
      const cell = row.cells[c] ?? '';
      html += `<td>${escapeHtml(cell)}</td>`;
    }
    html += '</tr>\n';
  }
  html += '</tbody>\n</table>\n';

  return {
    output: html,
    render: 'code',
    stats: { rows: dataRows.length, columns: colCount },
    notes: [
      `${dataRows.length} data row${dataRows.length === 1 ? '' : 's'} and ${colCount} column${colCount === 1 ? '' : 's'}.`,
      style === 'minimal' ? 'Inline CSS added: borders, padding, striping.' : 'Plain table output.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
