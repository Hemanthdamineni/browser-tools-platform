import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-html-table.meta';

const MAX_LEN = 1_000_000;

function esc(text: string, enabled: boolean): string {
  if (!enabled) return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function formatCell(value: unknown, prettyNested: boolean): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return JSON.stringify(value, null, prettyNested ? 2 : 0);
  }
  return String(value);
}

function themeClasses(theme: string): string {
  if (theme === 'zebra') return ' class="zebra"';
  if (theme === 'bordered') return ' class="bordered"';
  return '';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const theme = String(o.theme ?? 'plain');
  const prettyNested = o.nestedCells !== false;
  const escape = o.escape !== false;

  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste a JSON array to render as a table.');
  if (source.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under 1,000,000 characters.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new ToolError('That is not valid JSON.', 'Fix the document and try again.');
  }
  if (!Array.isArray(parsed)) {
    throw new ToolError('Expected a JSON array.', 'Example: [{ "name": "Ada" }]');
  }
  if (parsed.length === 0) throw new ToolError('The array is empty — nothing to render.');

  const cell = (v: unknown): string => esc(formatCell(v, prettyNested), escape);
  const header = (v: unknown): string => esc(String(v), escape);

  const isObjectRows = parsed.every((r) => isPlainObject(r));
  let headers: string[] = [];
  let rows: unknown[][];

  if (isObjectRows) {
    const seen = new Set<string>();
    for (const row of parsed as Array<Record<string, unknown>>) {
      for (const k of Object.keys(row))
        if (!seen.has(k)) {
          seen.add(k);
          headers.push(k);
        }
    }
    rows = (parsed as Array<Record<string, unknown>>).map((row) => headers.map((h) => row[h]));
  } else {
    const rawRows = (parsed as unknown[][]).map((r) => (Array.isArray(r) ? r : [r]));
    if (rawRows.every((r) => r.length === 0))
      throw new ToolError('The rows are empty — nothing to render.');
    const width = Math.max(...rawRows.map((r) => r.length));
    const first = rawRows[0]!.map((v) => String(v));
    // Treat the first row as the header when it holds more than one cell or differs from others.
    const treatAsHeader =
      rawRows.length > 1 && rawRows.every((r) => r.length === width) && first.length > 1;
    if (treatAsHeader) {
      headers = first;
      rows = rawRows.slice(1).map((r) => {
        const padded = [...r];
        while (padded.length < width) padded.push('');
        return padded;
      });
    } else {
      headers = Array.from({ length: width }, (_, i) => String(i + 1));
      rows = rawRows;
    }
  }

  const thead =
    '  <thead><tr>' + headers.map((h) => '<th>' + header(h) + '</th>').join('') + '</tr></thead>\n';
  const tbody =
    '  <tbody>\n' +
    rows
      .map((r) => '    <tr>' + r.map((v) => '<td>' + cell(v) + '</td>').join('') + '</tr>')
      .join('\n') +
    '\n  </tbody>\n';

  const output = '<table' + themeClasses(theme) + '>\n' + thead + tbody + '</table>\n';
  return {
    output,
    render: 'code',
    language: 'html',
    stats: { rows: rows.length, columns: headers.length },
    notes: escape
      ? ['Cell text is HTML-escaped.', 'Drop the theme class if you style the table yourself.']
      : ['Escaping is off — paste only trusted values.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
