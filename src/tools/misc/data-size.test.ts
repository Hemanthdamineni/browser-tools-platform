import { describe, it, expect } from 'vitest';
import tool from './data-size.tool';
import { ToolError } from '@/lib/types';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });
const table = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  JSON.parse((await run(text, options)).output) as { rows: string[][] };
const cell = (rows: string[][], label: string) => rows.find((r) => r[0] === label)![1]!;

describe('data-size', () => {
  it('converts decimal GB to decimal MB and binary MiB/GiB', async () => {
    const { rows } = await table('1', { from: 'GB', to: 'MB' });
    expect(cell(rows, 'Result (MB)')).toBe('1000');
    const rows2 = (await table('1', { from: 'GB', to: 'MiB' })).rows;
    expect(cell(rows2, 'Result (MiB)')).toBe('953.67431640625');
    const rows3 = (await table('1', { from: 'GB', to: 'GiB' })).rows;
    expect(cell(rows3, 'Result (GiB)')).toBe('0.9313225746154785');
  });
  it('converts bits to bytes', async () => {
    const { rows } = await table('8', { from: 'bit', to: 'B' });
    expect(cell(rows, 'Result (B)')).toBe('1');
  });
  it('ignores thousands separators', async () => {
    const { rows } = await table('1,000', { from: 'KB', to: 'MB' });
    expect(cell(rows, 'Result (MB)')).toBe('1');
  });
  it('rejects non-numeric input', async () => {
    await expect(run('abc', { from: 'MB', to: 'MiB' })).rejects.toThrow(ToolError);
  });
});
