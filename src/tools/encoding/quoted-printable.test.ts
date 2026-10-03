import { describe, it, expect } from 'vitest';
import tool from './quoted-printable.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('quoted-printable', async () => {
  it('decodes =XX escapes as UTF-8', async () => {
    expect((await run('J=C3=A9r=C3=B4me', { mode: 'decode' })).output).toBe('Jérôme');
  });
  it('removes soft line breaks', async () => {
    expect((await run('abc=\ndef', { mode: 'decode' })).output).toBe('abcdef');
    expect((await run('abc=\r\ndef', { mode: 'decode' })).output).toBe('abcdef');
  });
  it('leaves a bare = alone if not a valid escape', async () => {
    expect((await run('2 = 2', { mode: 'decode' })).output).toBe('2 = 2');
  });
  it('encodes non-ASCII', async () => {
    expect((await run('Café', { mode: 'encode' })).output).toBe('Caf=C3=A9');
  });
  it('encodes the = sign itself', async () => {
    expect((await run('a=b', { mode: 'encode' })).output).toBe('a=3Db');
  });
  it('round-trips', async () => {
    const s = 'Résumé — €10 \t tab & symbols';
    const encoded = (await run(s, { mode: 'encode' })).output;
    expect((await run(encoded, { mode: 'decode' })).output).toBe(s);
  });
  it('empty input', async () => {
    expect((await run('')).output).toBe('');
  });
});
