import { describe, expect, it } from 'vitest';
import tool from './origin-header.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string) => tool.run({ text, options: {} }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('origin-header', () => {
  it('validates a standard cross-origin value', () => {
    const result = run('Origin: https://app.example.com');
    expect(result.stats).toMatchObject({ valid: 'yes', origin: 'Origin: https://app.example.com' });
    expect(rows(result)[0]?.[1]).toBe('Valid');
  });

  it('accepts the literal null origin with a note', () => {
    const result = run('null');
    expect(result.stats?.valid).toBe('yes');
    expect(result.notes?.join(' ')).toContain('null origin');
  });

  it('flags trailing paths and invalid schemes', () => {
    const result = run('https://example.com/path');
    expect(result.stats?.valid).toBe('no');
    expect(result.notes?.join(' ')).toContain('Trailing');
  });

  it('flags missing port validation', () => {
    const result = run('https://example.com:notaport');
    expect(result.stats?.valid).toBe('no');
    expect(result.notes?.join(' ')).toContain('Port');
  });

  it('handles blank analysis with guidance', () => {
    expect(run('').notes?.[0]).toContain('Paste');
  });

  it('strips an explicit header label before analyzing', () => {
    const result = run('Origin: https://api.example.com');
    expect(result.stats?.valid).toBe('yes');
    expect(result.notes?.join(' ')).toContain('Stripped');
  });
});
