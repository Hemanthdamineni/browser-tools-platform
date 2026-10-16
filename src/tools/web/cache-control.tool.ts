import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cache-control.meta';

type Directive = { name: string; value?: string };
const TOKEN = /^[a-z][a-z0-9-]*$/i;

function parse(text: string): { directives: Directive[]; issues: string[] } {
  const directives: Directive[] = [];
  const issues: string[] = [];
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const equals = part.indexOf('=');
    const name = (equals < 0 ? part : part.slice(0, equals)).trim().toLowerCase();
    const value = equals < 0 ? undefined : part.slice(equals + 1).trim();
    if (!TOKEN.test(name)) { issues.push(`Invalid directive name: ${name}`); continue; }
    if (value !== undefined && !/^\d+$/.test(value) && !/^"[^"\r\n]*"$/.test(value)) issues.push(`Invalid value for ${name}`);
    directives.push({ name, ...(value !== undefined ? { value } : {}) });
  }
  const names = directives.map((directive) => directive.name);
  const has = (name: string) => names.includes(name);
  if (has('no-store') && (has('public') || has('max-age') || has('s-maxage'))) issues.push('no-store conflicts with cache lifetime directives');
  if (has('private') && has('public')) issues.push('private and public are contradictory');
  if (has('immutable') && !has('max-age') && !has('s-maxage')) issues.push('immutable is most useful with a positive freshness lifetime');
  if (new Set(names).size !== names.length) issues.push('Duplicate directives are present');
  return { directives, issues };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Cache-Control mode.');
  if (mode === 'build') {
    const maxAge = Number(options.maxAge); const sMaxAge = Number(options.sMaxAge); const stale = Number(options.staleWhileRevalidate);
    if (![maxAge, sMaxAge, stale].every((value) => Number.isInteger(value) && value >= 0)) throw new ToolError('Cache lifetimes must be non-negative whole numbers.');
    const visibility = String(options.visibility);
    if (!['public', 'private'].includes(visibility)) throw new ToolError('Choose public or private visibility.');
    const directives: string[] = [visibility];
    if (options.noStore) directives.push('no-store');
    if (options.noCache) directives.push('no-cache');
    if (maxAge > 0) directives.push(`max-age=${maxAge}`);
    if (sMaxAge > 0) directives.push(`s-maxage=${sMaxAge}`);
    if (options.mustRevalidate) directives.push('must-revalidate');
    if (options.immutable) directives.push('immutable');
    if (stale > 0) directives.push(`stale-while-revalidate=${stale}`);
    const result = parse(directives.join(', '));
    return { output: directives.join(', '), render: 'code', language: 'http', filename: 'cache-control.txt', stats: { directives: directives.length, issues: result.issues.length }, notes: ['Header semantics depend on response content, authorization, and cache topology.'] };
  }
  if (input.text.length > 100_000) throw new ToolError('Header input is too large.', 'Paste a Cache-Control value under 100 KB.');
  const lines = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { output: JSON.stringify({ headers: ['Directive', 'Value', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste a Cache-Control value to analyze.'] };
  const results = lines.map((line) => parse(line));
  const rows = results.flatMap((result, index) => result.directives.length ? result.directives.map((directive) => [directive.name, directive.value ?? '', result.issues.join('; ') || 'No local issues detected']) : [[`line ${index + 1}`, '', result.issues.join('; ') || 'No directives found']]);
  return { output: JSON.stringify({ headers: ['Directive', 'Value', 'Assessment'], rows }), render: 'table', stats: { headers: lines.length, issues: results.reduce((count, result) => count + result.issues.length, 0) }, notes: ['This is a local heuristic review; it cannot determine whether your response content is safe to cache.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
