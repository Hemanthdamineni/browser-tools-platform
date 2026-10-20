import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './vin-validator.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('vin-validator', () => {
  it('decodes and validates a structurally valid VIN', () => {
    const result = run('1HGCM82633A004352');
    expect(result.stats?.valid).toBe('yes');
    expect(result.stats?.region).toBe('North America');
    expect(result.notes?.join(' ')).toContain('validated');
  });

  it('validate mode passes for a good VIN', () => {
    expect(run('1HGCM82633A004352', { mode: 'validate' }).stats?.valid).toBe('yes');
  });

  it('rejects illegal letters I, O, Q', () => {
    const result = run('1HGO82633A0043521');
    expect(result.stats?.valid).toBe('no');
  });

  it('flags wrong length', () => {
    const result = run('1HGCM8263');
    expect(result.stats?.valid).toBe('no');
    expect((result as { notes?: string[] }).notes?.join(' ')).toContain('17');
  });

  it('catches a check-digit mismatch', () => {
    const tampered = '1HGCM82639A004352';
    const result = run(tampered);
    expect(result.stats?.valid).toBe('no');
    expect(result.notes?.join(' ')).toContain('Check digit');
  });

  it('generates a full VIN from a body and handles blank input', () => {
    const result = run('1HGCM8263A004352', { mode: 'generate' });
    expect(result.output).toHaveLength(17);
    expect(run(result.output).stats?.valid).toBe('yes');
    expect(run('').notes?.[0]).toContain('Paste');
    expect(() => run('too short!', { mode: 'generate' })).toThrow(ToolError);
  });
});
