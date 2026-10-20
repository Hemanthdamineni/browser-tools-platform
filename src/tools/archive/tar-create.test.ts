import { describe, it, expect } from 'vitest';
import { gunzipSync } from 'fflate';
import tool from './tar-create.tool';
import extractTool from './tar-extract.tool';
const file = (content: string, name = 'a.txt') =>
  new File([content], name, { type: 'text/plain', lastModified: 0 });
const bytes = async (r: Awaited<ReturnType<typeof tool.run>>) =>
  new Uint8Array(await r.outputs[0]!.blob.arrayBuffer());
describe('tar-create', () => {
  it('creates a ustar archive with readable entries', async () => {
    const r = await tool.run({
      files: [file('hello', 'a.txt'), file('world', 'dir/b.txt')],
      options: {},
    });
    const packed = await bytes(r);
    expect(packed.length % 512).toBe(0);
    expect(new TextDecoder().decode(packed.slice(257, 263))).toBe('ustar\0');
    const extracted = await extractTool.run({
      files: [new File([packed], 'archive.tar')],
      options: {},
    });
    expect(extracted.outputs.map((o) => o.filename).sort()).toEqual(['a.txt', 'dir__b.txt']);
    expect(await extracted.outputs[0]!.blob.text()).toMatch(/hello|world/);
  });
  it('can gzip the TAR and uses a tar.gz filename', async () => {
    const r = await tool.run({ files: [file('hello')], options: { gzip: true } });
    expect(r.outputs[0]!.filename).toBe('archive.tar.gz');
    const unpacked = gunzipSync(await bytes(r));
    expect(new TextDecoder().decode(unpacked.slice(512, 517))).toBe('hello');
  });
  it('rejects an empty file list', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/at least one file/i);
  });
  it('rejects absolute and traversal entry paths', async () => {
    const absolute = new File(['x'], 'evil.txt');
    Object.defineProperty(absolute, 'webkitRelativePath', { value: '/etc/evil.txt' });
    await expect(tool.run({ files: [absolute], options: {} })).rejects.toThrow(
      /invalid archive path/i,
    );
    const traversal = new File(['x'], 'evil.txt');
    Object.defineProperty(traversal, 'webkitRelativePath', { value: '../evil.txt' });
    await expect(tool.run({ files: [traversal], options: {} })).rejects.toThrow(
      /invalid archive path/i,
    );
  });
  it('stores epoch mtime in whole seconds with a valid checksum', async () => {
    const f = new File(['x'], 'a.txt', { lastModified: 1_700_000_000_123 });
    const r = await tool.run({ files: [f], options: {} });
    const packed = await bytes(r);
    const mtimeField = new TextDecoder().decode(packed.slice(136, 148)).replace(/[ \0]/g, '');
    expect(parseInt(mtimeField, 8)).toBe(1_700_000_000); // 123 ms truncated
    // POSIX checksum: sum the block with the checksum field read as spaces.
    const block = packed.slice(0, 512);
    const stored = parseInt(
      new TextDecoder().decode(block.slice(148, 154)).replace(/[ \0]/g, ''),
      8,
    );
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : block[i]!;
    expect(stored).toBe(sum);
  });
  it('writes the size field as a full 12-byte ustar field', async () => {
    const r = await tool.run({ files: [file('hello')], options: {} });
    const packed = await bytes(r);
    const sizeField = new TextDecoder().decode(packed.slice(124, 136)).replace(/[ \0]/g, '');
    expect(parseInt(sizeField, 8)).toBe(5);
    // The 12-byte field must be terminated, not truncated into the next one.
    expect(packed[135]).toBe(0);
  });
});
