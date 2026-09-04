import { describe, it, expect } from 'vitest';
import tool from './nato-phonetic.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('nato-phonetic', () => {
  it('spells letters with NATO words by default', () => {
    expect(run('SOS').output).toBe('Sierra Oscar Sierra');
    expect(run('abc').output).toBe('Alfa Bravo Charlie');
  });

  it('spells digits, using Niner for 9', () => {
    expect(run('AB12').output).toBe('Alfa Bravo One Two');
    expect(run('90').output).toBe('Niner Zero');
  });

  it('drops spaces and passes other characters through as their own token', () => {
    expect(run('Hi!').output).toBe('Hotel India !');
    expect(run('A-B').output).toBe('Alfa - Bravo');
  });

  it('reads phonetic words back to text, case-insensitively', () => {
    expect(run('Sierra Oscar Sierra', { mode: 'phonetic-to-text' }).output).toBe('SOS');
    expect(run('alfa BRAVO oNe two', { mode: 'phonetic-to-text' }).output).toBe('AB12');
  });

  it('round-trips through both directions', () => {
    const phonetic = run('Zulu9!').output;
    expect(phonetic).toBe('Zulu Uniform Lima Uniform Niner !');
    expect(run(phonetic, { mode: 'phonetic-to-text' }).output).toBe('ZULU9!');
  });

  it('keeps unknown tokens verbatim on the reverse pass', () => {
    expect(run('Hotel India !', { mode: 'phonetic-to-text' }).output).toBe('HI!');
  });

  it('throws ToolError when reverse input has no phonetic words', () => {
    expect(() => run('hello world', { mode: 'phonetic-to-text' })).toThrow(/no nato phonetic/i);
  });

  it('empty input → empty output in both modes', () => {
    expect(run('').output).toBe('');
    expect(run('   ').output).toBe('');
    expect(run('', { mode: 'phonetic-to-text' }).output).toBe('');
  });
});
