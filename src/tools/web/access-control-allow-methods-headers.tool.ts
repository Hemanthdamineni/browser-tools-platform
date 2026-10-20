import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './access-control-allow-methods-headers.meta';

const METHOD_RE = /^[A-Za-z][A-Za-z0-9-]*$/;
const HEADER_RE = /^[A-Za-z0-9-]+(\*)?$/;
function splitList(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
function validateList(items: string[], kind: 'method' | 'header'): string[] {
  const issues: string[] = [];
  for (const item of items)
    if (item !== '*') {
      if (kind === 'method' ? !METHOD_RE.test(item) : !HEADER_RE.test(item))
        issues.push(`Invalid ${kind === 'method' ? 'method' : 'header'} token: ${item}`);
    }
  if (new Set(items).size !== items.length) issues.push(`Duplicate ${kind} tokens are present`);
  if (items.includes('*') && items.length > 1)
    issues.push(`The * wildcard makes other ${kind} tokens redundant`);
  return issues;
}
function inspectText(text: string): { methods: string[]; headers: string[]; issues: string[] } {
  const issues: string[] = [];
  let methods: string[] = [];
  let headers: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf(':');
    if (eq < 1) {
      issues.push(`Malformed line: ${trimmed}`);
      continue;
    }
    const name = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();
    if (name === 'access-control-allow-methods') methods = splitList(value);
    else if (name === 'access-control-allow-headers') headers = splitList(value);
  }
  issues.push(...validateList(methods, 'method'), ...validateList(headers, 'header'));
  if (!methods.length && !headers.length && !issues.length)
    issues.push('No Access-Control-Allow-Methods or Access-Control-Allow-Headers lines were found');
  return { methods, headers, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.');
  if (mode === 'build') {
    const methods = splitList(String(options.methods));
    const headers = splitList(String(options.headers));
    const issues = [...validateList(methods, 'method'), ...validateList(headers, 'header')];
    if (issues.length) throw new ToolError(issues[0]!);
    const output = `Access-Control-Allow-Methods: ${methods.join(', ')}\nAccess-Control-Allow-Headers: ${headers.join(', ')}`;
    return {
      output,
      render: 'code',
      language: 'http',
      filename: 'cors-preflight.txt',
      stats: { methods: methods.length, headers: headers.length },
    };
  }
  const result = inspectText(input.text);
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Header', 'Tokens', 'Status'], rows: [] }),
      render: 'table',
      notes: ['Paste header lines like Access-Control-Allow-Methods: GET, POST.'],
    };
  const rows: string[][] = [];
  if (result.methods.length)
    rows.push([
      'Access-Control-Allow-Methods',
      result.methods.join(', '),
      result.issues.length ? 'Review' : 'Valid',
    ]);
  if (result.headers.length)
    rows.push([
      'Access-Control-Allow-Headers',
      result.headers.join(', '),
      result.issues.length ? 'Review' : 'Valid',
    ]);
  return {
    output: JSON.stringify({ headers: ['Header', 'Tokens', 'Status'] as string[], rows }),
    render: 'table',
    stats: {
      methods: result.methods.length,
      headers: result.headers.length,
      issues: result.issues.length,
    },
    notes: result.issues.length
      ? result.issues
      : [
          'Lists valid; remember that a * grant cannot be combined with credentials for these headers.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
