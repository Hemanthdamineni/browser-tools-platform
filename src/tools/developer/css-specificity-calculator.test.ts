import { describe, expect, it } from 'vitest';
import tool from './css-specificity-calculator.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
interface Table {
  headers: string[];
  rows: string[][];
}
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): Table => JSON.parse(r.output) as Table;
const specOf = async (selector: string): Promise<string> => {
  const t = table(await run(selector));
  return t.rows[0]![2]!;
};

describe('css-specificity-calculator', () => {
  it('scores IDs, classes and types', async () => {
    expect(await specOf('#nav')).toBe('1,0,0');
    expect(await specOf('.item')).toBe('0,1,0');
    expect(await specOf('nav')).toBe('0,0,1');
    expect(await specOf('#nav .item:hover')).toBe('1,2,0');
    expect(await specOf('nav ul li a')).toBe('0,0,4');
  });

  it('scores attributes as classes and pseudo-elements as types', async () => {
    expect(await specOf('[type="text"]')).toBe('0,1,0');
    expect(await specOf('p::first-line')).toBe('0,0,2');
    expect(await specOf('a:hover::before')).toBe('0,1,2');
  });

  it('handles :not()/:is() with the most specific argument and :where() as zero', async () => {
    expect(await specOf(':not(#a, .b)')).toBe('1,0,0');
    expect(await specOf('div:is(.x, #y)')).toBe('1,0,1');
    expect(await specOf(':where(#a, .b) p')).toBe('0,0,1');
  });

  it('handles :nth-child(of …) specificity', async () => {
    // :nth-child() is one pseudo-class (0,1,0) plus its `of` argument (.item = 0,1,0), plus li (0,0,1).
    expect(await specOf('li:nth-child(2n of .item)')).toBe('0,2,1');
  });

  it('ranks multiple selectors and reports the winner', async () => {
    const r = await run('#nav .item:hover\nnav ul li a');
    const t = table(r);
    expect(t.rows[0]![1]).toBe('#nav .item:hover');
    expect(t.rows[0]![2]).toBe('1,2,0');
    expect(t.rows[1]![2]).toBe('0,0,4');
    expect(r.notes!.join(' ')).toMatch(/highest specificity/i);
  });

  it('reports ties when specificities match', async () => {
    const r = await run('.a .b\n.c .d');
    expect(r.notes!.join(' ')).toMatch(/tie/i);
    expect(r.notes!.join(' ')).toMatch(/source order/i);
  });

  it('uses the most specific selector in a comma list', async () => {
    expect(await specOf('.a, #b')).toBe('1,0,0');
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste one or more/i);
  });
});
