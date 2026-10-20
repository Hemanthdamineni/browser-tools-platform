import { describe, expect, it } from 'vitest';
import tool from './csv-to-markdown.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('csv-to-markdown', () => {
  it('builds a GFM table with header and auto alignment row', async () => {
    const r = await run('Name,Score\nAda,3\nTuring,120');
    expect(r.render).toBe('code');
    expect(r.output).toBe(
      '| Name | Score |\n' + '| --- | ---: |\n' + '| Ada | 3 |\n' + '| Turing | 120 |\n',
    );
    expect(r.stats?.rows).toBe(2);
    expect(r.stats?.columns).toBe(2);
  });

  it('treats text columns as left-aligned', async () => {
    const r = await run('Name,Score\nAda,3\nTuring,120');
    expect(r.output.split('\n')[1]!).toBe('| --- | ---: |');
  });

  it('auto aligns Score as numeric and Name as text', async () => {
    const r = await run('Name,Score\nAda,3\nTuring,120');
    expect(r.output).toMatch(/\| ---: \|/);
  });

  it('escapes literal pipes and collapses embedded newlines', async () => {
    const r = await run('a,b\n"x|y","line1\nline2"');
    expect(r.output).toContain('| x\\|y | line1 line2 |');
  });

  it('round-trips quoted commas', async () => {
    const r = await run('Name,Note\n"Smith, John","said ""hi"""');
    expect(r.output).toContain('| Smith, John | said "hi" |');
  });

  it('without a header uses the first row as data and pads width from it', async () => {
    const r = await run('1,x\n2,y', { header: false, justify: 'none' });
    expect(r.output).toBe('| 1 | x |\n| 2 | y |\n');
  });

  it('honors explicit left/center/right justification', async () => {
    const left = await run('a,b\n1,2', { justify: 'left' });
    expect(left.output.split('\n')[1]).toBe('| --- | --- |');
    const center = await run('a,b\n1,2', { justify: 'center' });
    expect(center.output.split('\n')[1]).toBe('| :---: | :---: |');
    const right = await run('a,b\n1,2', { justify: 'right' });
    expect(right.output.split('\n')[1]).toBe('| ---: | ---: |');
  });

  it('omits the alignment row when justify is none', async () => {
    const r = await run('a,b\n1,2', { justify: 'none' });
    expect(r.output.split('\n').length).toBe(3); // header + 1 data row (no separator)
    expect(r.output).not.toContain('---');
  });

  it('rejects blank input and a header-only file', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a csv/i);
    await expect(run('a,b')).rejects.toThrow(/no data rows/i);
  });

  it('rejects ragged rows with the offending line number', async () => {
    await expect(run('a,b\n1\n2,3', { justify: 'none' })).rejects.toThrow(/row 2 has 1 fields/i);
  });

  it('rejects an unterminated quoted field', async () => {
    await expect(run('a,b\n"oops')).rejects.toThrow(/unterminated/i);
  });

  it('notes the number of rows and columns', async () => {
    const r = await run('a,b,c\n1,2,3\n4,5,6', { justify: 'none' });
    expect(r.notes?.join(' ')).toMatch(/2 data rows.*3 columns/i);
  });
});
