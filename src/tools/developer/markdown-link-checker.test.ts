import { describe, expect, it } from 'vitest';
import tool from './markdown-link-checker.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const table = (r: Result): Table => JSON.parse(r.output) as Table;

const kinds = (rows: string[][]) => rows.map((r) => r[1]);

describe('markdown-link-checker', () => {
  it('flags a broken fragment link', async () => {
    const r = await run('# Intro\n\nSee [details](#details) below.\n\nMore text.');
    const rows = table(r).rows;
    expect(kinds(rows)).toContain('broken-fragment');
    expect(rows.find((x) => x[1] === 'broken-fragment')![2]).toBe('details');
  });

  it('passes a valid internal fragment', async () => {
    const r = await run('# Intro\n\nSee [intro](#intro) below.');
    const rows = table(r).rows;
    expect(kinds(rows)).toContain('ok');
    expect(kinds(rows)).not.toContain('broken-fragment');
  });

  it('reports missing and unused reference definitions', async () => {
    const r = await run('Read the [guide][guide-ref].\n\n[unused]: https://x.dev');
    const rows = table(r).rows;
    expect(kinds(rows)).toContain('missing-definition');
    expect(kinds(rows)).toContain('unused-definition');
  });

  it('passes used references with a definition', async () => {
    const r = await run('Read [guide][guide-ref].\n\n[guide-ref]: https://x.dev');
    const rows = table(r).rows;
    expect(kinds(rows)).not.toContain('missing-definition');
    expect(kinds(rows)).not.toContain('unused-definition');
  });

  it('matches reference names case-insensitively', async () => {
    const r = await run('Read [guide][Guide-Ref].\n\n[guide-ref]: https://x.dev');
    expect(kinds(table(r).rows)).not.toContain('missing-definition');
  });

  it('flags empty url and empty-label link', async () => {
    const r = await run('Empty: [x]()\n\nPlain: [](https://y.dev)');
    const rows = table(r).rows;
    expect(kinds(rows)).toContain('empty-url');
    expect(rows.find((x) => x[2] === '(empty)')).toBeDefined();
  });

  it('flags empty anchor fragments', async () => {
    const r = await run('Link to nowhere: [x](#)');
    expect(kinds(table(r).rows)).toContain('empty-anchor');
  });

  it('reports duplicate heading anchors as warnings', async () => {
    const r = await run('# Notes\n\n# Notes\n\nMore');
    const rows = table(r).rows;
    expect(kinds(rows)).toContain('duplicate-anchor');
  });

  it('skips fenced code blocks and indented code', async () => {
    const r = await run(
      '```js\nsee [fake](#nope) here\n```\n\n    indented [also](#nope)\n\n# Real\n',
    );
    const rows = table(r).rows;
    expect(kinds(rows)).not.toContain('broken-fragment');
  });

  it('honors custom anchors in headings', async () => {
    const r = await run('# Overview {#top}\n\nJump to [top](#top).');
    expect(kinds(table(r).rows)).not.toContain('broken-fragment');
  });

  it('reports external links as info and honors the toggle', async () => {
    const r = await run('See [site](https://example.com) and [mail](mailto:a@b.io).');
    expect(kinds(table(r).rows).filter((k) => k === 'external').length).toBe(2);
    const off = await run('See [site](https://example.com).', { checkExternal: false });
    expect(kinds(table(off).rows)).not.toContain('external');
  });

  it('counts links and broken links in stats', async () => {
    const r = await run('# A\n\n[good](#a) [bad](#zzz) [site](https://x.dev)');
    expect(r.stats?.links).toBe(3);
    expect(r.stats?.internal).toBe(2);
    expect(r.stats?.external).toBe(1);
    expect(r.stats?.broken).toBe(1);
    expect(r.stats?.headings).toBe(1);
  });

  it('errors on blank input and oversized documents', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a markdown/i);
    await expect(run('x'.repeat(250_001))).rejects.toThrow(/too large/i);
  });
});
