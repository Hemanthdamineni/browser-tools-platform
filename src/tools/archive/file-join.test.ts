import { describe, it, expect } from 'vitest';
import splitTool from './file-split.tool';
import tool from './file-join.tool';

const file = (content: string | Uint8Array, name: string) =>
  new File([content as unknown as BlobPart], name);
const part = (content: string, name: string) => new File([content], name);

describe('file-join', () => {
  it('round-trips with file-split in natural name order', async () => {
    const split = await splitTool.run({
      files: [file('0123456789', 'ten.txt')],
      options: { mode: 'by-count', count: 3 },
    });
    const r = await tool.run({
      files: split.outputs.map((o) => new File([o.blob], o.filename)),
      options: {},
    });
    expect(await r.outputs[0]!.blob.text()).toBe('0123456789');
    expect(r.warnings).toBeUndefined();
  });

  it('joins out-of-order parts using the natural filename sort', async () => {
    const r = await tool.run({
      files: [part('efg', 'f.part003'), part('ab', 'f.part001'), part('cd', 'f.part002')],
      options: { outputName: 'out.bin' },
    });
    expect(await r.outputs[0]!.blob.text()).toBe('abcdefg');
    expect(r.outputs[0]!.filename).toBe('out.bin');
  });

  it('respects upload order when asked', async () => {
    const r = await tool.run({
      files: [part('B', 'z.part002'), part('A', 'a.part001')],
      options: { sort: 'upload-order' },
    });
    expect(await r.outputs[0]!.blob.text()).toBe('BA');
  });

  it('verifies a manifest and warns on a checksum mismatch', async () => {
    const good = JSON.stringify({
      original: 'x.bin',
      size: 4,
      sha256: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
      parts: [{ name: 'x.part1', size: 4 }],
    });
    const ok = await tool.run({
      files: [part('abcd', 'x.part1'), file(good, 'x.manifest.json')],
      options: {},
    });
    expect(ok.warnings).toBeUndefined();

    const bad = await tool.run({
      files: [
        part('abcd', 'x.part1'),
        file(good.replace(/88d4266f/, '00000000'), 'x.manifest.json'),
      ],
      options: {},
    });
    expect(bad.warnings?.some((w) => /checksum does not match/i.test(w))).toBe(true);
  });

  it('rejects an empty file list', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose/i);
  });
});
