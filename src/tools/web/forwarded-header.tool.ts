import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './forwarded-header.meta';

type Element = { params: [string, string][]; issues: string[] };
function splitElements(text: string): string[] { const values: string[] = []; let current = ''; let quoted = false; for (const char of text) { if (char === '"') quoted = !quoted; if (char === ',' && !quoted) { if (current.trim()) values.push(current.trim()); current = ''; } else current += char; } if (current.trim()) values.push(current.trim()); return values; }
function parseElement(raw: string): Element {
  const params: [string, string][] = []; const issues: string[] = [];
  for (const part of raw.split(';').map((value) => value.trim()).filter(Boolean)) {
    const index = part.indexOf('='); if (index <= 0) { issues.push(`Malformed parameter: ${part}`); continue; }
    const key = part.slice(0, index).trim().toLowerCase(); let value = part.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\(["\\])/g, '$1');
    if (!/^[a-z][a-z0-9-]*$/i.test(key)) issues.push(`Invalid parameter name: ${key}`);
    if (!value) issues.push(`Empty value for ${key}`);
    params.push([key, value]);
  }
  if (!params.some(([key]) => key === 'for')) issues.push('Missing required for parameter');
  if (new Set(params.map(([key]) => key)).size !== params.length) issues.push('Duplicate parameters are present');
  return { params, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'parse') throw new ToolError('Choose a supported Forwarded mode.');
  if (mode === 'build') {
    const forValue = String(options.forValue).trim(); const byValue = String(options.byValue).trim(); const host = String(options.host).trim(); const proto = String(options.proto);
    if (!forValue || /[;,\r\n]/.test(forValue)) throw new ToolError('The for value is required and cannot contain separators or line breaks.');
    if (byValue && /[;,\r\n]/.test(byValue)) throw new ToolError('The by value cannot contain separators or line breaks.');
    if (host && /[;,\r\n]/.test(host)) throw new ToolError('The host cannot contain separators or line breaks.');
    if (!['', 'http', 'https'].includes(proto)) throw new ToolError('Choose http, https, or no proto value.');
    const quote = (value: string) => /[\s";]/.test(value) ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
    const parts = [`for=${quote(forValue)}`, ...(byValue ? [`by=${quote(byValue)}`] : []), ...(host ? [`host=${quote(host)}`] : []), ...(proto ? [`proto=${proto}`] : [])];
    return { output: parts.join(';'), render: 'code', language: 'http', filename: 'forwarded.txt', stats: { parameters: parts.length } };
  }
  const values = input.text.split(/\r\n|\r|\n/).flatMap(splitElements); if (!values.length) return { output: JSON.stringify({ headers: ['Element', 'Parameter', 'Value', 'Issues'], rows: [] }), render: 'table', notes: ['Paste a Forwarded header value.'] };
  const parsed = values.map(parseElement); const rows = parsed.flatMap((element, index) => element.params.length ? element.params.map(([key, value]) => [String(index + 1), key, value, element.issues.join('; ')]) : [[String(index + 1), '', '', element.issues.join('; ') || 'Invalid element']]);
  return { output: JSON.stringify({ headers: ['Element', 'Parameter', 'Value', 'Issues'], rows }), render: 'table', stats: { elements: values.length, invalid: parsed.filter((element) => element.issues.length).length, parameters: parsed.reduce((total, element) => total + element.params.length, 0) }, notes: ['Forwarded values are only trustworthy when written and sanitized by a trusted proxy.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
