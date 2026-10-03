import { describe, it, expect } from 'vitest';
import tool from './pdf-watermark.tool';
import { makePdf, loadPdfBlob } from './pdf-test-helpers';

describe('pdf-watermark', () => {
  it('stamps selected pages and produces a valid PDF', async () => {
    const result = await tool.run({
      files: [await makePdf(3)],
      options: { text: 'CONFIDENTIAL', pages: '1,3' },
    });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(3);
    expect(result.stats).toMatchObject({ pages: 3, watermarked: 2 });
  });
  it('rejects missing text and invalid colour', async () => {
    await expect(tool.run({ files: [await makePdf()], options: { text: '  ' } })).rejects.toThrow(
      /watermark text/i,
    );
    await expect(
      tool.run({ files: [await makePdf()], options: { text: 'x', color: 'nope' } }),
    ).rejects.toThrow(/hex/i);
  });
  it('tiles across the page when asked', async () => {
    const result = await tool.run({
      files: [await makePdf()],
      options: { text: 'DRAFT', position: 'tile' },
    });
    expect(result.outputs[0]?.blob.type).toBe('application/pdf');
  });
});
