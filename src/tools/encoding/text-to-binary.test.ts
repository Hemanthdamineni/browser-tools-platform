import { describe, expect, it } from 'vitest';
import tool from './text-to-binary.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('text-to-binary', () => {
  it('encodes ASCII to 8-bit groups', async () => {
    const r = await run('Hi');
    expect(r.output.trim()).toBe('01001000 01101001');
    expect(r.stats?.bytes).toBe(2);
    expect(r.stats?.bits).toBe(16);
  });

  it('round-trips UTF-8 (emoji and accented text)', async () => {
    const src = 'é中🚀';
    const encoded = await run(src);
    const decoded = await run(encoded.output.trim().replace(/ /g, ' '), { mode: 'decode', separator: 'none' });
    expect(decoded.output.trim()).toBe(src);
  });

  it('decodes binary with acceptable whitespace', async () => {
    const r = await run('  01001000\t01101001\n', { mode: 'decode' });
    expect(r.output.trim()).toBe('Hi');
  });

  it('rejects binary whose length is not a multiple of 8', async () => {
    let caught: unknown;
    try {
      await run('0100100', { mode: 'decode' });
    } catch (e) {
      caught = e;
    }
    const err = caught as { message?: string; hint?: string };
    expect(err.message).toMatch(/multiple of 8/);
    expect((err.hint ?? '').replace(/\n/g, ' ')).toContain('7 bits');
  });

  it('decodes lone non-ASCII byte sequences via UTF-8', async () => {
    const r = await run('11100100 10111000 10101101', { mode: 'decode' });
    expect(r.output.trim()).toBe('中');
  });

  it('supports nibble grouping and no separator', async () => {
    const nibbled = await run('Hi', { groupBy: '4' });
    expect(nibbled.output.replace(/\n/g, '').replace(/\s+/g, ' ').trim()).toContain('0100 1000');
    const none = await run('Hi', { separator: 'none' });
    expect(none.output.trim()).toBe('0100100001101001');
  });

  it('rejects empty and non-binary input', async () => {
    await expect(run('   ', { mode: 'encode' })).rejects.toThrow(/paste some text/i);
    let caught: unknown;
    try {
      await run('xyz', { mode: 'decode' });
    } catch (e) {
      caught = e;
    }
    const err = caught as { message?: string; hint?: string };
    expect(err.message).toMatch(/No binary digits/);
  });
});
