import { describe, expect, it } from 'vitest';
import tool from './markdown-toc.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('markdown-toc', () => {
  it('builds a nested GitHub-style list', async () => {
    const r = await run('# A\n## A1\n### A1a\n# B');
    expect(r.output).toBe(
      '- [A](#a)\n  - [A1](#a1)\n    - [A1a](#a1a)\n- [B](#b)\n'
    );
    expect(r.render).toBe('code');
    expect(r.stats?.headings).toBe(4);
    expect(r.stats?.maxLevel).toBe(3);
  });

  it('slugs like GitHub', async () => {
    const r = await run('## Hello, World! & More');
    expect(r.output).toContain('[Hello, World! & More](#hello-world-more)');
  });

  it('honours custom anchors', async () => {
    const r = await run('# Title {#custom}\n');
    expect(r.output).toContain('- [Title](#custom)');
    expect(r.output).not.toContain('{#custom}');
  });

  it('skips fenced code blocks', async () => {
    const r = await run('# Real\n```\n# Fake\nignored\n```\n## Real2');
    expect(r.output).toContain('- [Real](#real)');
    expect(r.output).not.toContain('Fake');
    expect(r.output).toContain('Real2');
  });

  it('caps by depth', async () => {
    const r = await run('# A\n## B\n### C\n#### D', { depth: 2 });
    expect(r.output).toContain('- [A](#a)');
    expect(r.output).toContain('- [B](#b)');
    expect(r.output).not.toContain('C');
    expect(r.output).not.toContain('D');
  });

  it('plain format indents by level without links', async () => {
    const r = await run('# A\n## B', { format: 'plain' });
    expect(r.output).toBe('A\n  B\n');
  });

  it('html format builds nested list with escaped text', async () => {
    const r = await run('# A\n## B', { format: 'html' });
    expect(r.output).toContain('<ul>');
    expect(r.output).toContain('<li><a href="#a">A</a></li>');
    expect(r.output).toContain('<li><a href="#b">B</a></li>');
  });

  it('skips #-only lines and over-depth headings', async () => {
    const r = await run('#\n## Fine\n### D\n## Good', { depth: 2 });
    expect(r.output).toContain('- [Fine](#fine)');
    expect(r.output).toContain('- [Good](#good)');
    expect(r.output).not.toContain('D');
  });

  it('rejects empty input and missing headings', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a markdown/i);
    await expect(run('no headings here')).rejects.toThrow(/no headings found/i);
  });
});
