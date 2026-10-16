import { describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './file-signature.tool';

type Result = { outputs: unknown[]; report?: { output: string }; stats?: Record<string, string | number>; notes?: string[] };
const file = (name: string, bytes: number[], type = '') =>
  new File([new Uint8Array(bytes)], name, { type });
const run = async (files: File[], options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files, options })) as Result;
const rows = (result: Result) => JSON.parse(result.report!.output).rows as string[][];

describe('file-signature', () => {
  it('detects common signatures and flags an extension mismatch', async () => {
    const result = await run([
      file('photo.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      file('report.txt', [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 'text/plain'),
    ]);
    expect(rows(result)[0]![2]).toBe('PNG image');
    expect(rows(result)[1]![2]).toBe('PDF document');
    expect(rows(result)[1]![6]).toBe('Extension mismatch');
    expect(rows(result)[1]![8]).toBe('false');
  });

  it('checks signatures with offsets and reports generic containers carefully', async () => {
    const wav = new Uint8Array(12);
    wav.set([0x52, 0x49, 0x46, 0x46], 0);
    wav.set([0x57, 0x41, 0x56, 0x45], 8);
    const mp4 = [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d];
    const result = await run([file('audio.wav', [...wav]), file('clip.mp4', mp4)]);
    expect(rows(result)[0]![2]).toBe('WAV audio');
    expect(rows(result)[1]![2]).toContain('container');
  });

  it('reports empty and unknown files without guessing from names', async () => {
    const result = await run([file('empty.pdf', []), file('data.bin', [0x01, 0x02, 0x03])]);
    expect(rows(result)[0]![2]).toBe('Unknown');
    expect(rows(result)[0]![9]).toBe('(empty file)');
    expect(rows(result)[1]![2]).toBe('Unknown');
  });

  it('reads a bounded header and reports progress', async () => {
    const content = new Uint8Array(4096);
    content.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const selected = file('large.png', [...content]);
    const slice = vi.spyOn(selected, 'slice');
    const onProgress = vi.fn();
    await tool.run({ files: [selected], options: { sampleBytes: '32' }, onProgress });
    expect(slice).toHaveBeenCalledWith(0, 32);
    expect(onProgress).toHaveBeenCalledWith(1, 'Inspecting large.png');
  });

  it('rejects missing files and invalid sample sizes', async () => {
    await expect(run([])).rejects.toThrow(ToolError);
    await expect(run([file('x', [1])], { sampleBytes: '128' })).rejects.toThrow(/sample size/i);
  });

  it('honors an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(tool.run({ files: [file('x', [1])], options: {}, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
