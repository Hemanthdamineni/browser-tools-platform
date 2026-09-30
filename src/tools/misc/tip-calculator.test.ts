import { describe, it, expect } from 'vitest';
import tool from './tip-calculator.tool';
import { ToolError } from '@/lib/types';

const run = async (options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text: '', options });
const table = async (options: Record<string, string | number | boolean> = {}) =>
  JSON.parse((await run(options)).output) as { rows: string[][] };
const cell = (rows: string[][], label: string) => rows.find((r) => r[0] === label)![1]!;

describe('tip-calculator', () => {
  it('computes tip, total and per-person split', async () => {
    const { rows } = await table({ bill: 100, tipPercent: 20, split: 4 });
    expect(cell(rows, 'Tip')).toBe('20.00 (20.00%)');
    expect(cell(rows, 'Total')).toBe('120.00');
    expect(cell(rows, 'Per person')).toBe('30.00');
    expect(cell(rows, 'Tip per person')).toBe('5.00');
  });
  it('rounds the per-person amount up when requested', async () => {
    const { rows } = await table({ bill: 100, tipPercent: 15, split: 3, roundUp: 'per-person' });
    expect(cell(rows, 'Per person')).toBe('39.00');
    expect(cell(rows, 'Total')).toBe('117.00');
  });
  it('rounds the total up when requested', async () => {
    const { rows } = await table({ bill: 100, tipPercent: 15, roundUp: 'total' });
    expect(cell(rows, 'Total')).toBe('115.00');
  });
  it('rejects a negative bill', async () => {
    await expect(run({ bill: -1 })).rejects.toThrow(ToolError);
  });
});
