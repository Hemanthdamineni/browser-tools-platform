import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './document-policy.meta';

const TOKEN = /^[a-z][a-z0-9-]*$/;
function splitDirectives(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (char === ',' && !quoted) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}
function inspect(text: string): { directives: [string, string][]; issues: string[] } {
  const directives: [string, string][] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const part of splitDirectives(text)) {
    const index = part.indexOf('=');
    if (index <= 0) {
      issues.push(`Malformed document directive: ${part}`);
      continue;
    }
    const name = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (!TOKEN.test(name)) issues.push(`Invalid directive token: ${name}`);
    if (seen.has(name)) issues.push(`Duplicate directive: ${name}`);
    seen.add(name);
    if (!value.startsWith('(') || !value.endsWith(')'))
      issues.push(`${name} must use parenthesized policy syntax`);
    if (/^\(\d+\)$/.test(value) && Number(value.slice(1, -1)) > 1000)
      issues.push(`${name} threshold is unusually high; verify the intended units`);
    directives.push([name, value]);
  }
  return { directives, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Document-Policy mode.');
  const value = mode === 'build' ? String(options.directives) : input.text;
  const result = inspect(value);
  if (mode === 'build') {
    if (!result.directives.length || result.issues.length)
      throw new ToolError(result.issues[0] ?? 'Enter at least one document policy directive.');
    return {
      output: result.directives
        .map(([name, directiveValue]) => `${name}=${directiveValue}`)
        .join(', '),
      render: 'code',
      language: 'http',
      filename: 'document-policy.txt',
      stats: { directives: result.directives.length },
    };
  }
  if (!value.trim())
    return {
      output: JSON.stringify({ headers: ['Directive', 'Value', 'Status'], rows: [] }),
      render: 'table',
      notes: ['Paste comma-separated Document-Policy directives.'],
    };
  const rows = result.directives.map(([name, directiveValue]) => [
    name,
    directiveValue,
    result.issues.length ? 'Review' : 'Valid',
  ]);
  return {
    output: JSON.stringify({ headers: ['Directive', 'Value', 'Status'], rows }),
    render: 'table',
    stats: { directives: result.directives.length, issues: result.issues.length },
    notes: result.issues.length
      ? result.issues
      : [
          'Document-Policy support and directive semantics vary; test before enforcing behavior changes in production.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
