import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './proxy-authenticate.meta';

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
function splitChallenges(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (
      char === ',' &&
      !quoted &&
      /^\s*[A-Za-z][A-Za-z0-9_-]*\s+/.test(text.slice(text.indexOf(char) + 1))
    ) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}
function inspect(
  value: string,
): { scheme: string; params: [string, string][]; issues: string[] } | null {
  const match = /^([A-Za-z][A-Za-z0-9_-]*)(?:\s+(.+))?$/.exec(value.trim());
  if (!match) return null;
  const scheme = match[1]!.toLowerCase();
  const params: [string, string][] = [];
  const issues: string[] = [];
  const remainder = match[2] ?? '';
  if (!remainder) {
    if (scheme === 'basic' || scheme === 'bearer')
      issues.push('Challenge should include a realm parameter');
    return { scheme, params, issues };
  }
  for (const part of remainder.split(/,\s*/)) {
    const index = part.indexOf('=');
    if (index <= 0) {
      issues.push(`Malformed auth parameter: ${part}`);
      continue;
    }
    const key = part.slice(0, index).trim().toLowerCase();
    let valuePart = part.slice(index + 1).trim();
    if (valuePart.startsWith('"') && valuePart.endsWith('"'))
      valuePart = valuePart.slice(1, -1).replace(/\\(["\\])/g, '$1');
    if (!TOKEN.test(key)) issues.push('Invalid auth parameter token');
    if (!['realm', 'scope', 'error', 'error_description', 'error_uri'].includes(key))
      issues.push(`Unknown auth parameter: ${key}`);
    params.push([key, valuePart]);
  }
  if (!params.some(([key]) => key === 'realm'))
    issues.push('Challenge should include a realm parameter');
  return { scheme, params, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Proxy-Authenticate mode.');
  if (mode === 'build') {
    const scheme = String(options.scheme);
    const realm = String(options.realm).trim();
    const scope = String(options.scope).trim();
    if (!realm || /[\r\n]/.test(realm) || /[\r\n]/.test(scope))
      throw new ToolError('Realm and scope must not contain line breaks.');
    const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const value = `${scheme} realm=${quote(realm)}${scheme === 'Bearer' && scope ? `, scope=${quote(scope)}` : ''}`;
    const parsed = inspect(value);
    if (!parsed || parsed.issues.length)
      throw new ToolError(parsed?.issues[0] ?? 'Enter valid challenge values.');
    return {
      output: value,
      render: 'code',
      language: 'http',
      filename: 'proxy-authenticate.txt',
      stats: { scheme },
    };
  }
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Scheme', 'Parameter', 'Value', 'Issues'], rows: [] }),
      render: 'table',
      notes: ['Paste one or more Proxy-Authenticate challenges.'],
    };
  const parsed = splitChallenges(input.text).map(inspect);
  const rows = parsed.flatMap((challenge) =>
    challenge
      ? challenge.params.length
        ? challenge.params.map(([key, value]) => [
            challenge.scheme,
            key,
            value,
            challenge.issues.join('; '),
          ])
        : [[challenge.scheme, '', '', challenge.issues.join('; ')]]
      : [['', '', '', 'Invalid challenge syntax']],
  );
  return {
    output: JSON.stringify({ headers: ['Scheme', 'Parameter', 'Value', 'Issues'], rows }),
    render: 'table',
    stats: {
      challenges: parsed.length,
      invalid: parsed.filter((challenge) => !challenge).length,
      review: parsed.filter((challenge) => challenge?.issues.length).length,
    },
    notes: [
      'Proxy-Authenticate challenges a forward proxy; WWW-Authenticate challenges the origin server.',
    ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
