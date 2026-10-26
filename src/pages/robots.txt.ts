import type { APIRoute } from 'astro';
import { absoluteUrl } from '@/lib/site';

/**
 * Search and AI crawlers we explicitly welcome. The site is public and every
 * tool runs on-device, so there is nothing worth gating behind auth.
 */
const CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
  'Bytespider',
];

export const GET: APIRoute = () => {
  const agentGroups = CRAWLERS.flatMap((agent) => [`User-agent: ${agent}`, 'Allow: /', '']);
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    ...agentGroups,
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
    '',
    '# Machine-readable catalogue for AI crawlers: /llms.txt',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
