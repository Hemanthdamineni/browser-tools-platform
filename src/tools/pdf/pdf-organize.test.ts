import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ToolError, type FileRunInput } from '@/lib/types';
import { loadPdfBlob, makeInvalidPdf, makePdf } from './pdf-test-helpers';
import tool from './pdf-organize.tool';

/** Run the tool with a PDF that has `pageCount` pages. */
async function runWith(
  pageCount: number,
  options: Record<string, unknown> = {},
): Promise<{ bytes: Uint8Array; stats?: Record<string, string | number> }> {
  const file = await makePdf(pageCount);
  const result = await tool.run({ files: [file], options } as FileRunInput);
  const out = result.outputs[0]!;
  const bytes = new Uint8Array(await out.blob.arrayBuffer());
  return { bytes, stats: result.stats };
}

describe('pdf-organize', () => {
  it('keeps every page in order when no plan is given', async () => {
    const { bytes, stats } = await runWith(3);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(stats?.pages).toBe(3);
    expect(stats?.sourcePages).toBe(3);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('reorders the pages', async () => {
    const { bytes } = await runWith(3, { pages: '[{"source":3},{"source":1},{"source":2}]' });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    // The test PDF pages are 200×300, 210×300, 220×300 — the width shows the order.
    const widths = doc.getPages().map((page) => Math.round(page.getWidth()));
    expect(widths).toEqual([220, 200, 210]);
  });

  it('deletes pages by leaving them out of the plan', async () => {
    const { bytes, stats } = await runWith(4, { pages: '[{"source":1},{"source":3}]' });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(stats?.pages).toBe(2);
    expect(stats?.sourcePages).toBe(4);
  });

  it('keeps a single page when everything else is deleted', async () => {
    const { bytes } = await runWith(3, { pages: '[{"source":2}]' });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(210);
  });

  it('rotates a page', async () => {
    const { bytes, stats } = await runWith(2, {
      pages: '[{"source":1,"rotate":90},{"source":2}]',
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(0);
    expect(stats?.rotatedPages).toBe(1);
  });

  it('rotates several pages by different amounts', async () => {
    const { bytes } = await runWith(3, {
      pages: '[{"source":1,"rotate":90},{"source":2,"rotate":180},{"source":3,"rotate":270}]',
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(180);
    expect(doc.getPage(2).getRotation().angle).toBe(270);
  });

  it('inserts a blank page with the chosen size', async () => {
    const { bytes, stats } = await runWith(1, {
      pages: '[{"source":1},{"blank":true,"size":"letter"}]',
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(1).getWidth())).toBe(612);
    expect(stats?.blankPages).toBe(1);
  });

  it('uses the blankSize option for a blank page without its own size', async () => {
    const { bytes } = await runWith(1, {
      pages: '[{"source":1},{"blank":true}]',
      blankSize: 'a4-landscape',
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(1).getWidth())).toBe(842);
    expect(Math.round(doc.getPage(1).getHeight())).toBe(595);
  });

  it('rejects a blank page with no size at all', async () => {
    await expect(runWith(1, { pages: '[{"blank":true}]', blankSize: '' })).rejects.toThrow(
      ToolError,
    );
  });

  it('rejects an invalid plan', async () => {
    await expect(runWith(2, { pages: '{oops' })).rejects.toThrow(ToolError);
    await expect(runWith(2, { pages: '[]' })).rejects.toThrow(/plan is empty/);
    await expect(runWith(2, { pages: '[{"source":9}]' })).rejects.toThrow(/outside this PDF/);
    await expect(runWith(2, { pages: '[{"source":1},{"source":1}]' })).rejects.toThrow(
      /in the plan twice/,
    );
    await expect(runWith(2, { pages: '[{"source":1,"rotate":45}]' })).rejects.toThrow(
      /not a whole turn/,
    );
  });

  it('rejects a file that is not a PDF', async () => {
    await expect(
      tool.run({ files: [makeInvalidPdf()], options: {} } as FileRunInput),
    ).rejects.toThrow(ToolError);
  });

  it('rejects an empty file selection', async () => {
    await expect(tool.run({ files: [], options: {} } as FileRunInput)).rejects.toThrow(
      /Choose a PDF file/,
    );
  });

  it('uses the requested output file name', async () => {
    const file = await makePdf(1);
    const result = await tool.run({
      files: [file],
      options: { outputName: 'arranged.pdf' },
    } as FileRunInput);
    expect(result.outputs[0]!.filename).toBe('arranged.pdf');
  });

  it('falls back to a default output file name', async () => {
    const file = await makePdf(1);
    const result = await tool.run({ files: [file], options: {} } as FileRunInput);
    expect(result.outputs[0]!.filename).toBe('organized.pdf');
  });

  it('notes how many pages were removed', async () => {
    const file = await makePdf(4);
    const result = await tool.run({
      files: [file],
      options: { pages: '[{"source":1}]' },
    } as FileRunInput);
    expect(result.notes?.[0]).toMatch(/3 were removed/);
  });

  it('reports progress from 0 to 1', async () => {
    const file = await makePdf(2);
    const onProgress = vi.fn();
    await tool.run({ files: [file], options: {}, onProgress } as FileRunInput);
    const fractions = onProgress.mock.calls.map((call) => call[0] as number);
    expect(fractions[0]).toBe(0);
    expect(Math.max(...fractions)).toBeCloseTo(1, 5);
  });

  it('honours an abort signal', async () => {
    const file = await makePdf(3);
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [file], options: {}, signal: controller.signal } as FileRunInput),
    ).rejects.toThrow();
  });

  it('produces a PDF that can be read back', async () => {
    const { bytes } = await runWith(2, { pages: '[{"source":2},{"source":1,"rotate":180}]' });
    const doc = await loadPdfBlob(new Blob([bytes.slice().buffer]));
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(1).getRotation().angle).toBe(180);
  });

  it('handles a Unicode file name', async () => {
    const file = await makePdf(1);
    const unicode = new File([await file.arrayBuffer()], '契約書 — ünïcøde.pdf', {
      type: 'application/pdf',
    });
    const result = await tool.run({ files: [unicode], options: {} } as FileRunInput);
    expect(result.outputs[0]!.blob.size).toBeGreaterThan(0);
  });
});
