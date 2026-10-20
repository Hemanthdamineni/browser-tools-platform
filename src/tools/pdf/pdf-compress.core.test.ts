import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { ToolError } from '@/lib/types';
import {
  MAX_INPUT_BYTES,
  assertSizeWithinLimit,
  clampNumber,
  collectReachableRefs,
  compressionOutcome,
  fitWithin,
  planImage,
  pruneUnreachableObjects,
  readEmbeddedImage,
  resolvePreset,
  stripDocumentMetadata,
  type EmbeddedImage,
} from './pdf-compress.core';
import { jpegFile } from './pdf-test-helpers';

async function imageDoc(): Promise<PDFDocument> {
  const jpeg = new Uint8Array(await jpegFile().arrayBuffer());
  const doc = await PDFDocument.create();
  const image = await doc.embedJpg(jpeg);
  const page = doc.addPage([200, 200]);
  page.drawImage(image, { x: 0, y: 0, width: 200, height: 200 });
  const bytes = await doc.save();
  return PDFDocument.load(bytes, { updateMetadata: false });
}

function firstImageStream(doc: PDFDocument): PDFRawStream {
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && readEmbeddedImage(object)) return object;
  }
  throw new Error('no image stream found');
}

function image(overrides: Partial<EmbeddedImage> = {}): EmbeddedImage {
  return {
    width: 4000,
    height: 3000,
    bitsPerComponent: 8,
    filter: '/DCTDecode',
    colorSpace: '/DeviceRGB',
    colorComponents: 3,
    imageMask: false,
    hasSoftMask: false,
    hasMask: false,
    hasPredictor: false,
    encodedBytes: 500_000,
    ...overrides,
  };
}

describe('pdf-compress core: presets', () => {
  it('resolves the named presets and falls back to balanced', () => {
    expect(resolvePreset('light')).toMatchObject({ reencode: false });
    expect(resolvePreset('strong')).toMatchObject({ reencode: true, maxEdge: 1100, quality: 55 });
    expect(resolvePreset('balanced').maxEdge).toBe(1600);
    expect(resolvePreset('nonsense')).toMatchObject({ id: 'balanced' });
    expect(resolvePreset(undefined)).toMatchObject({ id: 'balanced' });
  });

  it('clamps custom limits into safe ranges', () => {
    expect(resolvePreset('custom', 5000, 150)).toMatchObject({ maxEdge: 5000, quality: 100 });
    expect(resolvePreset('custom', 10, -5)).toMatchObject({ maxEdge: 200, quality: 1 });
    expect(resolvePreset('custom', 'oops', Number.NaN)).toMatchObject({
      maxEdge: 1600,
      quality: 75,
    });
    expect(clampNumber('42', 0, 100, 7)).toBe(42);
    expect(clampNumber(undefined, 0, 100, 7)).toBe(7);
  });
});

describe('pdf-compress core: fitWithin', () => {
  it('keeps aspect ratio and never upscales', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1000, 2000, 1600)).toEqual({ width: 800, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(500, 500, 0)).toEqual({ width: 500, height: 500 });
    expect(fitWithin(0, 0, 100)).toEqual({ width: 1, height: 1 });
  });
});

describe('pdf-compress core: size limit', () => {
  it('accepts files inside the limit and rejects bigger ones with a hint', () => {
    expect(() => assertSizeWithinLimit(1024)).not.toThrow();
    expect(() => assertSizeWithinLimit(MAX_INPUT_BYTES)).not.toThrow();
    try {
      assertSizeWithinLimit(MAX_INPUT_BYTES + 1);
      throw new Error('expected a ToolError');
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      expect((error as ToolError).message).toMatch(/too large/i);
      expect((error as ToolError).hint).toMatch(/supported/i);
    }
  });
});

describe('pdf-compress core: embedded images', () => {
  it('reads the metadata of a real embedded JPEG', async () => {
    const doc = await imageDoc();
    const image = readEmbeddedImage(firstImageStream(doc));
    expect(image).not.toBeNull();
    expect(image).toMatchObject({
      width: 1,
      height: 1,
      bitsPerComponent: 8,
      filter: '/DCTDecode',
      colorSpace: '/DeviceRGB',
      colorComponents: 3,
      imageMask: false,
      hasSoftMask: false,
      hasMask: false,
    });
  });

  it('ignores non-image streams', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes, { updateMetadata: false });
    for (const [, object] of reloaded.context.enumerateIndirectObjects()) {
      if (object instanceof PDFRawStream) expect(readEmbeddedImage(object)).toBeNull();
    }
  });

  it('treats a missing /BitsPerComponent as 8 for DCTDecode', async () => {
    const stream = firstImageStream(await imageDoc());
    stream.dict.delete(PDFName.of('BitsPerComponent'));
    expect(readEmbeddedImage(stream)?.bitsPerComponent).toBe(8);
  });

  it('reports predictor filtering', async () => {
    const doc = await PDFDocument.create();
    const dict = doc.context.obj({
      Type: 'XObject',
      Subtype: 'Image',
      Width: 100,
      Height: 100,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'FlateDecode',
      DecodeParms: doc.context.obj({ Predictor: 15, Colors: 3, Columns: 100 }),
    });
    const stream = PDFRawStream.of(dict, new Uint8Array([0, 1, 2, 3]));
    expect(readEmbeddedImage(stream)?.hasPredictor).toBe(true);
  });
});

describe('pdf-compress core: planImage', () => {
  const balanced = resolvePreset('balanced');
  const strong = resolvePreset('strong');
  const light = resolvePreset('light');

  it('skips everything for the lossless preset', () => {
    expect(planImage(image(), light)).toMatchObject({
      process: false,
      reason: expect.stringMatching(/untouched/),
    });
  });

  it('downsamples a large JPEG to the preset long edge', () => {
    expect(planImage(image(), balanced)).toMatchObject({
      process: true,
      width: 1600,
      height: 1200,
    });
    expect(planImage(image(), strong)).toMatchObject({ process: true, width: 1100, height: 825 });
  });

  it('re-encodes an already-small-dimension image only when it is chunky', () => {
    expect(
      planImage(image({ width: 800, height: 600, encodedBytes: 200_000 }), balanced),
    ).toMatchObject({
      process: true,
      width: 800,
      height: 600,
      reason: 're-encode',
    });
    expect(
      planImage(image({ width: 800, height: 600, encodedBytes: 1000 }), balanced),
    ).toMatchObject({
      process: false,
      reason: expect.stringMatching(/already small/),
    });
  });

  it('leaves images it cannot faithfully decode', () => {
    expect(planImage(image({ hasSoftMask: true }), balanced).reason).toMatch(/transparency/);
    expect(planImage(image({ imageMask: true }), balanced).reason).toMatch(/mask/);
    expect(planImage(image({ filter: '/JPXDecode' }), balanced).reason).toMatch(/JPXDecode/);
    expect(
      planImage(image({ filter: '/FlateDecode', bitsPerComponent: 1 }), balanced).reason,
    ).toMatch(/bit depth/);
    expect(
      planImage(image({ filter: '/FlateDecode', colorComponents: 0 }), balanced).reason,
    ).toMatch(/colour space/);
    expect(planImage(image({ hasPredictor: true }), balanced).reason).toMatch(/predictor/);
    expect(planImage(image({ colorSpace: '/DeviceCMYK' }), balanced).reason).toMatch(/CMYK/);
    expect(planImage(image({ width: 20_000, height: 20_000 }), balanced).reason).toMatch(/pixels/);
  });

  it('accepts 8-bit grey Flate images', () => {
    const grey = image({
      filter: '/FlateDecode',
      colorSpace: '/DeviceGray',
      colorComponents: 1,
      width: 3000,
      height: 2000,
    });
    expect(planImage(grey, balanced)).toMatchObject({ process: true, width: 1600, height: 1067 });
  });
});

describe('pdf-compress core: compressionOutcome', () => {
  it('flags a real saving', () => {
    expect(compressionOutcome(1000, 800)).toMatchObject({
      improved: true,
      savedBytes: 200,
      ratio: 0.8,
      percent: 0.2,
    });
  });
  it('refuses to claim a win when the file grows or is unchanged', () => {
    expect(compressionOutcome(1000, 1000).improved).toBe(false);
    const grew = compressionOutcome(1000, 1200);
    expect(grew.improved).toBe(false);
    expect(grew.savedBytes).toBe(-200);
    expect(grew.percent).toBe(0);
  });
});

describe('pdf-compress core: object cleanup', () => {
  it('finds the trailer root reachable and prunes an orphan object', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const orphan = doc.context.register(doc.context.obj({ unused: 'yes' }));

    const reachable = collectReachableRefs(doc.context);
    expect(reachable.has(String(doc.context.trailerInfo.Root))).toBe(true);
    expect(reachable.has(orphan.toString())).toBe(false);

    expect(pruneUnreachableObjects(doc.context)).toBeGreaterThanOrEqual(1);
    const refs = doc.context.enumerateIndirectObjects().map(([ref]) => ref.toString());
    expect(refs).not.toContain(orphan.toString());
    expect(refs).toContain(String(doc.context.trailerInfo.Root));
  });

  it('never prunes objects that are still referenced', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    expect(pruneUnreachableObjects(doc.context)).toBe(0);
  });
});

describe('pdf-compress core: metadata stripping', () => {
  it('removes the standard info entries', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    doc.setTitle('Hello');
    doc.setAuthor('Someone');
    expect(stripDocumentMetadata(doc)).toBe(true);
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
    expect(stripDocumentMetadata(doc)).toBe(false);
  });
});

describe('pdf-compress core: stream helpers sanity', () => {
  it('reads a number through an indirect reference', async () => {
    const doc = await PDFDocument.create();
    const ref = doc.context.register(PDFNumber.of(320));
    const dict = doc.context.obj({
      Subtype: 'Image',
      Width: ref,
      Height: 100,
      Filter: 'DCTDecode',
    });
    const stream = PDFRawStream.of(dict, new Uint8Array(10));
    expect(readEmbeddedImage(stream)?.width).toBe(320);
  });
});
