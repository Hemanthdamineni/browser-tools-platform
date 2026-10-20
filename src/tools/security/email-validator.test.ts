import { describe, expect, it } from 'vitest';
import tool from './email-validator.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): string[][] => (JSON.parse(r.output) as { headers: string[]; rows: string[][] }).rows;
const resultOf = (r: Result): string => table(r).find((row) => row[0] === 'Result')![1]!;

describe('email-validator', () => {
  it('accepts common valid addresses', async () => {
    expect(resultOf(await run('ada@example.com'))).toBe('Valid');
    expect(resultOf(await run('user.name+tag@mail.example.co.uk'))).toBe('Valid');
    expect(resultOf(await run('a@b.co'))).toBe('Valid');
  });

  it('renders a table with check rows', async () => {
    const r = await run('ada@example.com');
    expect(r.render).toBe('table');
    const rows = table(r);
    expect(rows.some((row) => row[0] === 'TLD' && row[1] === 'com')).toBe(true);
    expect(rows.some((row) => row[0] === 'At signs' && row[1] === '1')).toBe(true);
  });

  it('rejects addresses without or with multiple @', async () => {
    expect(resultOf(await run('not-an-email'))).toBe('Invalid');
    expect(resultOf(await run('a@b@c.com'))).toBe('Invalid');
  });

  it('rejects whitespace, bad locals and bad domains', async () => {
    expect(resultOf(await run('a b@c.com'))).toBe('Invalid');
    expect(resultOf(await run('.ada@x.com'))).toBe('Invalid');
    expect(resultOf(await run('ada..b@x.com'))).toBe('Invalid');
    expect(resultOf(await run('a@-lead.com'))).toBe('Invalid');
  });

  it('enforces an LLD of 2+ letters when required', async () => {
    expect(resultOf(await run('a@b.c'))).toBe('Invalid');
    expect(resultOf(await run('a@b.c', { requireTld: false }))).toBe('Valid');
  });

  it('rejects over-long local parts', async () => {
    const longLocal = 'a'.repeat(65) + '@x.com';
    expect(resultOf(await run(longLocal))).toBe('Invalid');
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/enter an email/i);
  });
});
