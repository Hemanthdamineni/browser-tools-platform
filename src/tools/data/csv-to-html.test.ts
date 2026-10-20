import { describe, expect, it } from 'vitest';
import tool from './csv-to-html.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('csv-to-html', () => {
  it('renders header and data rows into a table', async () => {
    const r = await run('name,role\nAda,Engineer\nGrace,Navigator');
    expect(r.output).toContain('<thead>');
    expect(r.output).toContain('<th>name</th>');
    expect(r.output).toContain('<td>Ada</td>');
    expect(r.output).toContain('<td>Engineer</td>');
    expect(r.output).not.toContain('<style>');
  });

  it('adds minimal inline CSS when requested', async () => {
    const r = await run('a,b\n1,2', { style: 'minimal' });
    expect(r.output).toContain('<style>');
    expect(r.output).toContain('border-collapse');
  });

  it('escapes HTML special characters in cells', async () => {
    const r = await run('x\n< b & "q" >');
    expect(r.output).toContain('<td>&lt; b &amp; &quot;q&quot; &gt;</td>');
  });

  it('handles quoted fields containing delimiter and newlines', async () => {
    const r = await run('a,b\n"x, y",2');
    expect(r.output).toContain('<td>x, y</td>');
    expect(r.output).toContain('<td>2</td>');
  });

  it('supports tab and pipe delimiters', async () => {
    const tab = await run('a\tb\n1\t2', { delimiter: 'tab' });
    expect(tab.output).toContain('<th>a</th>');
    const pipe = await run('a|b\n1|2', { delimiter: 'pipe' });
    expect(pipe.output).toContain('<th>a</th>');
  });

  it('pads short rows and appends Column N headers', async () => {
    const r = await run('a\n1,2\n3');
    expect(r.output).toContain('<th>Column 2</th>');
    expect(r.output).toContain('<td>1</td>');
    expect(r.output).toContain('<td></td>');
  });

  it('handles Unicode and preserves cell text', async () => {
    const r = await run('city,pop\n東京,14000000\nBerlin,3600000');
    expect(r.output).toContain('<td>東京</td>');
    expect(r.output).toContain('<td>Berlin</td>');
  });

  it('errors on blank input and empty CSV', async () => {
    await expect(run('   ')).rejects.toThrow(/paste csv/i);
    await expect(run(',')).rejects.toThrow(/no csv rows/i);
  });

  it('reports stats', async () => {
    const r = await run('a,b\n1,2\n3,4');
    expect(r.stats?.rows).toBe(2);
    expect(r.stats?.columns).toBe(2);
  });
});
