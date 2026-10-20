import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './sec-fetch-inspector.meta';

const SITES = new Set(['cross-site', 'same-site', 'same-origin', 'none']);
const MODES = new Set([
  'cors',
  'navigate',
  'no-cors',
  'same-origin',
  'websocket',
  'nested-navigate',
]);
const DESTS = new Set([
  'audio',
  'audioworklet',
  'document',
  'embed',
  'empty',
  'font',
  'frame',
  'iframe',
  'image',
  'manifest',
  'object',
  'paintworklet',
  'report',
  'script',
  'serviceworker',
  'sharedworker',
  'style',
  'track',
  'video',
  'worker',
  'xslt',
]);
const USERS = new Set(['?0', '?1']);
function collectHeaders(text: string): { entries: [string, string][]; issues: string[] } {
  const entries: [string, string][] = [];
  const issues: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const eq = line.indexOf(':');
    if (eq < 1) {
      issues.push(`Malformed line: ${line}`);
      continue;
    }
    const name = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    if (/^sec-fetch-(site|mode|dest|user)$/.test(name)) {
      if (entries.some(([n]) => n === name)) issues.push(`Duplicate ${name}`);
      entries.push([name, value]);
    }
  }
  return { entries, issues };
}
function inspect(entries: [string, string][]): { issues: string[] } {
  const issues: string[] = [];
  const name = (key: string) => entries.find(([n]) => n === key)?.[1];
  const site = name('sec-fetch-site');
  if (site && !SITES.has(site)) issues.push(`Invalid sec-fetch-site value: ${site}`);
  const mode = name('sec-fetch-mode');
  if (mode && !MODES.has(mode)) issues.push(`Invalid sec-fetch-mode value: ${mode}`);
  const dest = name('sec-fetch-dest');
  if (dest && !DESTS.has(dest)) issues.push(`Invalid sec-fetch-dest value: ${dest}`);
  const user = name('sec-fetch-user');
  if (user && !USERS.has(user)) issues.push('sec-fetch-user must be ?0 or ?1');
  if (site === 'cross-site' && mode === 'navigate' && dest === 'document')
    issues.push('Cross-site top-level navigation; verify it matches expected inbound traffic');
  return { issues };
}
function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Header', 'Value', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste Sec-Fetch request headers, one per line.'],
    };
  const { entries, issues } = collectHeaders(input.text);
  const hasAny = entries.length > 0;
  if (!hasAny)
    return {
      output: JSON.stringify({ headers: ['Header', 'Value', 'Assessment'], rows: [] }),
      render: 'table',
      stats: { headers: 0, issues: issues.length, crossSite: 'no' },
      notes: [
        ...issues,
        'No Sec-Fetch headers found; legacy or non-browser clients routinely omit these, which can itself be a signal.',
      ],
    };
  const requestRows: [string, string, string][] = entries.map(([name, value]) => {
    const base = name as keyof typeof assessments;
    const assessments: Record<string, string> = {
      'sec-fetch-site':
        {
          'cross-site': 'Request originates from a different site',
          'same-site': 'Request originates from the same site (different origin)',
          'same-origin': 'Request originates from the same origin',
          none: 'The browser did not attach a site context',
        }[value] ?? 'Unknown site value',
      'sec-fetch-mode':
        {
          cors: 'CORS-enabled request',
          navigate: 'Navigation request',
          'no-cors': 'No-CORS request',
          'same-origin': 'Same-origin request',
          websocket: 'WebSocket request',
          'nested-navigate': 'Request initiated by nested browsing context',
        }[value] ?? 'Unknown mode value',
      'sec-fetch-dest':
        {
          document: 'Top-level document navigation',
          iframe: 'Iframe or frame navigation',
          script: 'Script resource',
          style: 'Style resource',
          image: 'Image resource',
          empty: 'Request without a special destination',
        }[value] ?? 'Unknown destination value',
      'sec-fetch-user':
        value === '?1' ? 'Triggered by user activation' : 'Not triggered by user activation',
    };
    return [name, value, assessments[base] ?? ''];
  });
  const combos = inspect(entries);
  const allIssues = [...issues, ...combos.issues];
  return {
    output: JSON.stringify({ headers: ['Header', 'Value', 'Assessment'], rows: requestRows }),
    render: 'table',
    stats: {
      headers: requestRows.length,
      issues: allIssues.length,
      crossSite: entries.some(([, value]) => value === 'cross-site') ? 'yes' : 'no',
    },
    notes: allIssues.length
      ? allIssues
      : [
          'Fetch metadata is defense-in-depth; do not treat it as a replacement for authentication or authorization.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
