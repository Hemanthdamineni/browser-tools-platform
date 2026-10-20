import { describe, it, expect } from 'vitest';
import tool from './file-split.tool';
const file = (content: string | Uint8Array, name = 'a.txt') =>
  new File([content as unknown as BlobPart], name);
const concat = async (r: Awaited<ReturnType<typeof tool.run>>) => {
  const parts = r.outputs.filter((o) => !o.filename.endsWith('.manifest.json'));
  const bufs = await Promise.all(
    parts.map((o) => o.blob.arrayBuffer().then((b) => new Uint8Array(b))),
  );
  const total = bufs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of bufs) {
    out.set(b, off);
    off += b.length;
  }
  return out;
};
describe('file-split', () => {
  it('splits a 10-byte blob into 3 parts of 4, 4, 2 bytes with a manifest', async () => {
    const r = await tool.run({
      files: [file('0123456789', 'ten.txt')],
      options: { mode: 'by-count', count: 3 },
    });
    const parts = r.outputs.filter((o) => !o.filename.endsWith('.manifest.json'));
    expect(parts).toHaveLength(3);
    const sizes = await Promise.all(parts.map((o) => o.blob.size));
    expect(sizes).toEqual([4, 4, 2]);
    const joined = await concat(r);
    expect(new TextDecoder().decode(joined)).toBe('0123456789');
  });
  it('by-size splits at the requested unit', async () => {
    const r = await tool.run({
      files: [file('a'.repeat(2000), 'big.txt')],
      options: { mode: 'by-size', chunkSize: 1, chunkUnit: 'KB' },
    });
    expect(r.stats?.parts).toBe(2);
    const sizes = await Promise.all(
      r.outputs.filter((o) => !o.filename.endsWith('.manifest.json')).map((o) => o.blob.size),
    );
    expect(sizes).toEqual([1024, 976]);
  });
  it('writes a manifest with the checksum', async () => {
    const r = await tool.run({
      files: [file('abc', 'm.txt')],
      options: { mode: 'by-count', count: 2 },
    });
    const manifest = r.outputs.find((o) => o.filename.endsWith('.manifest.json'))!;
    const parsed = JSON.parse(await manifest.blob.text()) as {
      original: string;
      size: number;
      sha256: string;
    };
    expect(parsed.original).toBe('m.txt');
    expect(parsed.size).toBe(3);
    expect(parsed.sha256).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('refuses a chunk size larger than the file', async () => {
    await expect(
      tool.run({
        files: [file('tiny')],
        options: { mode: 'by-size', chunkSize: 5, chunkUnit: 'MB' },
      }),
    ).rejects.toThrow(/larger than the file/i);
  });
});
