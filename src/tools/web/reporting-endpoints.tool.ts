import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './reporting-endpoints.meta';

const NAME_RE = /^[a-z][a-z0-9-]*$/i;
function splitGroups(text: string): string[] {
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
function parseGroup(group: string): {
  name: string;
  url: string;
  priority: string;
  issues: string[];
} {
  const issues: string[] = [];
  const eq = group.indexOf('=');
  if (eq < 1)
    return { name: '', url: '', priority: '', issues: [`Malformed endpoint group: ${group}`] };
  const name = group.slice(0, eq).trim();
  const rest = group.slice(eq + 1).trim();
  if (!NAME_RE.test(name)) issues.push(`Invalid group name: ${name}`);
  const parts = rest
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  let url = '';
  let priority = '';
  for (const part of parts) {
    if (part.startsWith('"') && part.lastIndexOf('"') > 0) {
      url = part.slice(1, part.lastIndexOf('"'));
      continue;
    }
    const p = /^priority\s*=\s*(\d+)$/i.exec(part);
    if (p) {
      priority = p[1]!;
      continue;
    }
    issues.push(`Unrecognized parameter in endpoint: ${part}`);
  }
  if (!rest.startsWith('"') || !rest.includes('"')) issues.push('Endpoint URL must be quoted');
  if (!url) issues.push('A quoted report URL is required');
  else if (!/^https:\/\//i.test(url) && !/^http:\/\/localhost(?::\d+)?\//i.test(url))
    issues.push('Reporting endpoint URLs must use https (or http only for localhost)');
  if (priority !== '' && (!/^\d+$/.test(priority) || Number(priority) > 255))
    issues.push('priority must be an integer from 0 to 255');
  return { name, url, priority, issues };
}
function parse(text: string): { groups: ReturnType<typeof parseGroup>[]; issues: string[] } {
  const issues: string[] = [];
  const groups = splitGroups(text).map((group) => parseGroup(group));
  const names = groups.map((group) => group.name);
  for (let i = 0; i < groups.length; i++)
    if (groups[i]!.name && names.indexOf(groups[i]!.name) !== i)
      issues.push(`Duplicate group name: ${groups[i]!.name}`);
  return { groups, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Reporting-Endpoints mode.');
  if (mode === 'build') {
    const name = String(options.name).trim();
    const url = String(options.url).trim();
    const priority = String(options.priority).trim();
    const group = parseGroup(`${name}="${url}"${priority ? `; priority=${priority}` : ''}`);
    if (group.issues.length) throw new ToolError(group.issues[0]!);
    const output = `${group.name}="${group.url}"${priority ? `; priority=${priority}` : ''}`;
    return {
      output,
      render: 'code',
      language: 'http',
      filename: 'reporting-endpoints.txt',
      stats: {
        groups: 1,
        https:
          group.url.startsWith('https://') || /^http:\/\/localhost/i.test(group.url) ? 'yes' : 'no',
      },
    };
  }
  const text = input.text;
  const result = parse(text);
  if (!text.trim())
    return {
      output: JSON.stringify({ headers: ['Group', 'URL', 'Priority', 'Status'], rows: [] }),
      render: 'table',
      notes: [
        'Paste comma-separated Reporting-Endpoints groups, e.g. default="https://reports.example.com/collect".',
      ],
    };
  const rows = result.groups.map((group) => [
    (group.name || '?') as string,
    group.url || text,
    group.priority || '-',
    group.issues.length ? 'Review' : 'Valid',
  ]);
  return {
    output: JSON.stringify({ headers: ['Group', 'URL', 'Priority', 'Status'], rows }),
    render: 'table',
    stats: {
      groups: result.groups.length,
      issues: result.issues.length + result.groups.reduce((sum, g) => sum + g.issues.length, 0),
    },
    notes:
      result.issues.length || result.groups.some((g) => g.issues.length)
        ? [...result.issues, ...result.groups.flatMap((g) => g.issues)]
        : [
            'Browsers send reports (e.g. CSP violations) to these endpoints; each group must name a distinct reporting endpoint URL and use HTTPS except for localhost.',
          ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
