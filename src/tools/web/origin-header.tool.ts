import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { meta } from './origin-header.meta';

const ORIGIN_RE = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([/?#].*)?$/i;
function inspect(value: string): { token: string; issues: string[]; notes: string[] } {
  const token = value.trim();
  const issues: string[] = [];
  const notes: string[] = [];
  if (!token) {
    issues.push('No Origin header value provided');
    return { token, issues, notes };
  }
  if (/^Origin\s*:/i.test(token)) {
    notes.push('Stripped the "Origin:" label; analyzing the value only.');
  }
  let body = token.replace(/^Origin\s*:\s*/i, '');
  if (body === 'null') {
    notes.push(
      'The null origin marks a sandboxed, anonymous, or non-browser context (file://, data:, sandboxed iframe).',
    );
    return { token, issues, notes };
  }
  const match = ORIGIN_RE.exec(body);
  if (!match) {
    issues.push('Not a valid Origin: expected scheme://host[:port] or the literal null');
    return { token, issues, notes };
  }
  const scheme = match[1]!.toLowerCase();
  const hostPort = match[2]!;
  const rest = match[3] ?? '';
  if (rest)
    issues.push(
      `Trailing "${rest}" is not part of an origin; origins never contain paths, queries, or fragments`,
    );
  if (!hostPort) issues.push('Missing host after the scheme:// prefix');
  if (hostPort.includes('/') || hostPort.includes('?') || hostPort.includes('#'))
    issues.push('Credentials, path, query, or fragment inside the host portion');
  const colon = hostPort.indexOf(':');
  if (colon >= 0 && !/^\d+$/.test(hostPort.slice(colon + 1)))
    issues.push('Port must be a number (1–65535)');
  else if (colon >= 0) {
    const port = Number(hostPort.slice(colon + 1));
    if (port < 1 || port > 65535) issues.push(`Port ${port} is outside the valid range 1–65535`);
  }
  if (scheme === 'http' && hostPort.toLowerCase().includes('.'))
    notes.push('Plain http origins should only be sent when the page is itself on http.');
  return { token, issues, notes };
}
function run(input: TextRunInput): TextRunResult {
  const result = inspect(input.text);
  const token = result.token || input.text || '(no value)';
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Origin', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste an Origin request header value to analyze.'],
    };
  const status = result.issues.length ? 'Invalid' : 'Valid';
  const assessment =
    result.issues.join('; ') ||
    'Single-origin — safe to compare against an allowlist for CSRF checks';
  const notes = [...result.notes, ...result.issues];
  return {
    output: JSON.stringify({
      headers: ['Origin', 'Status', 'Assessment'],
      rows: [[token, status, assessment]],
    }),
    render: 'table',
    stats: { valid: result.issues.length ? 'no' : 'yes', origin: token },
    notes: notes.length
      ? notes
      : ['Verify the value equals an expected Allow-Origin before trusting the request.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
