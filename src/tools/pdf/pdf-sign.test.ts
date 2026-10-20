import { describe, it, expect } from 'vitest';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
  type PDFPage,
} from 'pdf-lib';
import tool from './pdf-sign.tool';
import { loadPdfBlob, makeInvalidPdf, makePdf, jpegFile, pngFile } from './pdf-test-helpers';

/* ------------------------------------------------------------------ */
/*  A minimal, dependency-free PNG encoder so tests can use rectangular */
/*  signature images (the shared helper only ships a 1×1 pixel).        */
/* ------------------------------------------------------------------ */

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(body.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, crc32(body));
  return out;
}

/** zlib stream using a single stored (uncompressed) deflate block. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const out = new Uint8Array(raw.length + 11);
  const view = new DataView(out.buffer);
  out[0] = 0x78;
  out[1] = 0x01;
  out[2] = 0x01; // BFINAL=1, BTYPE=00 (stored)
  view.setUint16(3, raw.length, true);
  view.setUint16(5, ~raw.length & 0xffff, true);
  out.set(raw, 7);
  view.setUint32(out.length - 4, adler32(raw));
  return out;
}

/** A solid opaque PNG of the requested size. */
function pngBytes(width: number, height: number): Uint8Array {
  const stride = 1 + width * 4;
  const raw = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < width; x++) raw[y * stride + 1 + x * 4 + 3] = 255;
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibStored(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function dataUrlOf(file: File): Promise<string> {
  return `data:${file.type};base64,${bytesToBase64(new Uint8Array(await file.arrayBuffer()))}`;
}

const pngSignature = () => dataUrlOf(pngFile());
const wideSignature = () => `data:image/png;base64,${bytesToBase64(pngBytes(4, 2))}`;

/* ------------------------------------------------------------------ */
/*  Output introspection helpers                                       */
/* ------------------------------------------------------------------ */

function matrices(text: string): number[][] {
  return [
    ...text.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/g),
  ].map((match) => match.slice(1, 7).map(Number));
}

function decodedContent(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [];
  return refs
    .map((ref) =>
      new TextDecoder('latin1').decode(
        decodePDFRawStream(doc.context.lookup(ref, PDFRawStream)).decode(),
      ),
    )
    .join('\n');
}

function imageNames(page: PDFPage): string[] {
  const xobjects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
  if (!xobjects) return [];
  return xobjects.keys().map((key) => String(key).replace(/^\//, ''));
}

function imageCount(page: PDFPage): number {
  return imageNames(page).length;
}

function alphas(page: PDFPage): number[] {
  const states = page.node.Resources()?.lookup(PDFName.of('ExtGState'), PDFDict);
  if (!states) return [];
  return states.keys().map((key) => {
    const dict = states.lookup(key, PDFDict);
    const ca = dict.get(PDFName.of('ca'));
    return ca instanceof PDFNumber ? ca.asNumber() : NaN;
  });
}

function annotations(page: PDFPage): number {
  return page.node.Annots()?.size() ?? 0;
}

const opts = (extra: Record<string, unknown> = {}) => ({ signatureImage: '', ...extra });

/* ------------------------------------------------------------------ */

describe('pdf-sign', () => {
  it('flattens a PNG signature into the page content at a preset position', async () => {
    const result = await tool.run({
      files: [await makePdf(3)],
      options: opts({
        signatureImage: await pngSignature(),
        page: 2,
        position: 'bottom-right',
        margin: 20,
        width: 100,
      }),
    });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('sample-signed.pdf');
    expect(result.outputs[0]!.blob.type).toBe('application/pdf');
    expect(result.stats).toMatchObject({ pages: 3, signed: 2, width: 100, height: 100, x: 90, y: 20 });
    expect(result.warnings).toBeUndefined();

    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(doc.getPageCount()).toBe(3);

    // Only the chosen page changed, and only by one embedded image.
    expect(imageCount(doc.getPage(0))).toBe(0);
    expect(imageCount(doc.getPage(1))).toBe(1);
    expect(imageCount(doc.getPage(2))).toBe(0);

    const page = doc.getPage(1);
    const text = decodedContent(doc, 1);
    const [name] = imageNames(page);
    expect(name).toBeTruthy();
    expect(text).toContain(`/${name} Do`);

    // Position and size are baked into the content stream.
    const cms = matrices(text);
    expect(cms[0]!.slice(4)).toEqual([90, 20]);
    expect(cms[2]!.slice(0, 2)).toEqual([100, 100]);

    // Flattened: no annotation and no form/signature field survives.
    expect(annotations(page)).toBe(0);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it('stays flattened after a save/reload round-trip', async () => {
    const result = await tool.run({
      files: [await makePdf(1)],
      options: opts({ signatureImage: await pngSignature() }),
    });
    const once = await loadPdfBlob(result.outputs[0]!.blob);
    const twice = await loadPdfBlob(new Blob([await once.save()], { type: 'application/pdf' }));
    expect(imageCount(twice.getPage(0))).toBe(1);
    expect(decodedContent(twice, 0)).toMatch(/\/Image-\d+ Do/);
    expect(annotations(twice.getPage(0))).toBe(0);
  });

  it('supports every preset and exact coordinates', async () => {
    const file = await makePdf(1); // page is 200 × 300
    const signatureImage = wideSignature(); // 4:2 → half height
    const run = async (position: string, extra: Record<string, unknown> = {}) => {
      const result = await tool.run({
        files: [file],
        options: opts({ signatureImage, position, width: 100, margin: 10, ...extra }),
      });
      return matrices(decodedContent(await loadPdfBlob(result.outputs[0]!.blob), 0))[0]!.slice(4);
    };

    expect(await run('bottom-right')).toEqual([90, 10]);
    expect(await run('bottom-center')).toEqual([50, 10]);
    expect(await run('bottom-left')).toEqual([10, 10]);
    expect(await run('top-right')).toEqual([90, 240]);
    expect(await run('top-left')).toEqual([10, 240]);
    expect(await run('center')).toEqual([50, 125]);
    expect(await run('custom', { x: 12.5, y: 34 })).toEqual([12.5, 34]);
  });

  it('scales the height to the signature proportions', async () => {
    const result = await tool.run({
      files: [await makePdf(1)],
      options: opts({ signatureImage: wideSignature(), width: 200 }),
    });
    expect(result.stats).toMatchObject({ width: 200, height: 100 });
    const text = decodedContent(await loadPdfBlob(result.outputs[0]!.blob), 0);
    expect(matrices(text)[2]!.slice(0, 2)).toEqual([200, 100]);
  });

  it('applies opacity through a graphics state', async () => {
    const opaque = await tool.run({
      files: [await makePdf(1)],
      options: opts({ signatureImage: await pngSignature() }),
    });
    const faded = await tool.run({
      files: [await makePdf(1)],
      options: opts({ signatureImage: await pngSignature(), opacity: 40 }),
    });

    expect(alphas((await loadPdfBlob(opaque.outputs[0]!.blob)).getPage(0))).toEqual([]);
    const fadedDoc = await loadPdfBlob(faded.outputs[0]!.blob);
    expect(alphas(fadedDoc.getPage(0))).toEqual([0.4]);
    expect(decodedContent(fadedDoc, 0)).toContain('gs');
    expect(faded.stats).toMatchObject({ opacity: 40 });
  });

  it('rotates the signature', async () => {
    const result = await tool.run({
      files: [await makePdf(1)],
      options: opts({ signatureImage: await pngSignature(), rotation: -90 }),
    });
    expect(result.stats).toMatchObject({ rotation: -90 });
    const cms = matrices(decodedContent(await loadPdfBlob(result.outputs[0]!.blob), 0));
    // The rotation matrix for -90° is [cos, sin, -sin, cos] = [0, -1, 1, 0].
    expect(cms[1]![1]).toBeCloseTo(-1, 6);
    expect(cms[1]![2]).toBeCloseTo(1, 6);
    expect(cms[1]![0]).toBeCloseTo(0, 6);
  });

  it('accepts a JPEG signature', async () => {
    const result = await tool.run({
      files: [await makePdf(1)],
      options: opts({ signatureImage: await dataUrlOf(jpegFile()) }),
    });
    const doc = await loadPdfBlob(result.outputs[0]!.blob);
    expect(imageCount(doc.getPage(0))).toBe(1);
  });

  it('warns when the signature extends past the page edge', async () => {
    const result = await tool.run({
      files: [await makePdf(1)],
      options: opts({ signatureImage: await pngSignature(), position: 'custom', x: -25, y: 10 }),
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toMatch(/page edge/i);
  });

  it('rejects pages outside the document', async () => {
    await expect(
      tool.run({ files: [await makePdf(2)], options: opts({ signatureImage: await pngSignature(), page: 9 }) }),
    ).rejects.toThrow(/outside this PDF \(1–2\)/);
    await expect(
      tool.run({ files: [await makePdf(2)], options: opts({ signatureImage: await pngSignature(), page: 0 }) }),
    ).rejects.toThrow(/outside this PDF/);
  });

  it('rejects non-PDF input and empty input', async () => {
    await expect(
      tool.run({ files: [makeInvalidPdf()], options: opts({ signatureImage: await pngSignature() }) }),
    ).rejects.toThrow(/not a valid, readable PDF/);
    await expect(tool.run({ files: [], options: opts({ signatureImage: await pngSignature() }) })).rejects.toThrow(
      /Choose a PDF file/,
    );
  });

  it('requires a well-formed PNG or JPEG signature', async () => {
    const file = await makePdf(1);
    await expect(tool.run({ files: [file], options: opts() })).rejects.toThrow(/Add a signature/);
    await expect(
      tool.run({ files: [file], options: opts({ signatureImage: 'hello' }) }),
    ).rejects.toThrow(/PNG or JPEG/);
    await expect(
      tool.run({ files: [file], options: opts({ signatureImage: 'data:image/gif;base64,R0lGOD' }) }),
    ).rejects.toThrow(/PNG or JPEG/);
    await expect(
      tool.run({ files: [file], options: opts({ signatureImage: 'data:image/png;base64,!!!!' }) }),
    ).rejects.toThrow(/base64/);
  });

  it('guards oversized files and very long documents', async () => {
    const huge = await makePdf(1);
    Object.defineProperty(huge, 'size', { value: 201 * 1024 * 1024 });
    await expect(
      tool.run({ files: [huge], options: opts({ signatureImage: await pngSignature() }) }),
    ).rejects.toThrow(/too large to sign/);

    const long = await makePdf(2001);
    await expect(
      tool.run({ files: [long], options: opts({ signatureImage: await pngSignature() }) }),
    ).rejects.toThrow(/limited to 2,000 pages/);
  });

  it('aborts when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({
        files: [await makePdf(1)],
        options: opts({ signatureImage: await pngSignature() }),
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/i);
  });
});
