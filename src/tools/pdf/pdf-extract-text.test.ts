import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import tool from './pdf-extract-text.tool';
import { makePdf, makeInvalidPdf } from './pdf-test-helpers';

async function makeTextPdf(): Promise<File> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 200]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('First page text', { x: 20, y: 150, size: 12, font });
  const bytes = await doc.save();
  return new File([bytes.slice().buffer], 'text.pdf', { type: 'application/pdf' });
}

describe('pdf-extract-text', () => {
  it('extracts text page by page and reports character counts', async () => {
    const progress: number[] = [];
    const result = await tool.run({
      files: [await makeTextPdf()],
      options: {},
      onProgress: (value) => progress.push(value),
    });
    const report = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(result.outputs).toHaveLength(0);
    expect(report.headers).toEqual(['Page', 'Text']);
    expect(report.rows[0]?.[1]).toContain('First page text');
    expect(result.stats?.characters).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(1);
  });
  it('rejects invalid PDFs and honors cancellation', async () => {
    await expect(tool.run({ files: [makeInvalidPdf()], options: {} })).rejects.toThrow(/valid/i);
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [await makePdf()], options: {}, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
