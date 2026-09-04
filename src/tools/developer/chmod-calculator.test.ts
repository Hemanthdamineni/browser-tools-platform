import { describe, it, expect } from 'vitest';
import tool from './chmod-calculator.tool';

interface Res {
  output: string;
  stats?: Record<string, string | number>;
}

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Res;

const table = (r: Res) => JSON.parse(r.output) as { headers: string[]; rows: string[][] };

describe('chmod-calculator', () => {
  it('converts octal 755 to symbolic', () => {
    const r = run('755');
    expect(r.stats!.octal).toBe('0755');
    expect(r.stats!.symbolic).toBe('rwxr-xr-x');
    const t = table(r);
    expect(t.headers).toEqual(['Class', 'Read', 'Write', 'Execute', 'Special']);
    expect(t.rows[0]).toEqual(['Owner', 'yes', 'yes', 'yes', '-']);
    expect(t.rows[1]).toEqual(['Group', 'yes', 'no', 'yes', '-']);
    expect(t.rows[2]).toEqual(['Other', 'yes', 'no', 'yes', '-']);
  });

  it('converts symbolic rwxr-xr-x to octal', () => {
    expect(run('rwxr-xr-x').stats!.octal).toBe('0755');
  });

  it('handles a leading 0 in octal input', () => {
    expect(run('0644').stats!.symbolic).toBe('rw-r--r--');
  });

  it('parses the setuid special bit (4755)', () => {
    const r = run('4755');
    expect(r.stats!.symbolic).toBe('rwsr-xr-x');
    expect(table(r).rows[0]).toEqual(['Owner', 'yes', 'yes', 'yes', 'setuid']);
  });

  it('parses setgid (2755) and sticky (1755)', () => {
    expect(run('2755').stats!.symbolic).toBe('rwxr-sr-x');
    expect(run('1755').stats!.symbolic).toBe('rwxr-xr-t');
  });

  it('accepts a 10-char symbolic string with a file-type prefix', () => {
    expect(run('-rwsr-xr-x').stats!.octal).toBe('4755');
    expect(run('drwxr-xr-x').stats!.octal).toBe('0755');
  });

  it('distinguishes uppercase S (special bit without execute)', () => {
    expect(run('rwSr-xr-x').stats!.octal).toBe('4655');
    expect(run('4655').stats!.symbolic).toBe('rwSr-xr-x');
  });

  it('respects the to-symbolic direction option', () => {
    expect(run('700', { mode: 'to-symbolic' }).stats!.symbolic).toBe('rwx------');
    expect(() => run('rwx------', { mode: 'to-symbolic' })).toThrow(/expects an octal/i);
  });

  it('respects the to-octal direction option', () => {
    expect(run('rwx------', { mode: 'to-octal' }).stats!.octal).toBe('0700');
    expect(() => run('700', { mode: 'to-octal' })).toThrow(/expects a symbolic/i);
  });

  it('throws ToolError on invalid input', () => {
    expect(() => run('999')).toThrow(/not a valid permission mode/i);
    expect(() => run('rwxr-xr')).toThrow(/not a valid permission mode/i);
    expect(() => run('hello world')).toThrow(/not a valid permission mode/i);
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
  });
});
