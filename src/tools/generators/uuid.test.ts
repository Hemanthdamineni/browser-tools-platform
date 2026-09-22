import { describe, it, expect } from 'vitest';
import tool from './uuid.tool';

const gen = async (options: Record<string, string | number | boolean>) =>
  ((await tool.run({ text: '', options })) as { output: string }).output.split('\n');

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', async () => {
  it('generates a valid v4', async () => {
    const [id] = await gen({ version: 'v4', count: 1 });
    expect(id).toMatch(V4);
  });

  it('generates the requested count, all unique', async () => {
    const ids = await gen({ version: 'v4', count: 200 });
    expect(ids).toHaveLength(200);
    expect(new Set(ids).size).toBe(200);
  });

  it('v7 is valid and time-ordered', async () => {
    const ids = await gen({ version: 'v7', count: 50 });
    ids.forEach((id) => expect(id).toMatch(V7));
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('nil uuid', async () => {
    expect((await gen({ version: 'nil', count: 1 }))[0]).toBe(
      '00000000-0000-0000-0000-000000000000',
    );
  });

  it('formatting options', async () => {
    const [id] = await gen({
      version: 'v4',
      count: 1,
      uppercase: true,
      braces: true,
      hyphens: false,
    });
    expect(id).toMatch(/^{[0-9A-F]{32}}$/);
  });

  it('clamps out-of-range counts', async () => {
    expect(await gen({ version: 'v4', count: 99999 })).toHaveLength(1000);
    expect(await gen({ version: 'v4', count: 0 })).toHaveLength(1);
  });
});
