import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './vary-header.meta';

const FIELD = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
function analyze(value: string): { fields: string[]; issues: string[] } {
  const fields = value.split(',').map((field) => field.trim().toLowerCase()).filter(Boolean); const issues: string[] = [];
  if (!fields.length) issues.push('No fields were provided');
  if (fields.includes('*') && fields.length > 1) issues.push('Wildcard must not be combined with field names');
  if (fields.some((field) => !FIELD.test(field) && field !== '*')) issues.push('One or more fields are invalid header-name tokens');
  if (new Set(fields).size !== fields.length) issues.push('Duplicate fields are present');
  if (fields.includes('authorization')) issues.push('Vary does not replace private/no-store authorization cache controls');
  return { fields, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Vary mode.');
  const source = mode === 'build' ? String(options.fields) : input.text;
  const result = analyze(source);
  if (mode === 'build') {
    if (result.issues.length) throw new ToolError(result.issues[0]!);
    return { output: result.fields.join(', '), render: 'code', language: 'http', filename: 'vary.txt', stats: { fields: result.fields.length, wildcard: result.fields.includes('*') ? 'yes' : 'no' } };
  }
  if (!result.fields.length) return { output: JSON.stringify({ headers: ['Field', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste Vary field names separated by commas.'] };
  const rows = result.fields.map((field) => [field, result.issues.length ? 'Review' : 'Valid', field === '*' ? 'Wildcard disables normal shared-cache reuse' : field === 'authorization' ? 'Use explicit private/no-store policy as needed' : 'Included in cache key']);
  return { output: JSON.stringify({ headers: ['Field', 'Status', 'Assessment'], rows }), render: 'table', stats: { fields: result.fields.length, issues: result.issues.length, wildcard: result.fields.includes('*') ? 'yes' : 'no' }, notes: result.issues.length ? result.issues : ['Vary only describes cache variation; it does not authorize cache reuse.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
