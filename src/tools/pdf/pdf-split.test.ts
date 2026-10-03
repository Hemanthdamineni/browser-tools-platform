import { describe, it, expect } from 'vitest';
import tool from './pdf-split.tool';
import { makePdf, loadPdfBlob } from './pdf-test-helpers';

describe('pdf-split', () => {
  it('produces a multi-page zip for every-page mode', async () => {
    const result = await tool.run({ files: [await makePdf(3)], options: { mode: 'every-page' } });
    expect(result.outputs[0]?.filename).toBe('split.zip');
    expect(result.outputs[0]?.blob.type).toBe('application/zip');
    expect(result.stats).toMatchObject({ pages: 3, outputs: 3 });
  });
  it('honors custom ranges', async () => {
    const result = await tool.run({
      files: [await makePdf(5)],
      options: { mode: 'ranges', ranges: '1-2,4' },
    });
    expect(result.stats).toMatchObject({ outputs: 2 });
    await expect(
      tool.run({ files: [await makePdf(3)], options: { mode: 'ranges', ranges: '1,9' } }),
    ).rejects.toThrow(/outside/i);
  });
  it('returns a single PDF when there is one group', async () => {
    const result = await tool.run({
      files: [await makePdf(2)],
      options: { mode: 'ranges', ranges: '1-2' },
    });
    expect(result.outputs[0]?.filename).toBe('split.pdf');
    expect(result.outputs[0]?.blob.type).toBe('application/pdf');
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(2);
  });
});
