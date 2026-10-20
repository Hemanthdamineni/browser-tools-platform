import { describe, it, expect } from 'vitest';
import tool from './pdf-delete-pages.tool';
import { makePdf, makeInvalidPdf, loadPdfBlob } from './pdf-test-helpers';

describe('pdf-delete-pages', () => {
  it('removes selected pages and reports remaining counts', async () => {
    const result = await tool.run({ files: [await makePdf(4)], options: { pages: '2,4' } });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(2);
    expect(result.stats).toMatchObject({ inputPages: 4, deleted: 2, remaining: 2 });
  });
  it('supports ranges and refuses to delete every page', async () => {
    const result = await tool.run({ files: [await makePdf(5)], options: { pages: '2-4' } });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(2);
    await expect(
      tool.run({ files: [await makePdf(2)], options: { pages: '1,2' } }),
    ).rejects.toThrow(/every page/i);
  });
  it('rejects out-of-range and invalid PDFs', async () => {
    await expect(tool.run({ files: [await makePdf(2)], options: { pages: '9' } })).rejects.toThrow(
      /outside/i,
    );
    await expect(tool.run({ files: [makeInvalidPdf()], options: { pages: '1' } })).rejects.toThrow(
      /valid/i,
    );
  });
});
