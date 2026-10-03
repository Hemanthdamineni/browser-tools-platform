import { describe, it, expect } from 'vitest';
import { gzipSync } from 'fflate';
import createTool from './tar-create.tool';
import tool from './tar-extract.tool';
const file = (content: string, name = 'a.txt') =>
  new File([content], name, { type: 'text/plain', lastModified: 0 });
const bytes = async (r: Awaited<ReturnType<typeof tool.run>>) =>
  new Uint8Array(await r.outputs[0]!.blob.arrayBuffer());
describe('tar-extract', () => {
  it('round-trips with tar-create', async () => {
    const created = await createTool.run({
      files: [file('hello', 'a.txt'), file('world', 'dir/b.txt')],
      options: {},
    });
    const r = await tool.run({
      files: [new File([await bytes(created)], 'archive.tar')],
      options: {},
    });
    expect(r.outputs.map((o) => o.filename).sort()).toEqual(['a.txt', 'dir__b.txt']);
    const texts = await Promise.all(r.outputs.map((o) => o.blob.text()));
    expect(texts.sort()).toEqual(['hello', 'world']);
    expect(r.report?.render).toBe('table');
  });
  it('handles a gzip-wrapped TAR', async () => {
    const created = await createTool.run({
      files: [file('payload', 'p.bin')],
      options: { gzip: true },
    });
    const packed = await bytes(created);
    const r = await tool.run({ files: [new File([packed], 'archive.tar.gz')], options: {} });
    expect(await r.outputs[0]!.blob.text()).toBe('payload');
  });
  it('accepts a directly gzipped TAR', async () => {
    const created = await createTool.run({ files: [file('z', 'z.txt')], options: {} });
    const packed = gzipSync(await bytes(created));
    const r = await tool.run({ files: [new File([packed], 'x.tgz')], options: {} });
    expect(await r.outputs[0]!.blob.text()).toBe('z');
  });
  it('skips traversal or absolute-looking entry names', async () => {
    const created = await createTool.run({ files: [file('ok', 'evil.txt')], options: {} });
    const packed = await bytes(created);
    const r = await tool.run({ files: [new File([packed], 'a.tar')], options: {} });
    expect(r.outputs.map((o) => o.filename)).toEqual(['evil.txt']);
  });
  it('rejects data that is not a TAR', async () => {
    await expect(
      tool.run({ files: [new File(['not a tar'], 'x.tar')], options: {} }),
    ).rejects.toThrow(/TAR/i);
  });
});
