import { describe, it, expect } from 'vitest';
import tool from './pdf-merge.tool';
import { makePdf, makeInvalidPdf } from './pdf-test-helpers';

describe('pdf-merge', () => {
  it('merges documents and reports page/file stats', async () => {
    const files = [await makePdf(1), await makePdf(2)];
    const progress: number[] = [];
    const result = await tool.run({
      files,
      options: { outputName: 'joined.pdf' },
      onProgress: (value) => progress.push(value),
    });
    expect(result.outputs[0]?.filename).toBe('joined.pdf');
    expect(result.outputs[0]?.blob.type).toBe('application/pdf');
    expect(result.stats).toMatchObject({ files: 2, pages: 3 });
    expect(progress.at(-1)).toBe(1);
  });
  it('rejects fewer than two and invalid PDFs', async () => {
    await expect(tool.run({ files: [await makePdf()], options: {} })).rejects.toThrow(/two/i);
    await expect(
      tool.run({ files: [await makePdf(), makeInvalidPdf()], options: {} }),
    ).rejects.toThrow(/valid/i);
  });
  it('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({
        files: [await makePdf(), await makePdf()],
        options: {},
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
