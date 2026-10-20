import { describe, it, expect } from 'vitest';
import tool from './pdf-extract-pages.tool';
import { makePdf, makeInvalidPdf, loadPdfBlob } from './pdf-test-helpers';

describe('pdf-extract-pages', () => {
  it('extracts the chosen pages and reports counts', async () => {
    const result = await tool.run({ files: [await makePdf(4)], options: { pages: '2,4' } });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(2);
    expect(result.stats).toMatchObject({ inputPages: 4, extractedPages: 2 });
  });
  it('supports reordering and runs selections, and rejects invalid input', async () => {
    const result = await tool.run({ files: [await makePdf(3)], options: { pages: '3,1' } });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(2);
    await expect(tool.run({ files: [await makePdf(2)], options: { pages: '5' } })).rejects.toThrow(
      /outside/i,
    );
    await expect(tool.run({ files: [makeInvalidPdf()], options: { pages: '1' } })).rejects.toThrow(
      /valid/i,
    );
  });
});
