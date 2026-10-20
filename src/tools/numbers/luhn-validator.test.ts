import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './luhn-validator.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('luhn-validator', () => {
  it('validates a valid card number', () => {
    const result = run('4539 1488 0343 6467');
    expect(result.stats?.valid).toBe('yes');
    expect(result.stats?.network).toBe('Visa (starts with 4)');
  });

  it('flags an invalid number', () => {
    const result = run('4539 1488 0343 6468');
    expect(result.stats?.valid).toBe('no');
  });

  it('ignores spaces and dashes', () => {
    expect(run('4539-1488-0343-6467').stats?.valid).toBe('yes');
  });

  it('computes the expected check digit', () => {
    const result = run('453914880343646', { mode: 'check-digit' });
    expect(result.stats?.checkDigit).toBe(7);
  });

  it('generates a number with a valid check digit', () => {
    const result = run('7992739871', { mode: 'generate' });
    expect(result.stats?.checkDigit).toBe(3);
    expect(run(result.output).stats?.valid).toBe('yes');
  });

  it('rejects non-digits and handles blank input', () => {
    expect(() => run('abc')).toThrow(ToolError);
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
