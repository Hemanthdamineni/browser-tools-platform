import { describe, it, expect } from 'vitest';
import tool from './vcard.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; render?: string };

describe('vcard', () => {
  it('builds the Ada Lovelace card', () => {
    const out = run('', {
      mode: 'build',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@x.io',
    });
    expect(out).toContain('FN:Ada Lovelace');
    expect(out).toContain('N:Lovelace;Ada;;;');
    expect(out).toContain('EMAIL;TYPE=INTERNET:ada@x.io');
    expect(out).toContain('END:VCARD');
  });

  it('escapes commas and semicolons in values', () => {
    const out = run('', { mode: 'build', firstName: 'A', lastName: 'B', note: 'met, at conf' });
    expect(out).toContain('NOTE:met\\, at conf');
  });

  it('empty build throws', () => {
    expect(() => run('', { mode: 'build' })).toThrow(/name or email/);
  });

  it('parses a pasted vCard into a table', () => {
    const card =
      'BEGIN:VCARD\nVERSION:3.0\nFN:Ada Lovelace\nEMAIL;TYPE=INTERNET:ada@x.io\nEND:VCARD';
    const res = run(card, { mode: 'parse' });
    expect(res.render).toBe('table');
    const parsed = JSON.parse(res.output) as { rows: string[][] };
    expect(parsed.rows).toContainEqual(['Full name', 'Ada Lovelace']);
    expect(parsed.rows).toContainEqual(['Email', 'ada@x.io']);
  });

  it('parse round-trips a built card', () => {
    const built = run('', {
      mode: 'build',
      firstName: 'Grace',
      lastName: 'Hopper',
      org: 'US Navy',
    }).output;
    const parsed = JSON.parse(run(built, { mode: 'parse' }).output) as { rows: string[][] };
    expect(parsed.rows).toContainEqual(['Full name', 'Grace Hopper']);
    expect(parsed.rows).toContainEqual(['Organization', 'US Navy']);
  });

  it('parse of non-vCard text throws', () => {
    expect(() => run('hello world', { mode: 'parse' })).toThrow(/not a vCard/);
  });
});
