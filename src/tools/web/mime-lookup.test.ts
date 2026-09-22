import { describe, it, expect } from 'vitest';
import tool from './mime-lookup.tool';

type Result = { output: string; stats?: Record<string, string>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const table = (r: Result) => JSON.parse(r.output) as { rows: string[][] };

describe('mime-lookup', async () => {
  it('png maps to image/png', async () => {
    const r = await run('png');
    expect(table(r).rows).toContainEqual(['png', 'image/png']);
    expect(r.stats!.kind).toBe('binary');
  });

  it('accepts a leading dot and a filename', async () => {
    expect(table(await run('.md')).rows).toContainEqual(['md', 'text/markdown']);
    expect(table(await run('photo.png')).rows).toContainEqual(['png', 'image/png']);
  });

  it('matches on the last extension of a compound name', async () => {
    expect(table(await run('.tar.gz')).rows).toContainEqual(['gz', 'application/gzip']);
  });

  it('mime-to-ext lists all matching extensions', async () => {
    const r = await run('application/json', { mode: 'mime-to-ext' });
    const rows = table(r).rows;
    const extStr = rows[0]?.[1];
    expect(extStr).toBeDefined();
    expect(extStr!.split(', ')).toContain('json');
    expect(r.notes?.[0]).toBe('text');
  });

  it('jpeg and jpg share image/jpeg', async () => {
    const r = await run('image/jpeg', { mode: 'mime-to-ext' });
    const exts = table(r).rows[0]?.[1];
    expect(exts).toBeDefined();
    expect(exts!.split(', ')).toContain('jpg');
    expect(exts!.split(', ')).toContain('jpeg');
  });

  it('unknown extension gives a note, not an error', async () => {
    const r = await run('xyzzy');
    expect(table(r).rows).toEqual([]);
    expect(r.notes?.[0]).toMatch(/Unknown extension/);
  });

  it('unknown MIME gives a note, not an error', async () => {
    const r = await run('application/xyzzy', { mode: 'mime-to-ext' });
    expect(r.notes?.[0]).toMatch(/Unknown MIME/);
  });

  it('empty input gives empty output', async () => {
    expect((await run('')).output).toBe('');
  });
});
