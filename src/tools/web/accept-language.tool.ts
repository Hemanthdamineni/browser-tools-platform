import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './accept-language.meta';

const LANG_RE = /^(\*|[a-z]{1,8}(-[a-z0-9]{1,8})*)$/i;
function parse(value: string): { entries: { range: string; q: number }[]; issues: string[] } {
  const issues: string[] = [];
  const entries: { range: string; q: number }[] = [];
  let text = value.trim();
  if (/^Accept-Language\s*:/i.test(text)) text = text.replace(/^[^:]+:\s*/, '');
  for (const raw of text.split(',').map((item) => item.trim()).filter(Boolean)) {
    const match = /^(\*|[a-z0-9-]+)(\s*;\s*q\s*=\s*(\d(\.\d+)?))?$/i.exec(raw);
    if (!match) { issues.push(`Malformed entry: ${raw}`); continue; }
    const range = match[1]!;
    const q = match[3] === undefined ? 1 : Number(match[3]);
    if (q > 1 || q < 0) { issues.push(`q-value out of range (0–1): ${raw}`); continue; }
    if (range !== '*' && !LANG_RE.test(range)) { issues.push(`Invalid language range: ${range}`); continue; }
    entries.push({ range, q });
  }
  return { entries, issues };
}
function assemble(entries: { range: string; q: number }[]): { rows: string[][]; sorted: { range: string; q: number }[]; dupIssues: string[] } {
  const seen = new Set<string>();
  const dupIssues: string[] = [];
  for (const e of entries) { const key = e.range.toLowerCase(); if (seen.has(key)) dupIssues.push(`Duplicate range: ${e.range}`); seen.add(key); }
  const sorted = [...entries].sort((a, b) => b.q - a.q);
  const rows = sorted.map((e) => [e.range, String(e.q), e.q === 0 ? 'Unacceptable' : e.q >= 0.75 ? 'Strong' : e.q >= 0.5 ? 'Moderate' : 'Weak']);
  return { rows, sorted, dupIssues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'analyze' && mode !== 'rank') throw new ToolError('Choose a supported mode.');
  if (!input.text.trim()) return { output: JSON.stringify({ headers: ['Language', 'q', 'Level'], rows: [] }), render: 'table', notes: ['Paste an Accept-Language header value to analyze.'] };
  const parsed = parse(input.text);
  if (mode === 'rank') { const forced = String(options.defaultQuality) === '0' ? 0 : Number(String(options.defaultQuality) || 1); for (const e of parsed.entries) e.q = forced; }
  const { rows, sorted, dupIssues } = assemble(parsed.entries);
  const issues = [...parsed.issues, ...dupIssues];
  const summary = sorted.map((e) => `${e.range}=${e.q}`).join(', ');
  return { output: JSON.stringify({ headers: ['Language', 'q', 'Level'], rows }), render: 'table', stats: { ranges: sorted.length, top: sorted[0]?.range ?? '', issues: issues.length }, notes: issues.length ? issues : [mode === 'rank' ? `Assigned q=${String(options.defaultQuality)} to every range; ordering: ${summary}` : `Preference order (highest q first): ${summary}`] };
}
const tool: TextToolModule = { meta, run };
export default tool;
