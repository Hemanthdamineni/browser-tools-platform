import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './password.tool';

type Res = { output: string; render?: string; stats?: Record<string, string | number> };
const run = async (options: Record<string, string | number | boolean> = {}, text = '') =>
  (await tool.run({ text, options })) as Res;
const lines = (r: Res) => r.output.split('\n');

describe('password', async () => {
  it('generates one password of the requested length, rendered as code', async () => {
    const r = await run({ length: 20 });
    expect(lines(r)).toHaveLength(1);
    expect(lines(r)[0]!).toHaveLength(20);
    expect(r.render).toBe('code');
  });

  it('length option is honoured', async () => {
    expect(lines(await run({ length: 40 }))[0]!).toHaveLength(40);
    expect(lines(await run({ length: 4 }))[0]!).toHaveLength(4);
  });

  it('count option produces that many unique lines', async () => {
    const r = await run({ length: 24, count: 25 });
    expect(lines(r)).toHaveLength(25);
    expect(new Set(lines(r)).size).toBe(25);
    expect(r.stats!['generated']).toBe(25);
  });

  it('digits-only branch: known charset, pool size and entropy', async () => {
    const r = await run({ length: 10, uppercase: false, lowercase: false, symbols: false });
    expect(lines(r)[0]!).toMatch(/^[0-9]{10}$/);
    expect(r.stats!['pool size']).toBe(10);
    expect(r.stats!['entropy (bits)']).toBe(33); // round(log2(10) * 10)
  });

  it('lowercase-only and uppercase-only branches', async () => {
    expect(lines(await run({ length: 12, uppercase: false, digits: false, symbols: false }))[0]!).toMatch(
      /^[a-z]{12}$/,
    );
    expect(lines(await run({ length: 12, lowercase: false, digits: false, symbols: false }))[0]!).toMatch(
      /^[A-Z]{12}$/,
    );
  });

  it('symbols-only branch contains no alphanumerics', async () => {
    const s = lines(await run({ length: 16, uppercase: false, lowercase: false, digits: false }))[0]!;
    expect(s).toHaveLength(16);
    expect(/[A-Za-z0-9]/.test(s)).toBe(false);
  });

  it('guarantees at least one character from every selected class', async () => {
    for (let i = 0; i < 20; i++) {
      const s = lines(await run({ length: 8 }))[0]!;
      expect(/[A-Z]/.test(s)).toBe(true);
      expect(/[a-z]/.test(s)).toBe(true);
      expect(/[0-9]/.test(s)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(s)).toBe(true);
    }
  });

  it('avoidAmbiguous drops 0 O 1 l I | and backtick', async () => {
    for (let i = 0; i < 30; i++) {
      const s = lines(await run({ length: 40, avoidAmbiguous: true }))[0]!;
      expect(/[0O1lI|`]/.test(s)).toBe(false);
    }
  });

  it('throws ToolError when no character class is selected', async () => {
    await expect(run({ uppercase: false, lowercase: false, digits: false, symbols: false })).rejects.toThrow(
      ToolError,
    );
    await expect(run({ uppercase: false, lowercase: false, digits: false, symbols: false })).rejects.toThrow(
      /at least one character type/i,
    );
  });

  it('throws ToolError when length or count is not a number', async () => {
    await expect(run({ length: 'abc' })).rejects.toThrow(ToolError);
    await expect(run({ count: 'abc' })).rejects.toThrow(ToolError);
  });

  it('still generates for empty text input (it is a generator)', async () => {
    expect((await run({ length: 16 }, '')).output).not.toBe('');
  });

  it('reports a strength word', async () => {
    const r = await run({ length: 20 });
    expect(String(r.stats!['strength'])).toMatch(/very weak|weak|reasonable|strong|very strong/);
  });
});