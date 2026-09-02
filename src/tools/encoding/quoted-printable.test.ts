import { describe, it, expect } from 'vitest';
import tool from './quoted-printable.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('quoted-printable', () => {
  it('decodes =XX escapes as UTF-8', () => {
    expect(run('J=C3=A9r=C3=B4me', { mode: 'decode' }).output).toBe('Jérôme');
  });
  it('removes soft line breaks', () => {
    expect(run('abc=\ndef', { mode: 'decode' }).output).toBe('abcdef');
    expect(run('abc=\r\ndef', { mode: 'decode' }).output).toBe('abcdef');
  });
  it('leaves a bare = alone if not a valid escape', () => {
    expect(run('2 = 2', { mode: 'decode' }).output).toBe('2 = 2');
  });
  it('encodes non-ASCII', () => {
    expect(run('Café', { mode: 'encode' }).output).toBe('Caf=C3=A9');
  });
  it('encodes the = sign itself', () => {
    expect(run('a=b', { mode: 'encode' }).output).toBe('a=3Db');
  });
  it('round-trips', () => {
    const s = 'Résumé — €10 \t tab & symbols';
    expect(run(run(s, { mode: 'encode' }).output, { mode: 'decode' }).output).toBe(s);
  });
  it('empty input', () => {
    expect(run('').output).toBe('');
  });
});
