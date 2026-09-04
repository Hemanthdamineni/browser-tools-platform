import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './robots-txt.meta';

const AI_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'CCBot',
  'Google-Extended',
  'anthropic-ai',
  'ClaudeBot',
  'PerplexityBot',
  'Bytespider',
  'Amazonbot',
  'FacebookBot',
];

function block(crawler: string, lines: string[]): string[] {
  return [`User-agent: ${crawler}`, ...lines];
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const preset = String(o.preset);
  const delay = Number(o.crawlDelay) || 0;
  const sitemap = String(o.sitemapUrl).trim();
  const trailer: string[] = [];
  if (delay > 0) trailer.push(`Crawl-delay: ${delay}`);
  if (sitemap) trailer.push(`Sitemap: ${sitemap}`);

  let body: string[];
  if (preset === 'allow-all') {
    body = block('*', ['Allow: /']);
  } else if (preset === 'block-all') {
    body = block('*', ['Disallow: /']);
  } else if (preset === 'block-ai-bots') {
    body = AI_BOTS.flatMap((bot) => block(bot, ['Disallow: /']));
    body = [...body, ...block('*', ['Allow: /'])];
  } else {
    const agents = String(o.userAgents)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const disallow = String(o.disallow)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => `Disallow: ${p}`);
    const allow = String(o.allow)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => `Allow: ${p}`);
    const ruleLines = [...disallow, ...allow];
    body = agents.length
      ? agents.flatMap((a) => block(a, ruleLines.length ? ruleLines : ['Allow: /']))
      : [];
  }

  const out = [...body, ...trailer].join('\n') + '\n';
  return { output: out, render: 'code', language: 'txt' };
}

const tool: TextToolModule = { meta, run };
export default tool;
