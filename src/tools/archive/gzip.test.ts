import { describe, it, expect } from 'vitest';
import { gzipSync, gunzipSync } from 'fflate';
import tool from './gzip.tool';
const file = (content: string | Uint8Array, name = 'a.txt') =>
  new File([content as unknown as BlobPart], name);
const bytes = async (r: Awaited<ReturnType<typeof tool.run>>) =>
  new Uint8Array(await r.outputs[0]!.blob.arrayBuffer());
describe('gzip', () => {
  it('compresses and decompresses via the tool', async () => {
    const data = 'the quick brown fox jumps over the lazy dog';
    const compressed = await tool.run({
      files: [file(data, 'fox.txt')],
      options: { mode: 'compress' },
    });
    expect(compressed.outputs[0]!.filename).toBe('fox.txt.gz');
    expect(await compressed.outputs[0]!.blob.text()).not.toBe(data);
    expect((await bytes(compressed))[0]).toBe(0x1f);
    expect((await bytes(compressed))[1]).toBe(0x8b);
    const restored = await tool.run({
      files: [file(await bytes(compressed), 'fox.txt.gz')],
      options: { mode: 'decompress' },
    });
    expect(restored.outputs[0]!.filename).toBe('fox.txt');
    expect(await restored.outputs[0]!.blob.text()).toBe(data);
  });
  it('auto-detect decompresses gzip and compresses plain files', async () => {
    const gz = await tool.run({
      files: [file(gzipSync(new TextEncoder().encode('hi'), { level: 6 }), 'x.bin.gz')],
      options: { mode: 'auto' },
    });
    expect(await gz.outputs[0]!.blob.text()).toBe('hi');
    const plain = await tool.run({ files: [file('plain', 'p.bin')], options: { mode: 'auto' } });
    expect(plain.outputs[0]!.filename).toBe('p.bin.gz');
  });
  it('rejects decompression of a non-gzip file', async () => {
    await expect(
      tool.run({ files: [file('not gzip', 'x.txt')], options: { mode: 'decompress' } }),
    ).rejects.toThrow(/gzip/i);
  });
  it('round-trips through gunzipSync to equal the original', async () => {
    const r = await tool.run({
      files: [file('round trip payload', 'r.bin')],
      options: { level: 9 },
    });
    expect(new TextDecoder().decode(gunzipSync(await bytes(r)))).toBe('round trip payload');
  });
  it('rejects an empty file list', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose a file/i);
  });
});
