import { describe, it, expect } from 'vitest';
import tool from './meta-tags.tool';
import { ToolError } from '@/lib/types';

const run = (text = '', options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }).output;

describe('meta-tags', () => {
  it('emits title, description and og tags', () => {
    const out = run('', { title: 'My Page', description: 'Hi' });
    expect(out).toContain('<title>My Page</title>');
    expect(out).toContain('<meta property="og:title" content="My Page">');
    expect(out).toContain('<meta name="description" content="Hi">');
  });

  it('escapes quotes and angle brackets in values', () => {
    const out = run('', { title: 'He said "hi" <b>' });
    expect(out).toContain('<title>He said &quot;hi&quot; &lt;b&gt;</title>');
  });

  it('includes canonical, image, site name and chosen types', () => {
    const out = run('', {
      title: 'T',
      canonicalUrl: 'https://ex.com/a',
      imageUrl: 'https://ex.com/i.png',
      ogType: 'article',
      siteName: 'Ex',
      twitterCard: 'summary',
    });
    expect(out).toContain('<link rel="canonical" href="https://ex.com/a">');
    expect(out).toContain('<meta property="og:url" content="https://ex.com/a">');
    expect(out).toContain('<meta property="og:image" content="https://ex.com/i.png">');
    expect(out).toContain('<meta property="og:type" content="article">');
    expect(out).toContain('<meta property="og:site_name" content="Ex">');
    expect(out).toContain('<meta name="twitter:card" content="summary">');
  });

  it('skips empty fields', () => {
    const out = run('', { title: 'Only' });
    expect(out).not.toContain('canonical');
    expect(out).not.toContain('og:image');
  });

  it('throws ToolError when title and description are both empty', () => {
    expect(() => run()).toThrow(ToolError);
    expect(() => run()).toThrow(/at least a title or description/);
  });
});
