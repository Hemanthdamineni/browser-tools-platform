import { describe, it, expect } from 'vitest';
import tool from './uuid.tool';

const gen = (options: Record<string, string | number | boolean>) =>
  (tool.run({ text: '', options }) as { output: string }).output.split('\n');

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', () => {
  it('generates a valid v4', () => {
    const [id] = gen({ version: 'v4', count: 1 });
    expect(id).toMatch(V4);
  });

  it('generates the requested count, all unique', () => {
    const ids = gen({ version: 'v4', count: 200 });
    expect(ids).toHaveLength(200);
    expect(new Set(ids).size).toBe(200);
  });

  it('v7 is valid and time-ordered', () => {
    const ids = gen({ version: 'v7', count: 50 });
    ids.forEach((id) => expect(id).toMatch(V7));
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('nil uuid', () => {
    expect(gen({ version: 'nil', count: 1 })[0]).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('formatting options', () => {
    const [id] = gen({ version: 'v4', count: 1, uppercase: true, braces: true, hyphens: false });
    expect(id).toMatch(/^\{[0-9A-F]{32}\}$/);
  });

  it('clamps out-of-range counts', () => {
    expect(gen({ version: 'v4', count: 99999 })).toHaveLength(1000);
    expect(gen({ version: 'v4', count: 0 })).toHaveLength(1);
  });
});
