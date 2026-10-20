import { describe, expect, it } from 'vitest';
import tool from './nato-alphabet.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('nato-alphabet', () => {
  it('encodes letters and digits into phonetic words', async () => {
    const r = await run('N73AB');
    expect(r.output).toBe('November Seven Three Alpha Bravo');
  });

  it('drops whitespace and joins tokens with a single space by default', async () => {
    const r = await run('Hi Jo');
    expect(r.output).toBe('Hotel India Juliett Oscar');
  });

  it('uppercases all phonetic words when requested', async () => {
    const r = await run('ab1', { uppercase: true });
    expect(r.output).toBe('ALPHA BRAVO ONE');
  });

  it('supports newline and comma separators', async () => {
    const lines = await run('ab', { separator: 'newline' });
    expect(lines.output).toBe('Alpha\nBravo');
    const commas = await run('ab', { separator: 'comma' });
    expect(commas.output).toBe('Alpha, Bravo');
  });

  it('passes punctuation through untouched', async () => {
    const r = await run('A-9/B');
    expect(r.output).toBe('Alpha - Nine / Bravo');
  });

  it('decodes phonetic words back into text', async () => {
    const r = await run('November Seven Three Alpha Bravo', { direction: 'decode' });
    expect(r.output).toBe('N73AB');
  });

  it('decodes case-insensitively and keeps compound words such as X-ray', async () => {
    const r = await run('x-ray yankee zulu', { direction: 'decode' });
    expect(r.output).toBe('XYZ');
  });

  it('preserves punctuation and brackets unknown words during decoding', async () => {
    const r = await run('Alpha - Zzz Bravo', { direction: 'decode' });
    expect(r.output).toBe('A-[Zzz]B');
    expect(r.notes?.join(' ')).toMatch(/unknown word/i);
  });

  it('rejects empty input in both directions', async () => {
    await expect(run('   ')).rejects.toThrow(/nothing to encode/i);
    await expect(run('  ,,;; ', { direction: 'decode' })).rejects.toThrow(/nothing to decode/i);
  });
});
