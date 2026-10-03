import { describe, it, expect } from 'vitest';
import tool from './base64-file.tool';

describe('base64-file', () => {
  it('encodes binary file bytes and provides a downloadable text file', async () => {
    const file = new File([new Uint8Array([0, 1, 255])], 'data.bin');
    const result = await tool.run({ files: [file], options: {} });
    expect(result.report?.output).toBe('AAH/');
    expect(await result.outputs[0]!.blob.text()).toBe('AAH/');
    expect(result.outputs[0]!.filename).toBe('data.bin.base64.txt');
  });

  it('decodes Base64 and data URIs to bytes using a safe output name', async () => {
    const file = new File(['data:application/octet-stream;base64,AAH/'], 'encoded.txt');
    const result = await tool.run({
      files: [file],
      options: { mode: 'decode', outputName: '../payload.bin' },
    });
    expect(result.outputs[0]!.filename).toBe('.._payload.bin');
    expect([...new Uint8Array(await result.outputs[0]!.blob.arrayBuffer())]).toEqual([0, 1, 255]);
  });

  it('rejects invalid Base64 and missing files', async () => {
    await expect(
      tool.run({ files: [new File(['a?'], 'bad.txt')], options: { mode: 'decode' } }),
    ).rejects.toThrow(/invalid base64/i);
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose a file/i);
  });
});
