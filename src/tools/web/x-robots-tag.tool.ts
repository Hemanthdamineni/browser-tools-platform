import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './x-robots-tag.meta';

const KNOWN: Record<string, string> = {
  index: 'Allow the URL to be indexed.',
  noindex: 'Prevent the URL from being indexed.',
  follow: 'Allow crawlers to follow links on the page.',
  nofollow: 'Prevent crawlers from following links on the page.',
  noarchive: 'Prevent cached copies from being shown.',
  nocache: 'Alias for noarchive.',
  nosnippet: 'Prevent snippets (descriptions) from being shown.',
  noimageindex: 'Prevent images on this page from being indexed.',
  unavailable_after: 'Crawl delay and removal after a date.',
  'max-snippet': 'Maximum snippet length in characters (e.g. max-snippet:100).',
  'max-image-preview': 'Maximum image preview size (none, small, large, medium).',
  'max-video-preview': 'Maximum video preview length in seconds.',
  indexifembedded: 'Allow indexing when embedded in another page (requires noindex).',
  notranslate: 'Prevent translation offer in search results.',
};
const CONFLICT_PAIRS: [string, string][] = [['index', 'noindex'], ['follow', 'nofollow']];

function parseRobots(raw: string): { groups: { agent: string; directives: string[] }[]; issues: string[] } {
  const issues: string[] = [];
  const groups: { agent: string; directives: string[] }[] = [];
  let currentAgent = '';
  let current: string[] = [];
  const flush = () => { if (current.length) { groups.push({ agent: currentAgent, directives: current }); current = []; } };
  for (const segment of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const colonIdx = segment.indexOf(':');
    if (colonIdx > 0 && segment.slice(0, colonIdx).trim() !== '') {
      flush();
      currentAgent = segment.slice(0, colonIdx).trim();
      current.push(segment.slice(colonIdx + 1).trim());
    } else {
      current.push(segment);
    }
  }
  flush();
  for (const { agent, directives } of groups) {
    const base = directives.filter((d) => !d.includes(':'));
    const vals = directives.filter((d) => d.includes(':'));
    for (const d of base) {
      if (d !== '' && !KNOWN[d]) issues.push(`Unknown directive${agent ? ` for ${agent}` : ''}: ${d}`);
    }
    for (const [a, b] of CONFLICT_PAIRS) {
      if (base.includes(a) && base.includes(b)) issues.push(`Conflicting directives: ${a} and ${b}${agent ? ` in ${agent}` : ''}`);
    }
    for (const v of vals) {
      const key = v.split(':')[0] ?? '';
      const val = v.slice(v.indexOf(':') + 1);
      if (!KNOWN[key]) issues.push(`Unknown directive${agent ? ` for ${agent}` : ''}: ${key}`);
      if (key === 'max-snippet') {
        const n = Number(val);
        if (isNaN(n) || n < 0) issues.push('max-snippet requires a non-negative integer value');
      }
    }
    if (base.includes('indexifembedded') && !base.includes('noindex')) {
      issues.push('indexifembedded only makes sense alongside noindex');
    }
  }
  return { groups, issues };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.');
  const src = mode === 'build' ? String(o.value) : input.text.trim();
  if (mode === 'build') {
    const { groups, issues } = parseRobots(src);
    if (issues.length) throw new ToolError(issues[0]!);
    return { output: `X-Robots-Tag: ${src}`, render: 'code', language: 'http', filename: 'x-robots-tag.txt', stats: { groups: groups.length } };
  }
  if (!src) return { output: JSON.stringify({ headers: ['Agent', 'Directives', 'Status', 'Meaning'], rows: [] }), render: 'table', notes: ['Paste an X-Robots-Tag value (e.g. noindex, nofollow or googlebot: noindex).'] };
  const { groups, issues } = parseRobots(src);
  const rows = groups.map((g) => [
    g.agent || '(all)',
    g.directives.join(', ') || '(none)',
    issues.filter((i) => i.includes(g.agent || '(all)')).length ? 'Review' : 'Valid',
    g.directives.map((d) => { const key = d.split(':')[0] ?? ''; return KNOWN[key] ?? (d.includes(':') ? d : 'Custom directive'); }).join(' | '),
  ]);
  return { output: JSON.stringify({ headers: ['Agent', 'Directives', 'Status', 'Meaning'], rows }), render: 'table', stats: { groups: rows.length }, notes: issues.length ? issues : ['X-Robots-Tag applies robots directives per-URL, complementing the site-wide robots.txt.'] };
}

const tool: TextToolModule = { meta, run };
export default tool;
