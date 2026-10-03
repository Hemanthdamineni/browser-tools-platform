import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import tool from './zip-extract.tool';
const file = (bytes: Uint8Array, name = 'input.zip') =>
  new File([bytes as unknown as BlobPart], name);
describe('zip-extract', () => {
  it('extracts entries and reports their status', async () => {
    const zip = zipSync({
      'dir/a.txt': new TextEncoder().encode('hello'),
      'b.txt': new TextEncoder().encode('world'),
    });
    const r = await tool.run({ files: [file(zip)], options: {} });
    expect(r.outputs.map((o) => o.filename).sort()).toEqual(['b.txt', 'dir__a.txt']);
    expect(await r.outputs[0]!.blob.text()).toMatch(/hello|world/);
    expect(r.report?.render).toBe('table');
  });
  it('filters paths and skips traversal or absolute-looking segments', async () => {
    const zip = zipSync({
      '../evil.txt': new TextEncoder().encode('bad'),
      '/etc/rooted.txt': new TextEncoder().encode('rooted'),
      'keep.txt': new TextEncoder().encode('ok'),
    });
    const r = await tool.run({ files: [file(zip)], options: { filter: 'keep' } });
    expect(r.outputs.map((o) => o.filename)).toEqual(['keep.txt']);
    const bad = await tool.run({ files: [file(zip)], options: {} });
    expect(bad.outputs.map((o) => o.filename)).toEqual(['keep.txt']);
  });
  it('rejects invalid ZIP data', async () => {
    await expect(tool.run({ files: [new File(['bad'], 'bad.zip')], options: {} })).rejects.toThrow(
      /ZIP/i,
    );
  });
});
