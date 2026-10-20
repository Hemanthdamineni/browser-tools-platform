import { describe, expect, it } from 'vitest';
import tool from './html-validator.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const issues = (r: Result): string[][] =>
  (JSON.parse(r.output) as { headers: string[]; rows: string[][] }).rows;

describe('html-validator', () => {
  it('reports balanced tags', async () => {
    const r = await run('<p>hi</p>');
    expect(r.stats?.errors).toBe(0);
    expect(r.render).toBe('table');
  });

  it('flags an unclosed tag with its line', async () => {
    const r = await run('<div>\n  <p>hi\n  </p>');
    const rows = issues(r);
    expect(rows).toHaveLength(1);
    expect(rows[0]![1]).toContain('Unclosed <div>');
  });

  it('reports mismatched nesting', async () => {
    const r = await run('<div><span></div>');
    const rows = issues(r);
    expect(rows.some((row) => (row[1] ?? '').includes('<span>'))).toBe(true);
  });

  it('handles void elements and self-closing tags', async () => {
    const r = await run('<p>t<br><img src="x.png"><hr/>done</p>');
    expect(r.stats?.errors).toBe(0);
  });

  it('treats script/style as raw text', async () => {
    const r = await run('<script>if (a < b) { x() }</script><p>ok</p>');
    expect(r.stats?.errors).toBe(0);
  });

  it('accepts self-closing XML-style tags', async () => {
    const r = await run('<div/><span/>');
    expect(r.stats?.errors).toBe(0);
  });

  it('catches stray <, unexpected close and unclosed comments', async () => {
    expect(issues(await run('a < b'))[0]![1]).toMatch(/[Ss]tray/);
    expect(issues(await run('</p>'))[0]![1]).toMatch(/Unexpected closing/);
    const c = await run('<!-- oops');
    expect(issues(c)[0]![1]).toMatch(/[Uu]nclosed comment/);
    const ok = await run('<!-- oops', { ignoreComments: true });
    expect(ok.stats?.errors).toBe(0);
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste some html/i);
  });
});
