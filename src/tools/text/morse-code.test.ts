import { describe, it, expect } from 'vitest';
import tool from './morse-code.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; warnings?: string[] };

describe('morse-code', () => {
  it('encodes text to Morse by default', () => {
    expect(run('SOS').output).toBe('... --- ...');
    expect(run('Hello World').output).toBe('.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
  });

  it('encodes digits and punctuation', () => {
    expect(run('E1?').output).toBe('. .---- ..--..');
  });

  it('replaces unsupported characters with "?" and warns', () => {
    const res = run('A~B');
    expect(res.output).toBe('.- ? -...');
    expect(res.warnings?.[0]).toMatch(/~/);
  });

  it('decodes Morse to text', () => {
    expect(
      run('.... . .-.. .-.. --- / .-- --- .-. .-.. -..', { mode: 'morse-to-text' }).output,
    ).toBe('HELLO WORLD');
  });

  it('decoding tolerates extra spaces and "|" word separators', () => {
    expect(run('...   ---   ...', { mode: 'morse-to-text' }).output).toBe('SOS');
    expect(run('.... . .-.. .-.. ---|.-- --- .-. .-.. -..', { mode: 'morse-to-text' }).output).toBe(
      'HELLO WORLD',
    );
  });

  it('round-trips a phrase', () => {
    const morse = run('The quick brown fox 42').output;
    expect(run(morse, { mode: 'morse-to-text' }).output).toBe('THE QUICK BROWN FOX 42');
  });

  it('throws ToolError on an invalid Morse group', () => {
    expect(() => run('........', { mode: 'morse-to-text' })).toThrow(/not a valid Morse/i);
    expect(() => run('hello', { mode: 'morse-to-text' })).toThrow(/not a valid Morse/i);
  });

  it('empty input → empty output in both modes', () => {
    expect(run('').output).toBe('');
    expect(run('', { mode: 'morse-to-text' }).output).toBe('');
    expect(run('   ', { mode: 'morse-to-text' }).output).toBe('');
  });
});
