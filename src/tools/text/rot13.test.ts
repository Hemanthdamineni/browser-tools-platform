import { describe, it, expect } from 'vitest';
import tool from './rot13.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('rot13', () => {
  it('applies ROT13 to letters by default', () => {
    expect(run('Hello, World!').output).toBe('Uryyb, Jbeyq!');
  });

  it('ROT13 is its own inverse', () => {
    const s = 'The quick brown fox jumps over 13 lazy dogs.';
    expect(run(run(s).output).output).toBe(s);
  });

  it('ROT5 rotates digits only', () => {
    expect(run('abc 123 XYZ', { variant: 'rot5' }).output).toBe('abc 678 XYZ');
  });

  it('ROT18 rotates both letters and digits', () => {
    expect(run('Hello 123', { variant: 'rot18' }).output).toBe('Uryyb 678');
    const s = 'Mix3d C4se 99';
    expect(run(run(s, { variant: 'rot18' }).output, { variant: 'rot18' }).output).toBe(s);
  });

  it('ROT47 rotates printable ASCII and is self-inverse', () => {
    expect(run('Hello', { variant: 'rot47' }).output).toBe('w6==@');
    const s = 'Hello, World! 42 #$%';
    expect(run(run(s, { variant: 'rot47' }).output, { variant: 'rot47' }).output).toBe(s);
  });

  it('leaves spaces and non-ASCII letters untouched under ROT47', () => {
    expect(run('a é', { variant: 'rot47' }).output).toBe('2 é');
  });

  it('Caesar shifts letters by the given amount and wraps', () => {
    expect(run('abc XYZ', { variant: 'caesar', shift: 3 }).output).toBe('def ABC');
    expect(run('def ABC', { variant: 'caesar', shift: 23 }).output).toBe('abc XYZ');
  });

  it('throws ToolError on an out-of-range Caesar shift', () => {
    expect(() => run('abc', { variant: 'caesar', shift: 30 })).toThrow(/1 to 25/i);
    expect(() => run('abc', { variant: 'caesar', shift: 0 })).toThrow(/1 to 25/i);
  });

  it('empty input → empty output', () => {
    expect(run('').output).toBe('');
    expect(run('', { variant: 'rot47' }).output).toBe('');
  });
});
