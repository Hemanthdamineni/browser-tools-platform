import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import tool from './pdf-compress.tool';
import { loadPdfBytes } from './shared';
import { jpegFile, loadPdfBlob, makeInvalidPdf, makePdf } from './pdf-test-helpers';

async function imagePdf(): Promise<File> {
  const doc = await PDFDocument.create();
  const jpeg = new Uint8Array(await jpegFile().arrayBuffer());
  const image = await doc.embedJpg(jpeg);
  const page = doc.addPage([200, 200]);
  page.drawImage(image, { x: 0, y: 0, width: 200, height: 200 });
  const bytes = await doc.save();
  return new File([bytes.slice().buffer], 'picture.pdf', { type: 'application/pdf' });
}

async function titledPdf(): Promise<File> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle('Quarterly report');
  doc.setAuthor('Someone');
  doc.setSubject('A subject that takes up a few bytes in the info dictionary');
  const bytes = await doc.save();
  return new File([bytes.slice().buffer], 'report.pdf', { type: 'application/pdf' });
}

/** A PDF carrying a large indirect object that nothing references. */
async function bloatedPdf(): Promise<File> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const dict = doc.context.obj({ Type: 'XObject', Subtype: 'Image', Width: 1, Height: 1 });
  doc.context.register(PDFRawStream.of(dict, new Uint8Array(20_000).fill(7)));
  const bytes = await doc.save();
  return new File([bytes.slice().buffer], 'bloated.pdf', { type: 'application/pdf' });
}

async function bytesOf(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function reportRows(result: Awaited<ReturnType<typeof tool.run>>): string[][] {
  const parsed = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
  return parsed.rows;
}

describe('pdf-compress run: quality presets', () => {
  for (const preset of ['light', 'balanced', 'strong', 'custom'] as const) {
    it(`produces a valid PDF for the "${preset}" preset with before/after sizes`, async () => {
      const file = await imagePdf();
      const progress: number[] = [];
      const result = await tool.run({
        files: [file],
        options: { preset, maxEdge: 800, quality: 60 },
        onProgress: (fraction) => progress.push(fraction),
      });

      expect(result.outputs).toHaveLength(1);
      const out = result.outputs[0]!;
      expect(out.blob.type).toBe('application/pdf');

      const reloaded = await loadPdfBlob(out.blob);
      expect(reloaded.getPageCount()).toBe(1);

      const stats = result.stats!;
      expect(stats.originalBytes).toBe(file.size);
      expect(stats.pages).toBe(1);
      expect(stats.imagesProcessed).toBe(0); // jsdom has no OffscreenCanvas
      expect(progress.at(-1)).toBe(1);

      const rows = reportRows(result);
      expect(rows.map(([key]) => key)).toEqual(
        expect.arrayContaining(['Original size', 'Compressed size', 'Saved']),
      );
      const sizeRow = rows.find(([key]) => key === 'Original size');
      expect(sizeRow?.[1]).not.toBe('0 B');

      // Whenever there is no saving the original must come back byte-for-byte.
      if (Number(stats.savedBytes) > 0) {
        expect(out.filename).toBe('compressed.pdf');
        expect(out.blob.size).toBeLessThan(file.size);
      } else {
        expect(out.filename).toBe('picture.pdf');
        expect(await bytesOf(out.blob)).toEqual(await bytesOf(file));
        expect(result.warnings?.[0]).toMatch(/already optimised|would not make it smaller/i);
      }
    });
  }

  it('reports images it left untouched when the browser cannot re-encode them', async () => {
    const result = await tool.run({ files: [await imagePdf()], options: { preset: 'balanced' } });
    expect(result.stats?.imagesSkipped).toBe(1);
    expect(result.notes?.join(' ')).toMatch(/Images left unchanged/);
  });
});

describe('pdf-compress run: no images', () => {
  it('rebuilds a text-only PDF without touching images', async () => {
    const file = await makePdf(3);
    const result = await tool.run({ files: [file], options: { preset: 'balanced' } });
    const reloaded = await loadPdfBlob(result.outputs[0]!.blob);
    expect(reloaded.getPageCount()).toBe(3);
    expect(result.stats).toMatchObject({ pages: 3, imagesProcessed: 0, imagesSkipped: 0 });
    // No images means no "left unchanged" note.
    expect(result.notes?.join(' ')).not.toMatch(/Images left unchanged/);
  });
});

describe('pdf-compress run: metadata', () => {
  it('loadPdfBytes can keep the info dict untouched', async () => {
    // Build a source PDF that has a title but no producer/creator, then check
    // whether loading re-stamps them.
    const source = await PDFDocument.create();
    source.addPage([200, 200]);
    source.setTitle('Quarterly report');
    const info = source.context.lookup(source.context.trailerInfo.Info);
    if (info instanceof PDFDict) {
      info.delete(PDFName.of('Producer'));
      info.delete(PDFName.of('Creator'));
      info.delete(PDFName.of('CreationDate'));
      info.delete(PDFName.of('ModDate'));
    }
    const bytes = await source.save();

    const untouched = await loadPdfBytes(bytes, { updateMetadata: false });
    expect(untouched.getTitle()).toBe('Quarterly report');
    expect(untouched.getProducer()).toBeUndefined();

    const stamped = await loadPdfBytes(bytes);
    expect(stamped.getProducer()).toMatch(/pdf-lib/);
  });

  it('removes document metadata when asked', async () => {
    const file = await titledPdf();
    const result = await tool.run({ files: [file], options: { preset: 'light', stripMetadata: true } });
    const reloaded = await loadPdfBlob(result.outputs[0]!.blob);
    expect(reloaded.getTitle()).toBeUndefined();
    expect(reloaded.getAuthor()).toBeUndefined();
  });

  it('keeps metadata by default', async () => {
    const file = await titledPdf();
    const result = await tool.run({ files: [file], options: { preset: 'light' } });
    // Either the doc is returned unchanged, or a rebuild that kept the title.
    const reloaded = await loadPdfBlob(result.outputs[0]!.blob);
    expect(reloaded.getTitle()).toBe('Quarterly report');
  });
});

describe('pdf-compress run: errors and cancellation', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose a PDF file/i);
  });

  it('rejects malformed bytes with a user-facing error', async () => {
    await expect(tool.run({ files: [makeInvalidPdf()], options: {} })).rejects.toThrow(/valid, readable PDF/i);
  });

  it('rejects an empty file', async () => {
    const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
    await expect(tool.run({ files: [empty], options: {} })).rejects.toThrow(/valid, readable PDF/i);
  });

  it('refuses a file above the size limit instead of crashing', async () => {
    const file = await makePdf(1);
    Object.defineProperty(file, 'size', { value: 200 * 1024 * 1024 });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/too large/i);
  });

  it('honours an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [await makePdf(1)], options: {}, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('pdf-compress run: real savings', () => {
  it('reports a saving and removes unreferenced objects', async () => {
    const file = await bloatedPdf();
    expect(file.size).toBeGreaterThan(20_000);
    const result = await tool.run({ files: [file], options: { preset: 'light' } });

    expect(Number(result.stats!.savedBytes)).toBeGreaterThan(0);
    expect(result.stats!.prunedObjects).toBeGreaterThanOrEqual(1);
    expect(result.outputs[0]!.filename).toBe('compressed.pdf');
    expect(result.outputs[0]!.blob.size).toBeLessThan(file.size);
    expect(result.warnings).toBeUndefined();

    const rows = reportRows(result);
    const prunedRow = rows.find(([key]) => key === 'Unused objects removed');
    expect(Number(prunedRow?.[1])).toBeGreaterThanOrEqual(1);

    const reloaded = await loadPdfBlob(result.outputs[0]!.blob);
    expect(reloaded.getPageCount()).toBe(1);
  });
});

describe('pdf-compress run: graceful no-gain handling', () => {
  it('returns the original file when the rebuild would not be smaller', async () => {
    const file = await makePdf(1);
    const result = await tool.run({ files: [file], options: { preset: 'light' } });
    const out = result.outputs[0]!;
    if (Number(result.stats!.savedBytes) > 0) {
      expect(out.blob.size).toBeLessThan(file.size);
    } else {
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.join(' ')).toMatch(/already optimised|would not make it smaller/i);
      expect(await bytesOf(out.blob)).toEqual(await bytesOf(file));
    }
    // The report always states both sizes.
    const rows = reportRows(result);
    expect(rows.some(([key]) => key === 'Original size')).toBe(true);
    expect(rows.some(([key]) => key === 'Compressed size')).toBe(true);
  });
});
