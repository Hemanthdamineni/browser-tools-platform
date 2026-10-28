import { describe, it, expect } from 'vitest';
import tool from './nanoid.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output.split('\n');

describe('nanoid', () => {
  it('generates 21-char url-safe ids by default', () => {
    const ids = run('');
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });

  it('hex alphabet with size 8', () => {
    const ids = run('', { size: 8, alphabet: 'hex' });
    expect(ids[0]).toMatch(/^[0-9a-f]{8}$/);
  });

  it('count=50 produces 50 unique lines', () => {
    const ids = run('', { count: 50 });
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
  });

  it('honours a custom alphabet', () => {
    const ids = run('', { alphabet: 'custom', custom: 'abc', size: 12, count: 20 });
    ids.forEach((id) => expect(id).toMatch(/^[abc]{12}$/));
  });

  it('throws on an empty or 1-char custom alphabet', () => {
    expect(() => run('', { alphabet: 'custom', custom: '' })).toThrow(/at least 2/);
    expect(() => run('', { alphabet: 'custom', custom: 'x' })).toThrow(/at least 2/);
  });

  it('accepts any size and count', () => {
    const ids = run('', { size: 999, count: 999 });
    expect(ids).toHaveLength(999);
    expect(ids[0]).toHaveLength(999);
    const [id] = run('', { size: 1 });
    expect(id).toHaveLength(2);
  });
});
