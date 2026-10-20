import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './permissions-policy.meta';

const FEATURE = /^[a-z][a-z0-9-]*$/;
const ORIGIN = /^(self|none|\*|"self"|"none"|"\*"|"https?:\/\/[^\s()"]+")$/;
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
function inspect(text: string): { directives: [string, string[]][]; issues: string[] } {
  const directives: [string, string[]][] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const part of splitDirectives(text)) {
    const match = /^([a-z][a-z0-9-]*)=\(([^)]*)\)$/i.exec(part.trim());
    if (!match) {
      issues.push(`Invalid Permissions-Policy directive: ${part}`);
      continue;
    }
    const feature = match[1]!.toLowerCase();
    const allowlist = match[2]!.trim() ? match[2]!.trim().split(/\s+/) : [];
    if (!FEATURE.test(feature)) issues.push(`Invalid feature name: ${feature}`);
    if (seen.has(feature)) issues.push(`Duplicate feature directive: ${feature}`);
    seen.add(feature);
    for (const origin of allowlist)
      if (!ORIGIN.test(origin)) issues.push(`Invalid allowlist origin: ${origin}`);
    if (allowlist.includes('*') || allowlist.includes('"*"'))
      issues.push(`Wildcard grant for ${feature} is broad; review delegation scope`);
    if (allowlist.includes('none') && allowlist.length > 1)
      issues.push(`${feature} cannot combine none with other origins`);
    directives.push([feature, allowlist]);
  }
  return { directives, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Permissions-Policy mode.');
  const value =
    mode === 'build'
      ? `${String(options.feature).trim().toLowerCase()}=(${String(options.allowlist).trim()})`
      : input.text;
  const result = inspect(value);
  if (mode === 'build') {
    if (!result.directives.length || result.issues.length)
      throw new ToolError(result.issues[0] ?? 'Enter a valid feature and allowlist.');
    return {
      output: `${result.directives[0]![0]}=(${result.directives[0]![1].join(' ')})`,
      render: 'code',
      language: 'http',
      filename: 'permissions-policy.txt',
      stats: { directives: 1 },
    };
  }
  if (!value.trim())
    return {
      output: JSON.stringify({ headers: ['Feature', 'Allowlist', 'Status'], rows: [] }),
      render: 'table',
      notes: ['Paste comma-separated Permissions-Policy directives.'],
    };
  const rows = result.directives.map(([feature, allowlist]) => [
    feature,
    allowlist.join(' ') || '(empty)',
    result.issues.length ? 'Review' : 'Valid',
  ]);
  return {
    output: JSON.stringify({ headers: ['Feature', 'Allowlist', 'Status'], rows }),
    render: 'table',
    stats: {
      directives: result.directives.length,
      issues: result.issues.length,
      disabled: result.directives.filter(([, allowlist]) => !allowlist.length).length,
    },
    notes: result.issues.length
      ? result.issues
      : [
          'Permissions-Policy controls document and frame capability delegation; verify browser support and least privilege.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
