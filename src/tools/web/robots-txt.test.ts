import { describe, it, expect } from 'vitest';
import tool from './robots-txt.tool';

const run = (text = '', options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }).output;

describe('robots-txt', () => {
  it('allow-all preset is exactly the permissive block', () => {
    expect(run()).toBe('User-agent: *\nAllow: /\n');
  });

  it('block-all preset disallows everything', () => {
    expect(run('', { preset: 'block-all' })).toBe('User-agent: *\nDisallow: /\n');
  });

  it('block-ai-bots includes GPTBot and ClaudeBot blocks then allows the rest', () => {
    const out = run('', { preset: 'block-ai-bots' });
    expect(out).toContain('User-agent: GPTBot\nDisallow: /');
    expect(out).toContain('User-agent: ClaudeBot');
    expect(out).toContain('User-agent: PerplexityBot');
    expect(out.trimEnd().endsWith('User-agent: *\nAllow: /')).toBe(true);
  });

  it('custom preset emits one block per user-agent with rules', () => {
    const out = run('', {
      preset: 'custom',
      userAgents: 'FooBot, BarBot',
      disallow: '/private\n/tmp',
      allow: '/public',
    });
    expect(out).toContain('User-agent: FooBot\nDisallow: /private\nDisallow: /tmp\nAllow: /public');
    expect(out).toContain('User-agent: BarBot\nDisallow: /private');
  });

  it('appends Crawl-delay and Sitemap when set', () => {
    const out = run('', { crawlDelay: 10, sitemapUrl: 'https://ex.com/sitemap.xml' });
    expect(out).toContain('Crawl-delay: 10');
    expect(out).toContain('Sitemap: https://ex.com/sitemap.xml');
  });

  it('omits Crawl-delay when zero', () => {
    expect(run()).not.toContain('Crawl-delay');
  });
});
