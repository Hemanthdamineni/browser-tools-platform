import { describe, it, expect } from 'vitest';
import tool from './aspect-ratio.tool';
import { ToolError } from '@/lib/types';

const run = async (options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text: '', options });
const table = async (options: Record<string, string | number | boolean> = {}) =>
  JSON.parse((await run(options)).output) as { rows: string[][] };
const cell = (rows: string[][], label: string) => rows.find((r) => r[0] === label)![1]!;

describe('aspect-ratio', () => {
  it('solves the missing dimension from a known width', async () => {
    const { rows } = await table({ mode: 'solve', ratioW: 16, ratioH: 9, knownWidth: 1920 });
    expect(cell(rows, 'Height')).toBe('1080.00');
    expect(cell(rows, 'Aspect ratio')).toBe('16:9');
  });
  it('solves the missing dimension from a known height', async () => {
    const { rows } = await table({ mode: 'solve', ratioW: 4, ratioH: 3, knownHeight: 900 });
    expect(cell(rows, 'Width')).toBe('1200.00');
  });
  it('simplifies a ratio and names it', async () => {
    const { rows } = await table({ mode: 'simplify', ratioW: 1920, ratioH: 1080 });
    expect(cell(rows, 'Simplified ratio')).toBe('16:9');
    expect(cell(rows, 'Nearest common ratio')).toBe('16:9');
    expect(cell(rows, 'Decimal')).toBe('1.778');
  });
  it('lists common resolutions in presets mode', async () => {
    const { rows } = await table({ mode: 'presets' });
    expect(rows.length).toBeGreaterThan(3);
  });
  it('rejects a zero ratio and a solve with no known dimension', async () => {
    await expect(run({ mode: 'simplify', ratioW: 0, ratioH: 9 })).rejects.toThrow(ToolError);
    await expect(run({ mode: 'solve', ratioW: 16, ratioH: 9 })).rejects.toThrow(ToolError);
  });
});
