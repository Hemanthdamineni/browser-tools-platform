import { describe, expect, it } from 'vitest';
import tool from './unicode-normalize.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; stats?: Record<string, string | number> };

describe('unicode-normalize', () => {
  it('composes canonically with NFC by default', () => {
    expect(run('Cafe\u0301').output).toBe('Café');
  });

  it('supports canonical and compatibility decomposition', () => {
    expect(run('é', { form: 'NFD' }).output).toBe('e\u0301');
    expect(run('① Ａ', { form: 'NFKD' }).output).toBe('1 A');
  });

  it('removes combining marks after normalization', () => {
    expect(run('Crème brûlée — déjà vu', { stripMarks: true }).output).toBe(
      'Creme brulee — deja vu',
    );
  });

  it('normalizes all supported line-ending styles', () => {
    const input = 'one\r\ntwo\rthree\nfour';
    expect(run(input, { lineEndings: 'lf' }).output).toBe('one\ntwo\nthree\nfour');
    expect(run(input, { lineEndings: 'crlf' }).output).toBe('one\r\ntwo\r\nthree\r\nfour');
    expect(run(input, { lineEndings: 'cr' }).output).toBe('one\rtwo\rthree\rfour');
  });

  it('preserves line endings by default and handles empty input', () => {
    expect(run('a\r\nb\rc').output).toBe('a\r\nb\rc');
    expect(run('').output).toBe('');
  });

  it('rejects invalid option values', () => {
    expect(() => run('abc', { form: 'BAD' })).toThrow(/normalization form/i);
    expect(() => run('abc', { lineEndings: 'BAD' })).toThrow(/line-ending/i);
  });
});
