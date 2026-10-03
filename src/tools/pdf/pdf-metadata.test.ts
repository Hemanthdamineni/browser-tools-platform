import { describe, it, expect } from 'vitest';
import tool from './pdf-metadata.tool';
import { makePdf, loadPdfBlob } from './pdf-test-helpers';

describe('pdf-metadata', () => {
  it('reports current metadata in a table without emitting files', async () => {
    const result = await tool.run({ files: [await makePdf(2)], options: {} });
    expect(result.outputs).toHaveLength(0);
    expect(result.report?.render).toBe('table');
    expect(result.stats).toMatchObject({ pages: 2 });
    expect(result.report?.output).toContain('Page Count');
  });
  it('edits metadata and emits an updated PDF', async () => {
    const result = await tool.run({ files: [await makePdf()], options: { title: 'My Document', author: 'Test Author' } });
    expect(result.outputs[0]?.filename).toBe('metadata-updated.pdf');
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getTitle()).toBe('My Document');
    expect(doc.getAuthor()).toBe('Test Author');
  });
  it('clears all metadata when asked', async () => {
    const result = await tool.run({ files: [await makePdf()], options: { clearAll: true } });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getTitle()).toBe('');
  });
});
