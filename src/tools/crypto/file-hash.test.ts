import { describe, it, expect } from 'vitest';
import tool from './file-hash.tool';

function file(content: string, name = 'a.txt'): File {
  return new File([content], name, { type: 'text/plain' });
}
const readText = async (r: Awaited<ReturnType<typeof tool.run>>) => r.outputs[0]!.blob.text();

describe('file-hash', () => {
  it('computes the known SHA-256 of "abc"', async () => {
    const r = await tool.run({ files: [file('abc')], options: { algorithm: 'SHA-256' } });
    expect(await readText(r)).toContain(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes multiple files', async () => {
    const r = await tool.run({
      files: [file('one', '1.txt'), file('two', '2.txt')],
      options: { algorithm: 'SHA-256' },
    });
    const text = await readText(r);
    expect(text.split('\n').filter(Boolean)).toHaveLength(2);
    expect(r.stats?.files).toBe(2);
  });

  it('verifies against an expected checksum', async () => {
    const r = await tool.run({
      files: [file('abc')],
      options: {
        algorithm: 'SHA-256',
        expected: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      },
    });
    expect(r.warnings?.[0]).toMatch(/Match/i);
  });

  it('flags a mismatch', async () => {
    const r = await tool.run({
      files: [file('abc')],
      options: { algorithm: 'SHA-256', expected: 'deadbeef' },
    });
    expect(r.warnings?.[0]).toMatch(/No file matches/i);
  });

  it('warns about SHA-1', async () => {
    const r = await tool.run({ files: [file('x')], options: { algorithm: 'SHA-1' } });
    expect(r.warnings?.some((w) => /SHA-1 is broken/i.test(w))).toBe(true);
  });

  it('rejects an empty file list', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/at least one file/i);
  });

  it('includes an inline table report with algorithm, hash and filename rows', async () => {
    const r = await tool.run({
      files: [file('abc', 'a.txt')],
      options: { algorithm: 'SHA-256' },
    });
    expect(r.report).toBeDefined();
    expect(r.report!.render).toBe('table');
    const parsed = JSON.parse(r.report!.output) as {
      headers: string[];
      rows: string[][];
    };
    expect(parsed.headers).toEqual(['Algorithm', 'Hash', 'Filename']);
    expect(parsed.rows).toEqual([
      ['SHA-256', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'a.txt'],
    ]);
  });
});
