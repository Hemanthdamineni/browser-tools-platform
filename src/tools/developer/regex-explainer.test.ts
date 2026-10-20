import { describe, expect, it } from 'vitest';
import tool from './regex-explainer.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
type Table = { headers: string[]; rows: string[][] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (result: Result): Table => JSON.parse(result.output) as Table;
const meaningOf = (result: Result, token: string): string | undefined =>
  table(result).rows.find((row) => row[1] === token)?.[2];

describe('regex-explainer', () => {
  it('explains anchors, classes and quantifiers with flags', async () => {
    const r = await run('^[a-z0-9_-]{3,16}$', { flags: 'i' });
    expect(r.render).toBe('table');
    expect(table(r).headers).toEqual(['#', 'Token', 'What it does']);
    expect(meaningOf(r, '^')).toMatch(/start of the input/);
    expect(meaningOf(r, '$')).toMatch(/end of the input/);
    const cls = table(r).rows.find((row) => row[1]!.startsWith('[a-z0-9_-]'));
    expect(cls?.[2]).toMatch(/between 3 and 16/);
    expect(r.stats?.captures).toBe(0);
  });

  it('distinguishes group kinds and counts captures', async () => {
    const r = await run('(?<year>\\d{4})');
    const named = table(r).rows.find((row) => row[1] === '(?<year>');
    expect(named?.[2]).toContain('named capturing group "year"');
    const digit = table(r).rows.find((row) => row[1] === '\\d {4}');
    expect(digit?.[2]).toMatch(/any digit/);
    expect(digit?.[2]).toMatch(/exactly 4/);
    expect(r.stats?.captures).toBe(1);
  });

  it('reads lookahead, non-capturing and backreference syntax', async () => {
    const ahead = await run('(?=x)');
    expect(meaningOf(ahead, '(?=')).toContain('lookahead');
    const non = await run('(?:ab)');
    expect(meaningOf(non, '(?:')).toContain('non-capturing group');
    const back = await run('(a)\\1');
    const ref = table(back).rows.find((row) => row[1] === '\\1');
    expect(ref?.[2]).toContain('backreference');
  });

  it('handles alternation, dot and the dotAll flag', async () => {
    const plain = await run('^a.b|c$');
    expect(meaningOf(plain, '|')).toContain('alternation');
    expect(meaningOf(plain, '.')).toContain('except line terminators');
    const dotAll = await run('a.b', { flags: 's' });
    expect(meaningOf(dotAll, '.')).toContain('including line terminators');
  });

  it('explains escapes, including hex, unicode and properties', async () => {
    const r = await run('\\d\\s\\u{1F600}');
    expect(meaningOf(r, '\\d')).toContain('any digit');
    expect(meaningOf(r, '\\s')).toContain('whitespace');
    expect(table(r).rows.some((row) => row[1] === '\\u{1F600}')).toBe(true);
    const prop = await run('\\p{Letter}');
    expect(table(prop).rows.some((row) => row[1] === '\\p{Letter}')).toBe(true);
  });

  it('marks unclosed classes and keeps quiet on unknown escapes', async () => {
    const r = await run('[abc');
    expect(r.stats?.tokens).toBe(1);
    expect(table(r).rows[0]?.[2]).toContain('never closed');
    const lit = await run('\\q');
    expect(meaningOf(lit, '\\q')).toContain('escaped literal q');
  });

  it('decodes flags into notes', async () => {
    const r = await run('a+', { flags: 'im' });
    expect(r.notes?.join(' ')).toContain('case-insensitive');
    expect(r.notes?.join(' ')).toContain('multiline');
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/regular expression/i);
  });
});
