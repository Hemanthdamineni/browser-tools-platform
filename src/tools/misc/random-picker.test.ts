import { describe, it, expect } from 'vitest';
import tool from './random-picker.tool';
import { ToolError } from '@/lib/types';

const run = async (
  text: string,
  options: Record<string, string | number | boolean> = {},
) => await tool.run({ text, options });

describe('random-picker', () => {
  const LIST = 'apple\nbanana\ncherry\ndate';

  it('shuffles the list into a permutation', async () => {
    const r = await run(LIST, { mode: 'shuffle' });
    const out = (r.output as string).split('\n');
    expect(out).toHaveLength(4);
    expect([...out].sort()).toEqual(['apple', 'banana', 'cherry', 'date']);
  });

  it('deals items round-robin into teams', async () => {
    const r = await run(LIST, { mode: 'teams', teamCount: 2 });
    const table = JSON.parse(r.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual(['Team', 'Members']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]![1]!.split(', ')).toHaveLength(2);
    expect(table.rows[1]![1]!.split(', ')).toHaveLength(2);
  });

  it('picks a number of distinct items', async () => {
    const r = await run(LIST, { mode: 'pick', pickCount: 2 });
    const picked = (r.output as string).split('\n');
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
    expect(['apple', 'banana', 'cherry', 'date']).toEqual(expect.arrayContaining(picked));
  });

  it('parses a single comma-separated line as a list', async () => {
    const r = await run('alice, bob, carol', { mode: 'shuffle' });
    expect((r.output as string).split('\n')).toHaveLength(3);
  });

  it('trims and drops blank lines by default', async () => {
    const r = await run('  alpha  \n\n beta\n', { mode: 'order' });
    const out = (r.output as string).split('\n');
    expect(out).toHaveLength(2);
    expect(out.every((x) => x.trim() === x)).toBe(true);
  });

  it('rejects an empty list and a pick count above the list size', async () => {
    await expect(run('\n\n', { mode: 'shuffle' })).rejects.toThrow(ToolError);
    await expect(run(LIST, { mode: 'pick', pickCount: 9 })).rejects.toThrow(ToolError);
  });
});
