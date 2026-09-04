import { describe, it, expect } from 'vitest';
import tool from './mime-lookup.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options });

const table = (r: ReturnType<typeof run>) => JSON.parse(r.output) as { rows: string[][] };

describe('mime-lookup', () => {
  it('png maps to image/png', () => {
    const r = run('png');
    expect(table(r).rows).toContainEqual(['png', 'image/png']);
    expect(r.stats!.kind).toBe('binary');
  });

  it('accepts a leading dot and a filename', () => {
    expect(table(run('.md')).rows).toContainEqual(['md', 'text/markdown']);
    expect(table(run('photo.png')).rows).toContainEqual(['png', 'image/png']);
  });

  it('matches on the last extension of a compound name', () => {
    expect(table(run('.tar.gz')).rows).toContainEqual(['gz', 'application/gzip']);
  });

  it('mime-to-ext lists all matching extensions', () => {
    const r = run('application/json', { mode: 'mime-to-ext' });
    const rows = table(r).rows;
    expect(rows[0]![1].split(', ')).toContain('json');
    expect(r.notes?.[0]).toBe('text');
  });

  it('jpeg and jpg share image/jpeg', () => {
    const r = run('image/jpeg', { mode: 'mime-to-ext' });
    const exts = table(r).rows[0]![1].split(', ');
    expect(exts).toContain('jpg');
    expect(exts).toContain('jpeg');
  });

  it('unknown extension gives a note, not an error', () => {
    const r = run('xyzzy');
    expect(table(r).rows).toEqual([]);
    expect(r.notes?.[0]).toMatch(/Unknown extension/);
  });

  it('unknown MIME gives a note, not an error', () => {
    const r = run('application/xyzzy', { mode: 'mime-to-ext' });
    expect(r.notes?.[0]).toMatch(/Unknown MIME/);
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
  });
});
