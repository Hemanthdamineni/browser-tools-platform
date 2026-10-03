import { describe, it, expect } from 'vitest';
import tool from './images-to-pdf.tool';
import { pngFile, jpegFile, loadPdfBlob } from './pdf-test-helpers';

describe('images-to-pdf', () => {
  it('embeds PNG and JPEG images, one page each', async () => {
    const result = await tool.run({ files: [pngFile(), jpegFile()], options: { pageSize: 'fit' } });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(2);
    expect(result.outputs[0]?.blob.type).toBe('application/pdf');
    expect(result.stats).toMatchObject({ images: 2, pages: 2 });
  });
  it('places images on A4 paper with margins', async () => {
    const result = await tool.run({ files: [pngFile()], options: { pageSize: 'a4', margin: 40 } });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    const { width } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
  });
  it('supports landscape orientation', async () => {
    const result = await tool.run({
      files: [pngFile()],
      options: { pageSize: 'a4', orientation: 'landscape' },
    });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
  });
  it('rejects empty input and unsupported image types', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose/i);
    const text = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [text], options: {} })).rejects.toThrow(/PNG or JPEG/i);
  });
  it('honors cancellation before conversion', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [pngFile()], options: {}, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
