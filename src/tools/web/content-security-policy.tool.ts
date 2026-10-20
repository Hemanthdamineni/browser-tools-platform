import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './content-security-policy.meta';

const KNOWN_DIRECTIVES = new Set([
  'base-uri',
  'child-src',
  'connect-src',
  'default-src',
  'font-src',
  'form-action',
  'frame-ancestors',
  'frame-src',
  'img-src',
  'manifest-src',
  'media-src',
  'object-src',
  'script-src',
  'script-src-attr',
  'script-src-elem',
  'style-src',
  'style-src-attr',
  'style-src-elem',
  'worker-src',
  'upgrade-insecure-requests',
]);
function analyze(text: string): { directives: [string, string, string[]][]; issues: string[] } {
  const directives: [string, string, string[]][] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const part of text
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const [name, ...rest] = part.split(/\s+/);
    if (!name) continue;
    const directive = name.toLowerCase();
    const values = rest.filter(Boolean);
    if (!KNOWN_DIRECTIVES.has(directive))
      issues.push(`Unknown or unsupported directive: ${directive}`);
    if (seen.has(directive)) issues.push(`Duplicate directive: ${directive}`);
    seen.add(directive);
    directives.push([directive, values.join(' '), values]);
  }
  if (!text.trim()) issues.length = 0;
  if (directives.length && !seen.has('default-src'))
    issues.push('No default-src directive; add one to provide a fallback for unlisted directives');
  const broad = directives.filter(
    ([, , values]) => values.includes('*') || values.includes('http:') || values.includes('https:'),
  );
  for (const [name] of broad)
    issues.push(
      `${name} allows broad sources (* or http(s) schemes); consider narrowing to specific origins`,
    );
  const unsafe = [
    ...new Set(
      directives
        .flatMap(([, , values]) => values)
        .filter((value) => value === "'unsafe-inline'" || value === "'unsafe-eval'"),
    ),
  ];
  if (unsafe.length) issues.push(`Unsafe keyword present: ${unsafe.join(', ')}`);
  return { directives, issues };
}
function build(options: Record<string, unknown>): {
  output: string;
  issues: string[];
  directives: [string, string, string[]][];
} {
  const parts: [string, string][] = [
    ['default-src', String(options.defaultSrc ?? '')],
    ['script-src', String(options.scriptSrc ?? '')],
    ['style-src', String(options.styleSrc ?? '')],
    ['img-src', String(options.imgSrc ?? '')],
    ['connect-src', String(options.connectSrc ?? '')],
    ['frame-ancestors', String(options.frameAncestors ?? '')],
    ['object-src', String(options.objectSrc ?? '')],
  ];
  const directives: [string, string, string[]][] = [];
  for (const [name, value] of parts)
    if (value.trim()) directives.push([name, value.trim(), value.split(/\s+/).filter(Boolean)]);
  const { issues } = analyze(directives.map(([name, value]) => `${name} ${value}`).join('; '));
  return {
    output: directives.map(([name, value]) => `${name} ${value}`).join('; '),
    issues,
    directives,
  };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported CSP mode.');
  if (mode === 'build') {
    const built = build(options);
    if (!built.directives.length)
      throw new ToolError('Provide at least one directive to build a CSP.');
    if (built.issues.length) throw new ToolError(built.issues[0]!);
    return {
      output: built.output,
      render: 'code',
      language: 'http',
      filename: 'content-security-policy.txt',
      stats: { directives: built.directives.length },
    };
  }
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Directive', 'Sources', 'Status'], rows: [] }),
      render: 'table',
      notes: [
        "Paste a Content-Security-Policy value such as default-src 'self'; script-src 'self'.",
      ],
    };
  const { directives, issues } = analyze(input.text);
  const rows = directives.map(([name, valuesText]) => [
    name,
    valuesText || '(no values)',
    issues.length ? 'Review' : 'Valid',
  ]);
  return {
    output: JSON.stringify({ headers: ['Directive', 'Sources', 'Status'], rows }),
    render: 'table',
    stats: { directives: directives.length, issues: issues.length },
    notes: issues.length
      ? issues
      : [
          'Report-only deployment (Content-Security-Policy-Report-Only) is a safe way to evaluate policy usefulness before enabling enforcement.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
