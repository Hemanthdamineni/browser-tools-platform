import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './allow-header.meta';

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const STANDARD = new Set(['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']);
function analyze(value: string): { methods: string[]; issues: string[] } {
  const methods = value.split(',').map((method) => method.trim().toUpperCase()).filter(Boolean); const issues: string[] = [];
  if (!methods.length) issues.push('No methods were provided');
  if (methods.includes('*') && methods.length > 1) issues.push('Wildcard must not be combined with method names');
  if (methods.some((method) => !TOKEN.test(method) && method !== '*')) issues.push('One or more method names are invalid tokens');
  if (new Set(methods).size !== methods.length) issues.push('Duplicate methods are present');
  if (methods.includes('GET') && !methods.includes('HEAD')) issues.push('HEAD is commonly supported alongside GET; verify whether it should be listed');
  if (methods.some((method) => !STANDARD.has(method) && method !== '*')) issues.push('One or more methods are non-standard; confirm server support');
  return { methods, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options); const mode = String(options.mode); if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Allow mode.');
  const result = analyze(mode === 'build' ? String(options.methods) : input.text);
  if (mode === 'build') { if (result.issues.some((issue) => !issue.startsWith('HEAD is commonly') && !issue.startsWith('One or more methods are non-standard'))) throw new ToolError(result.issues[0]!); return { output: result.methods.join(', '), render: 'code', language: 'http', filename: 'allow.txt', stats: { methods: result.methods.length, standard: result.methods.filter((method) => STANDARD.has(method)).length } }; }
  if (!result.methods.length) return { output: JSON.stringify({ headers: ['Method', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste comma-separated HTTP method names.'] };
  const rows = result.methods.map((method) => [method, result.issues.length ? 'Review' : 'Valid', method === '*' ? 'Wildcard method policy' : STANDARD.has(method) ? 'Standard method token' : 'Non-standard method; verify implementation']);
  return { output: JSON.stringify({ headers: ['Method', 'Status', 'Assessment'], rows }), render: 'table', stats: { methods: result.methods.length, issues: result.issues.length, standard: result.methods.filter((method) => STANDARD.has(method)).length }, notes: result.issues.length ? result.issues : ['Allow lists capability, not authorization.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
