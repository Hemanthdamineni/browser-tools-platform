import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './strict-transport-security.meta';

const MAX_AGE_RE = /^\s*max-age\s*=\s*(\d+)/i;
function inspect(value: string): {
  maxAge?: number;
  includeSubDomains: boolean;
  preload: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const tokens = value
    .split(';')
    .map((token) => token.trim())
    .filter(Boolean);
  let maxAge: number | undefined;
  let includeSubDomains = false;
  let preload = false;
  if (!tokens.length) issues.push('No HSTS directives were provided');
  for (const token of tokens) {
    const maxMatch = MAX_AGE_RE.exec(token);
    if (maxMatch) {
      if (maxAge !== undefined) issues.push('Duplicate max-age directive');
      maxAge = Number(maxMatch[1]);
      continue;
    }
    if (/^max-age\s*=\s*-?\d+/i.test(token)) issues.push('max-age must be a non-negative integer');
    else if (/^max-age/i.test(token)) issues.push('malformed max-age directive');
    const lower = token.toLowerCase();
    if (lower === 'includesubdomains') {
      if (includeSubDomains) issues.push('Duplicate includeSubDomains directive');
      includeSubDomains = true;
      continue;
    }
    if (lower === 'preload') {
      if (preload) issues.push('Duplicate preload directive');
      preload = true;
      continue;
    }
    issues.push(`Unknown HSTS directive: ${token}`);
  }
  if (
    maxAge !== undefined &&
    maxAge < 31_536_000 &&
    !issues.some((issue) => issue.startsWith('Duplicate'))
  )
    issues.push(
      `max-age of ${maxAge} seconds is under the one-year minimum recommended for the preload list`,
    );
  if (preload && !includeSubDomains) issues.push('Preload submissions require includeSubDomains');
  return { maxAge, includeSubDomains, preload, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported HSTS mode.');
  let value: string;
  if (mode === 'build') {
    let flags = String(options.flags);
    if (!['none', 'includeSubDomains', 'includeSubDomains+preload'].includes(flags))
      throw new ToolError('Choose a supported directive set.');
    let maxAge = String(options.maxAge).trim();
    if (!/^\d+$/.test(maxAge))
      throw new ToolError('max-age must be a non-negative integer in seconds.');
    value = `max-age=${maxAge}`;
    if (flags !== 'none') value += '; includeSubDomains';
    if (flags === 'includeSubDomains+preload') value += '; preload';
    const checked = inspect(value);
    if (checked.issues.length) throw new ToolError(checked.issues[0]!);
    return {
      output: value,
      render: 'code',
      language: 'http',
      filename: 'strict-transport-security.txt',
      stats: {
        maxAge: Number(maxAge),
        includeSubDomains: flags !== 'none' ? 'yes' : 'no',
        preload: flags === 'includeSubDomains+preload' ? 'yes' : 'no',
      },
    };
  }
  value = input.text;
  const result = inspect(value);
  if (
    !value.trim() ||
    (!result.maxAge && !result.includeSubDomains && !result.preload && !result.issues.length)
  )
    return {
      output: JSON.stringify({ headers: ['Directive', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste an HSTS header value such as max-age=31536000; includeSubDomains.'],
    };
  const rows: string[][] = [];
  if (result.maxAge !== undefined)
    rows.push([
      `max-age=${result.maxAge}`,
      result.issues.length ? 'Review' : 'Valid',
      `${result.maxAge} seconds${result.maxAge >= 31_536_000 ? ' (one-year preload minimum met)' : ' (under one year; preload ineligible)'}`,
    ]);
  else rows.push(['max-age', 'Missing', 'A max-age directive is required']);
  for (const flag of ['includeSubDomains', 'preload'] as const) {
    const present = flag === 'includeSubDomains' ? result.includeSubDomains : result.preload;
    if (present) rows.push([flag, 'Valid', 'Directive present']);
  }
  for (const issue of result.issues) rows.push([issue.split(' ')[0] ?? 'HSTS', 'Issue', issue]);
  return {
    output: JSON.stringify({ headers: ['Directive', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      maxAge: result.maxAge ?? 0,
      includeSubDomains: result.includeSubDomains ? 'yes' : 'no',
      preload: result.preload ? 'yes' : 'no',
      issues: result.issues.length,
    },
    notes: result.issues.length
      ? result.issues
      : [
          'HSTS only applies after the first HTTPS response for a client; the header is ignored over plain HTTP by design.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
