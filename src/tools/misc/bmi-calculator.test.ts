import { describe, it, expect } from 'vitest';
import tool from './bmi-calculator.tool';
import { ToolError } from '@/lib/types';

const run = async (options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text: '', options });
const table = async (options: Record<string, string | number | boolean> = {}) =>
  JSON.parse((await run(options)).output) as { rows: string[][] };
const cell = (rows: string[][], label: string) => rows.find((r) => r[0] === label)![1]!;

describe('bmi-calculator', () => {
  it('computes metric BMI and category', async () => {
    const { rows } = await table({ units: 'metric', heightCm: 170, weightKg: 70 });
    expect(cell(rows, 'BMI')).toBe('24.2');
    expect(cell(rows, 'Category')).toBe('Normal');
  });
  it('computes imperial BMI', async () => {
    const { rows } = await table({ units: 'imperial', heightFt: 5, heightIn: 7, weightLb: 154 });
    expect(cell(rows, 'BMI')).toBe('24.1');
    expect(cell(rows, 'Category')).toBe('Normal');
  });
  it('categorises underweight and obese', async () => {
    expect(cell((await table({ heightCm: 180, weightKg: 50 })).rows, 'Category')).toBe(
      'Underweight',
    );
    expect(cell((await table({ heightCm: 160, weightKg: 90 })).rows, 'Category')).toBe('Obese');
  });
  it('rejects non-positive measurements', async () => {
    await expect(run({ heightCm: 0 })).rejects.toThrow(ToolError);
    await expect(run({ heightCm: 170, weightKg: -1 })).rejects.toThrow(ToolError);
  });
});
