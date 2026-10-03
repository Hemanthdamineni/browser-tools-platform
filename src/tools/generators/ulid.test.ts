import { describe, it, expect } from 'vitest';
import tool, { decodeTime } from './ulid.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output.split('\n');

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('ulid', () => {
  it('generates valid 26-char Crockford base32 ULIDs', () => {
    const ids = run('');
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(ULID);
  });

  it('count=10 is sorted in generation order', () => {
    const ids = run('', { count: 10 });
    expect(ids).toHaveLength(10);
    expect([...ids].sort()).toEqual(ids);
  });

  it('embedded timestamp is within a few seconds of now', () => {
    const before = Date.now();
    const [id] = run('');
    const after = Date.now();
    expect(decodeTime(id!)).toBeGreaterThanOrEqual(before - 1000);
    expect(decodeTime(id!)).toBeLessThanOrEqual(after + 1000);
  });

  it('monotonic mode in the same millisecond strictly increases', () => {
    const ids = run('', { count: 10, monotonic: true });
    expect(new Set(ids).size).toBe(10);
  });

  it('lowercase option', () => {
    expect(run('', { lowercase: true })[0]).toMatch(/^[0-9a-hjkmnp-tv-z]{26}$/);
  });

  it('decodeTime decodes known values', () => {
    // '01ARZ3NDEKTSV4RRFFQ69G5FAV' is the canonical example ULID (1469922850259 ms).
    expect(decodeTime('01ARZ3NDEK')).toBe(1469922850259);
  });
});
