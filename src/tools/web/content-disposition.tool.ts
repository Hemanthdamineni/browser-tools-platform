import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './content-disposition.meta';

type Parsed = { disposition: string; parameters: [string, string][]; issues: string[] };

function quote(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, '')}"`;
}
function asciiFallback(value: string): string {
  const fallback = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\;]/g, '_')
    .trim();
  return fallback || 'download';
}
function parse(line: string): Parsed | null {
  const parts = line
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const disposition = parts.shift()?.toLowerCase();
  if (!disposition || !/^[a-z][a-z0-9-]*$/.test(disposition)) return null;
  const parameters: [string, string][] = [];
  const issues: string[] = [];
  for (const part of parts) {
    const index = part.indexOf('=');
    if (index <= 0) {
      issues.push(`Malformed parameter: ${part}`);
      continue;
    }
    const key = part.slice(0, index).trim().toLowerCase();
    let value = part.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"'))
      value = value.slice(1, -1).replace(/\\(["\\])/g, '$1');
    parameters.push([key, value]);
    if (!/^[a-z][a-z0-9!*+._-]*$/.test(key)) issues.push(`Invalid parameter name: ${key}`);
  }
  if (!['inline', 'attachment', 'form-data'].includes(disposition))
    issues.push(`Uncommon disposition type: ${disposition}`);
  if (parameters.filter(([key]) => key === 'filename').length > 1)
    issues.push('Duplicate filename parameter');
  if (parameters.some(([key, value]) => key === 'filename' && /[\\/]/.test(value)))
    issues.push('Filename contains path separators; sanitize it server-side');
  return { disposition, parameters, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'parse')
    throw new ToolError('Choose a supported Content-Disposition mode.');
  if (mode === 'build') {
    const disposition = String(options.disposition);
    const filename = String(options.filename);
    if (!['inline', 'attachment'].includes(disposition))
      throw new ToolError('Choose inline or attachment.');
    if (!filename.trim() || /[\r\n]/.test(filename) || filename.length > 1000)
      throw new ToolError(
        'Filename must be non-empty, under 1,000 characters, and contain no line breaks.',
      );
    const fallback = asciiFallback(filename);
    const encoded = encodeURIComponent(filename).replace(
      /['()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    const output = `${disposition}; filename=${quote(fallback)}; filename*=UTF-8''${encoded}`;
    return {
      output,
      render: 'code',
      language: 'http',
      filename: 'content-disposition.txt',
      stats: { disposition, 'unicode filename': fallback !== filename ? 'yes' : 'no' },
      notes: [
        'Sanitize and authorize filenames on the server; this header is only a client-facing hint.',
      ],
    };
  }
  const lines = input.text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length)
    return {
      output: JSON.stringify({
        headers: ['Disposition', 'Parameter', 'Value', 'Issues'],
        rows: [],
      }),
      render: 'table',
      notes: ['Paste one Content-Disposition header per line.'],
    };
  const parsed = lines.map(parse);
  const rows = parsed.flatMap((item, line) =>
    item
      ? [
          [item.disposition, '(type)', item.disposition, item.issues.join('; ') || ''],
          ...item.parameters.map(([key, value]) => [
            item.disposition,
            key,
            value,
            item.issues.join('; ') || '',
          ]),
        ]
      : [[`Line ${line + 1}`, '', '', 'Invalid header']],
  );
  return {
    output: JSON.stringify({ headers: ['Disposition', 'Parameter', 'Value', 'Issues'], rows }),
    render: 'table',
    stats: {
      headers: lines.length,
      invalid: parsed.filter((item) => !item).length,
      review: parsed.filter((item) => item?.issues.length).length,
    },
    notes: [
      'Parsing is local. Treat filenames as untrusted client hints and sanitize them server-side.',
    ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
