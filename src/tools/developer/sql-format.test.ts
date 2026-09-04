import { describe, it, expect } from 'vitest';
import tool from './sql-format.tool';

const f = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output;

describe('sql-format', () => {
  it('breaks major clauses onto their own lines and uppercases keywords', () => {
    const out = f('select id, name from users where age > 18 order by name');
    expect(out).toContain('SELECT');
    expect(out).toContain('\nFROM users');
    expect(out).toContain('\nWHERE age > 18');
    expect(out).toContain('\nORDER BY name');
  });

  it('expands a multi-column SELECT list, one column per line', () => {
    const out = f('SELECT a, b, c FROM t');
    const lines = out.split('\n');
    expect(lines[0]).toBe('SELECT');
    expect(lines[1]).toBe('  a,');
    expect(lines[2]).toBe('  b,');
    expect(lines[3]).toBe('  c');
  });

  it('indents ON / AND / OR under their clause', () => {
    const out = f('select * from a join b on a.id = b.id and b.x = 1');
    expect(out).toContain('\n  ON a.id = b.id');
    expect(out).toContain('\n  AND b.x = 1');
  });

  it('respects the indent option', () => {
    expect(f('SELECT a, b FROM t', { indent: '4' })).toContain('\n    a,');
  });

  it('can leave keyword casing unchanged', () => {
    expect(f('select a from t', { uppercaseKeywords: false })).toContain('select a');
  });

  it('never reformats inside string literals or comments', () => {
    const out = f("SELECT 'from where select' AS s -- from here\nFROM t");
    expect(out).toContain("'from where select'");
    expect(out).toContain('-- from here');
  });

  it('does not corrupt numeric literals', () => {
    expect(f('SELECT a FROM t LIMIT 10')).toContain('LIMIT 10');
  });

  it('throws on an unterminated string literal', () => {
    expect(() => f("SELECT 'oops FROM t")).toThrow(/[Uu]nterminated/);
  });

  it('empty input returns empty output', () => {
    expect(f('')).toBe('');
  });
});
