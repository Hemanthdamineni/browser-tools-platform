import { describe, it, expect } from 'vitest';
import tool from './pdf-page-numbers.tool';
import { makePdf, loadPdfBlob } from './pdf-test-helpers';

describe('pdf-page-numbers', () => {
  it('adds formatted labels to every page', async () => {
    const result = await tool.run({ files: [await makePdf(3)], options: { format: 'n-of-total', startAt: 5 } });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(3);
    expect(result.stats).toMatchObject({ pages: 3, numbered: 3 });
  });
  it('can skip the first page', async () => {
    const result = await tool.run({ files: [await makePdf(2)], options: { skipFirst: true } });
    expect(result.stats).toMatchObject({ numbered: 1 });
  });
});
