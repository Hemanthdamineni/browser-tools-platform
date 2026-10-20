import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './warning-header.meta';

const WARN_ACT: Record<string, string> = {
  '110': 'Response is Stale',
  '111': 'Revalidation Failed',
  '112': 'Disconnected Operation',
  '113': 'Heuristic Expiration',
  '199': 'Miscellaneous Warning',
  '299': 'Miscellaneous Persistent Warning',
};
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const DATE_OK =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;
function parseWarning(raw: string): {
  code: string;
  agent: string;
  text: string;
  date: string;
  issues: string[];
} {
  const issues: string[] = [];
  const line = raw.trim();
  const cm = /^(\d{3})/.exec(line);
  if (!cm) {
    issues.push('Warn-code must be a 3-digit integer at the start');
    return { code: '', agent: '-', text: '', date: '', issues };
  }
  const code = cm[1]!;
  const rest = line.slice(3).trim();
  const am = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+|-)\s*/.exec(rest);
  const agent = am?.[1] ?? '-';
  const afterAgent = am ? rest.slice(am[0].length).trim() : rest;
  const tm = /^"((?:[^"\\]|\\.)*)"\s*((?:.*)?)$/.exec(afterAgent);
  const text = tm?.[1]?.replace(/\\(.)/g, '$1') ?? '';
  const date = tm?.[2]?.trim() ?? '';
  if (!tm) issues.push('Expected a quoted warn-text string');
  if (!(code in WARN_ACT)) issues.push(`Unrecognized warn-code: ${code}`);
  if (agent !== '-' && !TOKEN.test(agent)) issues.push('Warn-agent should be a token (or "-")');
  if (date && !DATE_OK.test(date))
    issues.push('Warn-date should be a valid IMF-fixdate (e.g. Wed, 21 Oct 2030 07:28:00 GMT)');
  return { code, agent, text, date, issues };
}
function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.');
  const src =
    mode === 'build'
      ? `${String(o.code)} ${String(o.agent)} "${String(o.text)}"`
      : input.text.trim();
  if (mode === 'build') {
    const p = parseWarning(src);
    if (p.issues.length) throw new ToolError(p.issues[0]!);
    return {
      output: `Warning: ${src}`,
      render: 'code',
      language: 'http',
      filename: 'warning-header.txt',
      stats: { code: Number(p.code), agent: p.agent },
    };
  }
  if (!src)
    return {
      output: JSON.stringify({ headers: ['Code', 'Agent', 'Text', 'Status', 'Meaning'], rows: [] }),
      render: 'table',
      notes: ['Paste a Warning header value to analyze.'],
    };
  const pieces: string[] = [];
  let current = '';
  let inq = false;
  for (const c of src) {
    if (c === '"') inq = !inq;
    if (c === ',' && !inq) {
      if (current.trim()) pieces.push(current.trim());
      current = '';
    } else current += c;
  }
  if (current.trim()) pieces.push(current.trim());
  const ps = pieces.map(parseWarning);
  const rows = ps.map((p) => [
    p.code || '(none)',
    p.agent,
    p.text,
    p.date || '',
    p.issues.length ? 'Invalid' : 'Valid',
    WARN_ACT[p.code] ?? 'Custom warn-code',
  ]);
  const issues = ps.flatMap((p) => p.issues);
  return {
    output: JSON.stringify({
      headers: ['Code', 'Agent', 'Text', 'Date', 'Status', 'Meaning'],
      rows,
    }),
    render: 'table',
    stats: { warnings: rows.length, valid: ps.filter((p) => !p.issues.length).length },
    notes: issues.length
      ? issues
      : ['Warning carries advisory info; prefer Cache-Control and Age for freshness decisions.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
