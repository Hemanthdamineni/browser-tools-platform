import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import tool from './zip-create.tool';

function file(content: string, name = 'a.txt'): File {
  return new File([content], name, { type: 'text/plain' });
}
const readBytes = async (r: Awaited<ReturnType<typeof tool.run>>) =>
  new Uint8Array(await r.outputs[0]!.blob.arrayBuffer());

describe('zip-create', () => {
  it('zips files and round-trips through unzipSync', async () => {
    const r = await tool.run({
      files: [file('hello', 'a.txt'), file('world', 'b.txt')],
      options: {},
    });
    const entries = unzipSync(await readBytes(r));
    const names = Object.keys(entries).sort();
    expect(names).toEqual(['a.txt', 'b.txt']);
    expect(new TextDecoder().decode(entries['a.txt']!)).toBe('hello');
    expect(new TextDecoder().decode(entries['b.txt']!)).toBe('world');
  });

  it('rejects an empty file list', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/at least one file/i);
  });

  it('reports stats', async () => {
    const r = await tool.run({ files: [file('hello')], options: {} });
    expect(r.stats?.files).toBe(1);
    expect(r.stats?.inputBytes).toBe(5);
  });

  it('honours a custom archive name', async () => {
    const r = await tool.run({ files: [file('x')], options: { zipName: 'out.zip' } });
    expect(r.outputs[0]!.filename).toBe('out.zip');
  });

  it('flattens nested paths when asked', async () => {
    const nested = new File(['deep'], 'b.txt');
    Object.defineProperty(nested, 'webkitRelativePath', { value: 'folder/sub/b.txt' });
    const r = await tool.run({ files: [nested], options: { flatten: true } });
    const entries = unzipSync(await readBytes(r));
    expect(Object.keys(entries)).toEqual(['b.txt']);
  });

  it('rejects absolute and traversal entry paths', async () => {
    const traversal = new File(['x'], 'evil.txt');
    Object.defineProperty(traversal, 'webkitRelativePath', { value: '../evil.txt' });
    await expect(tool.run({ files: [traversal], options: {} })).rejects.toThrow(
      /invalid archive path/i,
    );
    const absolute = new File(['x'], 'evil.txt');
    Object.defineProperty(absolute, 'webkitRelativePath', { value: '/etc/evil.txt' });
    await expect(tool.run({ files: [absolute], options: {} })).rejects.toThrow(
      /invalid archive path/i,
    );
  });
});
