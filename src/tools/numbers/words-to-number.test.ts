import { describe, expect, it } from 'vitest';
import tool from './words-to-number.tool';

type Result = { output: string; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('words-to-number', () => {
  it('parses simple numbers', async () => {
    expect((await run('one')).output.trim()).toBe('1');
    expect((await run('twenty-five')).output.trim()).toBe('25');
    expect((await run('zero')).output.trim()).toBe('0');
  });

  it('parses hundreds, thousands and big scales', async () => {
    expect((await run('one hundred')).output.trim()).toBe('100');
    expect((await run('two hundred and five')).output.trim()).toBe('205');
    expect((await run('three thousand')).output.trim()).toBe('3,000');
    expect((await run('two billion, four hundred thirty-five million')).output.trim()).toBe(
      '2,435,000,000',
    );
    expect((await run('one million two hundred thirty-four')).output.trim()).toBe('1,000,234');
  });

  it('handles decimals and negatives', async () => {
    expect((await run('two point five')).output.trim()).toBe('2.5');
    expect((await run('negative three')).output.trim()).toBe('-3');
    expect((await run('minus twenty')).output.trim()).toBe('-20');
  });

  it('concatenates consecutive digit words', async () => {
    expect((await run('one two three')).output.trim()).toBe('123');
  });

  it('ignores unrelated words and grouping toggle', async () => {
    const r = await run('The total is five thousand dollars');
    expect(r.output.trim()).toBe('5,000');
    expect((await run('five thousand', { grouping: false })).output.trim()).toBe('5000');
  });

  it('rejects empty and word-less input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste number words/i);
    await expect(run('apples bananas')).rejects.toThrow(/no number words/i);
  });
});
