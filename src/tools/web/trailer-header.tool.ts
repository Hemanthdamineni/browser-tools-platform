import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './trailer-header.meta';

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const FORBIDDEN = new Set(['authorization', 'content-length', 'content-type', 'host', 'trailer', 'transfer-encoding', 'www-authenticate', 'content-encoding', 'content-range']);
function inspect(value: string): { fields: string[]; issues: string[] } {
  const fields = value.split(',').map((field) => field.trim().toLowerCase()).filter(Boolean); const issues: string[] = [];
  if (!fields.length) issues.push('No trailer field names were provided');
  if (fields.some((field) => !TOKEN.test(field))) issues.push('One or more field names are invalid HTTP tokens');
  if (new Set(fields).size !== fields.length) issues.push('Duplicate trailer field names are present');
  if (fields.some((field) => FORBIDDEN.has(field))) issues.push('One or more fields are not permitted in trailers');
  return { fields, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Trailer mode.');
  const result = inspect(mode === 'build' ? String(options.fields) : input.text);
  if (mode === 'build') { if (result.issues.length) throw new ToolError(result.issues[0]!); return { output: result.fields.join(', '), render: 'code', language: 'http', filename: 'trailer.txt', stats: { fields: result.fields.length } }; }
  if (!result.fields.length) return { output: JSON.stringify({ headers: ['Field', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste comma-separated trailer field names.'] };
  const rows = result.fields.map((field) => [field, result.issues.length ? 'Review' : 'Valid', FORBIDDEN.has(field) ? 'Forbidden trailer field' : 'Field-name token']);
  return { output: JSON.stringify({ headers: ['Field', 'Status', 'Assessment'], rows }), render: 'table', stats: { fields: result.fields.length, issues: result.issues.length, forbidden: result.fields.filter((field) => FORBIDDEN.has(field)).length }, notes: result.issues.length ? result.issues : ['Trailer declares names only; trailing values are sent separately after the message body.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
