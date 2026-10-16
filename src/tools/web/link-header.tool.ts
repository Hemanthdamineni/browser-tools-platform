import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './link-header.meta';

type Link = { uri: string; params: [string, string][]; issues: string[] };
function splitLinks(text: string): string[] {
  const values: string[] = []; let current = ''; let quoted = false; let angle = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (!quoted && char === '<') angle = true;
    if (!quoted && char === '>') angle = false;
    if (char === ',' && !quoted && !angle) { if (current.trim()) values.push(current.trim()); current = ''; } else current += char;
  }
  if (current.trim()) values.push(current.trim());
  return values;
}
function parseOne(value: string): Link | null {
  const match = /^\s*<([^>]*)>(.*)$/.exec(value);
  if (!match || !match[1]) return null;
  const issues: string[] = []; const params: [string, string][] = [];
  for (const piece of (match[2] ?? '').split(';').map((part) => part.trim()).filter(Boolean)) {
    const equals = piece.indexOf('=');
    if (equals <= 0) { issues.push(`Malformed parameter: ${piece}`); continue; }
    const key = piece.slice(0, equals).trim().toLowerCase(); let param = piece.slice(equals + 1).trim();
    if (param.startsWith('"') && param.endsWith('"')) param = param.slice(1, -1).replace(/\\(["\\])/g, '$1');
    params.push([key, param]);
  }
  if (!/^(?:https?:\/\/|\/|\.\/|\.\.\/|urn:)/i.test(match[1])) issues.push('URI is not an obvious absolute or relative reference');
  const rel = params.filter(([key]) => key === 'rel').flatMap(([, param]) => param.split(/\s+/));
  if (!rel.length) issues.push('Missing rel parameter');
  if (new Set(rel).size !== rel.length) issues.push('Duplicate relation token');
  return { uri: match[1], params, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'parse') throw new ToolError('Choose a supported Link header mode.');
  if (mode === 'build') {
    const uri = String(options.uri).trim(); const relation = String(options.relation).trim(); const as = String(options.as).trim(); const type = String(options.type).trim(); const crossorigin = String(options.crossorigin);
    if (!uri || /[<>\r\n]/.test(uri)) throw new ToolError('Target URI must be non-empty and contain no angle brackets or line breaks.');
    if (!/^[a-z][a-z0-9-]*$/i.test(relation)) throw new ToolError('Relation must be a space-free token such as preload or canonical.');
    if (as && !/^[a-z][a-z0-9-]*$/i.test(as)) throw new ToolError('The as parameter must be a token.');
    if (type && /[;"\r\n]/.test(type)) throw new ToolError('The type parameter contains invalid characters.');
    if (!['', 'anonymous', 'use-credentials'].includes(crossorigin)) throw new ToolError('Choose a supported crossorigin value.');
    const params = [`rel="${relation}"`, ...(as ? [`as="${as}"`] : []), ...(type ? [`type="${type}"`] : []), ...(crossorigin ? [`crossorigin="${crossorigin}"`] : [])];
    const output = `<${uri}>; ${params.join('; ')}`;
    return { output, render: 'code', language: 'http', filename: 'link-header.txt', stats: { parameters: params.length } };
  }
  const lines = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { output: JSON.stringify({ headers: ['URI', 'Parameter', 'Value', 'Issues'], rows: [] }), render: 'table', notes: ['Paste one or more Link header values.'] };
  const parsed = lines.flatMap(splitLinks).map(parseOne);
  const rows = parsed.flatMap((link, index) => link ? [[link.uri, '(target)', link.uri, link.issues.join('; ') || ''], ...link.params.map(([key, value]) => [link.uri, key, value, link.issues.join('; ') || ''])] : [[`item ${index + 1}`, '', '', 'Invalid Link value']]);
  return { output: JSON.stringify({ headers: ['URI', 'Parameter', 'Value', 'Issues'], rows }), render: 'table', stats: { links: parsed.length, invalid: parsed.filter((link) => !link).length, review: parsed.filter((link) => link?.issues.length).length }, notes: ['URI targets are not fetched or verified by this local parser.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
