import { describe, expect, it } from 'vitest';
import tool from './barcode-validator.tool';

type Result = { output: string; render?: string; stats?: Record<string, string | number>; notes?: string[] };
type Table = { headers: string[]; rows: [string, string][] };

const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;
const table = (text: string, options: Record<string, string | number | boolean> = {}) => JSON.parse(run(text, options).output) as Table;
const get = (text: string, key: string, options: Record<string, string | number | boolean> = {}) =>
  table(text, options).rows.find((r) => r[0] === key)?.[1];

describe('barcode-validator', () => {
  it('shows guidance on blank input', () => {
    const result = run(' ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/paste a barcode/i);
  });

  it('validates a real EAN-13 and identifies its country group', () => {
    const result = run('4006381333931');
    expect(result.stats?.valid).toBe(1);
    expect(get('4006381333931', 'Format')).toBe('EAN-13');
    expect(get('4006381333931', 'Country group')).toBe('Germany');
    expect(get('4006381333931', 'Result')).toMatch(/matches/);
  });

  it('validates a real UPC-A', () => {
    const result = run('036000291452');
    expect(result.stats?.valid).toBe(1);
    expect(get('036000291452', 'Format')).toBe('UPC-A');
    expect(get('036000291452', 'Country group')).toBe('US / Canada');
  });

  it('accepts ISBN-13 as an EAN-13 barcode', () => {
    const result = run('9780306406157');
    expect(result.stats?.valid).toBe(1);
    expect(get('9780306406157', 'Format')).toBe('EAN-13');
  });

  it('rejects a barcode with a corrupted check digit', () => {
    const result = run('4006381333930');
    expect(result.stats?.valid).toBe(0);
    expect(get('4006381333930', 'Result')).toMatch(/does not match expected 1/i);
  });

  it('rejects non-standard lengths and non-numeric input', () => {
    expect(run('12345').stats?.valid).toBe(0);
    expect(run('1').stats?.valid).toBe(0);
    expect(() => run('12a3456')).not.toThrow();
  });

  it('ignores spaces and dashes', () => {
    const result = run(' 400-638-133-3931 ');
    expect(result.stats?.valid).toBe(1);
  });

  it('computes a check digit and produces a complete barcode', () => {
    const result = run('400638133393', { mode: 'checkdigit' });
    expect(result.stats?.checkDigit).toBe(1);
    const rows = table('400638133393', { mode: 'checkdigit' }).rows;
    expect(rows.find((r) => r[0] === 'Complete barcode')?.[1]).toBe('4006381333931');
  });

  it('detects UPC-E and GTIN-14 lengths', () => {
    expect(get('012345', 'Format')).toBe('UPC-E');
    expect(get('00000012345678', 'Format')).toBe('GTIN-14');
  });
});
