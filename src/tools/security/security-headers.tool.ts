import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './security-headers.meta';

type HeaderMap = Map<string, string[]>;
type Finding = { header: string; status: 'Present' | 'Missing' | 'Review'; detail: string };

function parseHeaders(text: string): { headers: HeaderMap; malformed: string[]; statusLine?: string } {
  const headers: HeaderMap = new Map();
  const malformed: string[] = [];
  let statusLine: string | undefined;
  for (const rawLine of text.split(/\r\n|\n|\r/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^HTTP\/\d(?:\.\d)?\s+\d{3}\b/i.test(line)) {
      statusLine = line;
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 1) {
      malformed.push(line);
      continue;
    }
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
      malformed.push(line);
      continue;
    }
    const key = name.toLowerCase();
    headers.set(key, [...(headers.get(key) ?? []), value]);
  }
  return { headers, malformed, ...(statusLine ? { statusLine } : {}) };
}

function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);
  if (input.text.length > 200_000) throw new ToolError('Header input is too large.', 'Paste a header block under 200 KB.');
  const { headers, malformed, statusLine } = parseHeaders(input.text);
  if (!headers.size && !malformed.length && !statusLine) {
    return {
      output: JSON.stringify({ headers: ['Check', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste an HTTP response header block to analyze.'],
    };
  }

  const value = (name: string) => (headers.get(name) ?? []).join(', ');
  const has = (name: string) => headers.has(name);
  const findings: Finding[] = [];
  const csp = value('content-security-policy');
  if (!has('content-security-policy')) findings.push({ header: 'Content-Security-Policy', status: 'Missing', detail: 'Consider a restrictive policy; start with report-only mode and test application resources.' });
  else {
    const directives = new Map<string, string[]>();
    for (const item of csp.split(';')) {
      const parts = item.trim().split(/\s+/).filter(Boolean);
      if (parts.length) directives.set(parts[0]!.toLowerCase(), parts.slice(1));
    }
    const unsafe = [...directives.values()].flat().filter((token) => token.toLowerCase() === "'unsafe-inline'" || token.toLowerCase() === "'unsafe-eval'");
    const wildcard = [...directives.values()].some((tokens) => tokens.includes('*'));
    if (unsafe.length || wildcard) findings.push({ header: 'Content-Security-Policy', status: 'Review', detail: `Review broad sources${unsafe.length ? ` and ${[...new Set(unsafe)].join(', ')}` : ''}; prefer nonces or hashes where appropriate.` });
    else if (!directives.has('default-src') && !directives.has('script-src')) findings.push({ header: 'Content-Security-Policy', status: 'Review', detail: 'Policy has no default-src or script-src directive; verify that it meaningfully constrains scripts and resources.' });
    else findings.push({ header: 'Content-Security-Policy', status: 'Present', detail: 'Policy found. Validate it against the application and test for unintended resource blocking.' });
    if (directives.has('frame-ancestors') && directives.get('frame-ancestors')?.includes('*')) findings.push({ header: 'CSP frame-ancestors', status: 'Review', detail: 'A wildcard frame-ancestors value permits framing by any origin.' });
  }

  const hsts = value('strict-transport-security');
  if (!has('strict-transport-security')) findings.push({ header: 'Strict-Transport-Security', status: 'Missing', detail: 'For HTTPS sites, consider HSTS after confirming all subdomains support HTTPS.' });
  else {
    const maxAge = /(?:^|;)\s*max-age\s*=\s*(\d+)/i.exec(hsts);
    const seconds = maxAge ? Number(maxAge[1]) : 0;
    if (!maxAge) findings.push({ header: 'Strict-Transport-Security', status: 'Review', detail: 'max-age is missing or invalid.' });
    else if (seconds < 15_552_000) findings.push({ header: 'Strict-Transport-Security', status: 'Review', detail: 'max-age is under 180 days; choose a duration appropriate to your deployment.' });
    else findings.push({ header: 'Strict-Transport-Security', status: 'Present', detail: `max-age is ${seconds} seconds${/\bincludeSubDomains\b/i.test(hsts) ? ' with includeSubDomains' : ''}.` });
  }

  if (has('x-content-type-options')) {
    findings.push({ header: 'X-Content-Type-Options', status: /^nosniff$/i.test(value('x-content-type-options')) ? 'Present' : 'Review', detail: /^nosniff$/i.test(value('x-content-type-options')) ? 'nosniff is set.' : 'Expected the value nosniff.' });
  } else findings.push({ header: 'X-Content-Type-Options', status: 'Missing', detail: 'Set nosniff to prevent MIME-type sniffing.' });

  if (has('x-frame-options')) {
    const xfo = value('x-frame-options');
    findings.push({ header: 'X-Frame-Options', status: /^(deny|sameorigin)$/i.test(xfo) ? 'Present' : 'Review', detail: 'Use DENY or SAMEORIGIN, or prefer CSP frame-ancestors for modern policy control.' });
  } else if (!/\bframe-ancestors\b/i.test(csp)) {
    findings.push({ header: 'Framing protection', status: 'Missing', detail: 'Set CSP frame-ancestors or X-Frame-Options to control embedding.' });
  }

  const referrer = value('referrer-policy');
  if (!has('referrer-policy')) findings.push({ header: 'Referrer-Policy', status: 'Missing', detail: 'Choose a policy that limits referrer data, commonly strict-origin-when-cross-origin.' });
  else if (/^(unsafe-url|no-referrer-when-downgrade)$/i.test(referrer)) findings.push({ header: 'Referrer-Policy', status: 'Review', detail: `The ${referrer} policy may expose more referrer information than intended.` });
  else findings.push({ header: 'Referrer-Policy', status: 'Present', detail: `Policy set to ${referrer}.` });

  if (!has('permissions-policy')) findings.push({ header: 'Permissions-Policy', status: 'Missing', detail: 'Consider explicitly disabling browser features the application does not use.' });
  else findings.push({ header: 'Permissions-Policy', status: 'Present', detail: 'Policy found; review allowed origins and features.' });

  const duplicates = [...headers.entries()].filter(([, values]) => values.length > 1).map(([name, values]) => [name, String(values.length), values.join(' | ')]);
  const rows = findings.map((item) => [item.header, item.status, item.detail]);
  const statusCounts = findings.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  return {
    output: JSON.stringify({ headers: ['Check', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: { findings: findings.length, missing: statusCounts.Missing ?? 0, review: statusCounts.Review ?? 0, duplicates: duplicates.length, malformed: malformed.length },
    notes: [
      ...(statusLine ? [`Response: ${statusLine}`] : []),
      ...(duplicates.length ? [`Duplicate header names: ${duplicates.map(([name, count]) => `${name} (${count})`).join(', ')}`] : []),
      ...(malformed.length ? [`Ignored ${malformed.length} malformed header line(s).`] : []),
      'Heuristic review only. Header configuration depends on your application and deployment; this is not a complete security assessment.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
