import { describe, expect, it } from 'vitest';
import tool from './html-to-csv.tool';

type Result = {
  output: string;
  render?: string;
  language?: string;
  stats?: Record<string, number>;
  notes?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('html-to-csv', () => {
  it('converts a simple table to CSV', async () => {
    const r = await run(
      '<table><tr><th>Name</th><th>Score</th></tr><tr><td>Ada</td><td>98</td></tr></table>',
    );
    expect(r.language).toBe('csv');
    expect(r.output).toBe('Name,Score\nAda,98\n');
    expect(r.stats?.tables).toBe(1);
  });

  it('strips tags and decodes entities in cells', async () => {
    const r = await run('<table><tr><td><b>Hi</b> &amp; bye</td><td>&#169; 2024</td></tr></table>');
    expect(r.output).toBe('Hi & bye,© 2024\n');
  });

  it('skips nested tables', async () => {
    const html =
      '<table><tr><td>outer1</td><td><table><tr><td>inner</td></tr></table></td></tr>' +
      '<tr><td>outer2</td><td>v</td></tr></table>';
    const r = await run(html);
    expect(r.output).toBe('outer1,\nouter2,v\n');
  });

  it('honors rowspan by padding later rows', async () => {
    const html = '<table><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></table>';
    const r = await run(html);
    expect(r.output).toBe('A,B\nA,C\n');
  });

  it('honors colspan by blank continuation cells', async () => {
    const r = await run('<table><tr><td colspan="2">wide</td></tr></table>');
    expect(r.output).toBe('wide,\n');
  });

  it('quotes fields containing commas or quotes', async () => {
    const r = await run('<table><tr><td>hello, world</td><td>say "hi"</td></tr></table>');
    expect(r.output).toBe('"hello, world","say ""hi"""\n');
  });

  it('exports all tables or just the first', async () => {
    const html = '<table><tr><td>a1</td></tr></table><table><tr><td>b1</td></tr></table>';
    const first = await run(html);
    expect(first.output).toBe('a1\n');
    const all = await run(html, { mode: 'all' });
    expect(all.output).toBe('a1\n\nb1\n');
    expect(all.stats?.tables).toBe(2);
  });

  it('rejects empty input and table-less HTML', async () => {
    await expect(run('   ')).rejects.toThrow(/paste an html/i);
    await expect(run('<p>no table here</p>')).rejects.toThrow(/no <table>/i);
  });
});
