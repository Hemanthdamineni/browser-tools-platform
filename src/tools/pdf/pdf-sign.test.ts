import { describe, expect, it } from 'vitest';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFPage,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
  degrees,
} from 'pdf-lib';
import tool from './pdf-sign.tool';
import { makeInvalidPdf, makePdf } from './pdf-test-helpers';
import { createSignaturePad } from '@/lib/signature/draw';
import { encodePng, FakeCanvas, installCanvasMock } from '../../../test/signature-fakes';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

/** A transparent PNG signature as a data URL, like the capture UI produces. */
function signaturePng(width = 60, height = 30, alpha = 255): string {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 17;
    pixels[i + 1] = 24;
    pixels[i + 2] = 39;
    pixels[i + 3] = alpha;
  }
  const png = encodePng(pixels, width, height);
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

/** A PNG without an alpha channel (colour type 2 = RGB). */
function opaqueSignaturePng(width = 60, height = 30): string {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 17;
    pixels[i + 1] = 24;
    pixels[i + 2] = 39;
    pixels[i + 3] = 255;
  }
  const png = encodePng(pixels, width, height);
  png[25] = 2; // colour type 2 = truecolour, no alpha channel
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

/** Assemble a minimal but structurally valid PDF from raw objects. */
function assemblePdf(objects: string[], trailerExtra = ''): Uint8Array<ArrayBuffer> {
  let pdf = '%PDF-1.7\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${trailerExtra} >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

/** A PDF that claims to be encrypted (the trailer carries an /Encrypt entry). */
function encryptedPdf(): File {
  const bytes = assemblePdf(
    [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
      '<< /Filter /Standard /V 1 /R 2 /O <0102030405060708090a0b0c0d0e0f10> /U <0102030405060708090a0b0c0d0e0f10> /P -1 >>',
    ],
    ' /Encrypt 4 0 R /ID [<0102030405060708> <0102030405060708>]',
  );
  return new File([bytes], 'locked.pdf', { type: 'application/pdf' });
}

/** The decoded content stream of a page. */
function pageContent(page: PDFPage, doc: PDFDocument): string {
  const contents = page.node.Contents();
  let object: unknown = contents;
  if (object instanceof PDFArray) object = object.asArray()[0];
  if (object instanceof PDFRef) object = doc.context.lookup(object);
  if (object instanceof PDFRawStream) {
    return new TextDecoder().decode(decodePDFRawStream(object).decode());
  }
  return '';
}

/** The size of every image XObject placed on a page. */
function imageSizes(page: PDFPage, doc: PDFDocument): { width: number; height: number }[] {
  return imageDicts(page, doc).map((dict) => ({
    width: dict.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber() ?? 0,
    height: dict.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber() ?? 0,
  }));
}

/** The dictionary of every image XObject placed on a page. */
function imageDicts(page: PDFPage, doc: PDFDocument): PDFDict[] {
  const resources = page.node.Resources();
  if (!resources) return [];
  const xObjects = resources.lookupMaybe(PDFName.of('XObject'), PDFDict);
  if (!xObjects) return [];
  const dicts: PDFDict[] = [];
  for (const key of xObjects.keys()) {
    let object: unknown = xObjects.get(key);
    if (object instanceof PDFRef) object = doc.context.lookup(object);
    if (object instanceof PDFRawStream) dicts.push(object.dict);
  }
  return dicts;
}

async function sign(
  file: File,
  options: Record<string, unknown> = {},
): Promise<{
  outputs: { filename: string; blob: Blob }[];
  notes?: string[];
  stats?: Record<string, unknown>;
}> {
  return tool.run({
    files: [file],
    options: {
      signature: signaturePng(),
      page: 1,
      x: 72,
      y: 150,
      width: 180,
      ...options,
    },
  }) as never;
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('pdf-sign', () => {
  it('flattens the signature into the page content', async () => {
    const pdf = await makePdf(2);
    const result = await sign(pdf, { page: 1, x: 72, y: 150, width: 100 });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('sample-signed.pdf');

    const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);

    const page = doc.getPage(0);
    // The image is embedded in the page's resources…
    expect(imageSizes(page, doc)).toHaveLength(1);
    // …and painted into the content stream, not left as an annotation.
    const content = pageContent(page, doc);
    expect(content).toContain(' Do');
    // Placed at 72 pt from the left, 100 pt wide and 50 pt tall (the
    // signature's own 2:1 aspect ratio), 100 pt above the bottom edge.
    expect(content).toMatch(/1 0 0 1 72 100 cm/);
    expect(content).toMatch(/100 0 0 50 0 0 cm/);
    expect(content).not.toContain('/Annots');
  });

  it('keeps the original file name in the download', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]);
    const bytes = await doc.save();
    const file = new File([bytes.slice().buffer], 'contract.pdf', { type: 'application/pdf' });
    const result = await sign(file);
    expect(result.outputs[0]!.filename).toBe('contract-signed.pdf');
  });

  it('signs the page the user picked', async () => {
    const pdf = await makePdf(3);
    const result = await sign(pdf, { page: 2 });
    const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);

    expect(doc.getPageCount()).toBe(3);
    expect(imageSizes(doc.getPage(0), doc)).toHaveLength(0);
    expect(imageSizes(doc.getPage(1), doc)).toHaveLength(1);
    expect(imageSizes(doc.getPage(2), doc)).toHaveLength(0);
    expect(result.stats).toMatchObject({ pages: 3, page: 2 });
  });

  it('keeps the signature aspect ratio', async () => {
    const pdf = await makePdf(1);
    const result = await sign(pdf, {
      signature: signaturePng(100, 25),
      width: 200,
    });
    const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const content = pageContent(doc.getPage(0), doc);
    // 200 wide, 200 / 4 = 50 tall.
    expect(content).toMatch(/200 0 0 50 /);
  });

  it('shrinks a signature that is larger than the page, keeping its ratio', async () => {
    const pdf = await makePdf(1); // 200 × 300 pt
    const result = await sign(pdf, { x: 0, y: 0, width: 5000 });
    const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const content = pageContent(doc.getPage(0), doc);
    // 200 wide (the full page), 100 tall — still 2:1.
    expect(content).toMatch(/200 0 0 100 /);
    expect(result.notes?.join(' ')).toMatch(/moved or shrunk/);
  });

  it('reports the placement in the stats and the notes', async () => {
    const pdf = await makePdf(1);
    const result = await sign(pdf, { page: 1, x: 20, y: 40, width: 100 });
    expect(result.stats).toMatchObject({ page: 1, width: 100, height: 50 });
    expect(result.notes?.join(' ')).toMatch(/Signed page 1 of 1/);
  });

  it('moves a signature that starts off the page back inside it', async () => {
    const pdf = await makePdf(1);
    const result = await sign(pdf, { x: -500, y: 5000, width: 180 });
    const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const content = pageContent(doc.getPage(0), doc);
    // The page is 210 × 300, so the signature ends up at the bottom left.
    expect(content).toMatch(/180 0 0 90 0 0 cm/);
    expect(result.notes?.join(' ')).toMatch(/moved or shrunk/);
  });

  it('places the signature inside the visible part of a cropped page', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 600]);
    // The visible region is 250 × 300 at (50, 100) — the rest is cropped away.
    page.setCropBox(50, 100, 250, 300);
    const bytes = await doc.save();
    const file = new File([bytes.slice().buffer], 'cropped.pdf', { type: 'application/pdf' });

    const result = await sign(file, { x: 10, y: 20, width: 100 });
    const out = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const signed = await PDFDocument.load(out);
    const content = pageContent(signed.getPage(0), signed);
    // Display (10, 20) inside the crop box → user space (50 + 10, 400 - 70).
    expect(content).toMatch(/1 0 0 1 60 330 cm/);
  });

  it('refuses to sign without a signature', async () => {
    const pdf = await makePdf(1);
    await expect(sign(pdf, { signature: '' })).rejects.toThrow(/Create a signature/);
  });

  it('refuses a malformed signature', async () => {
    const pdf = await makePdf(1);
    await expect(sign(pdf, { signature: 'not-a-data-url' })).rejects.toThrow(/malformed/);
  });

  it('refuses a signature that is not a PNG', async () => {
    const pdf = await makePdf(1);
    await expect(
      sign(pdf, { signature: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }),
    ).rejects.toThrow(/not a valid PNG/);
  });

  it('refuses a page that is not in the document', async () => {
    const pdf = await makePdf(2);
    await expect(sign(pdf, { page: 9 })).rejects.toThrow(/outside this PDF/);
  });

  it('refuses a page number below one', async () => {
    const pdf = await makePdf(2);
    await expect(sign(pdf, { page: 0 })).rejects.toThrow(/page number of 1 or more/);
    await expect(sign(pdf, { page: -3 })).rejects.toThrow(/page number of 1 or more/);
  });

  it('refuses a zero or negative width', async () => {
    const pdf = await makePdf(1);
    await expect(sign(pdf, { width: 0 })).rejects.toThrow(/greater than zero/);
    await expect(sign(pdf, { width: -50 })).rejects.toThrow(/greater than zero/);
  });

  it('refuses a width that is too small to read', async () => {
    const pdf = await makePdf(1);
    await expect(sign(pdf, { width: 2 })).rejects.toThrow(/at least 8 points/);
  });

  it('reports a corrupt PDF clearly', async () => {
    await expect(sign(makeInvalidPdf())).rejects.toThrow(/not a valid, readable PDF/);
  });

  it('reports an empty file clearly', async () => {
    const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
    await expect(sign(empty)).rejects.toThrow(/not a valid, readable PDF/);
  });

  it('reports a password-protected PDF clearly', async () => {
    await expect(sign(encryptedPdf())).rejects.toThrow(/password-protected/);
  });

  it('refuses a PDF that is too large', async () => {
    const big = await makePdf(1);
    Object.defineProperty(big, 'size', { value: 101 * 1024 * 1024 });
    await expect(sign(big)).rejects.toThrow(/too large to sign/);
  });

  it('compensates for a rotated page', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 600]);
    page.setRotation(degrees(90));
    const bytes = await doc.save();
    const file = new File([bytes.slice().buffer], 'rotated.pdf', { type: 'application/pdf' });

    const result = await sign(file, { page: 1, x: 10, y: 20, width: 100 });
    const out = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const signed = await PDFDocument.load(out);
    const content = pageContent(signed.getPage(0), signed);
    // The image is drawn rotated so it stays upright on the rotated page.
    expect(content).toMatch(/1 -1 /);
    expect(content).toMatch(/1 0 0 1 70 10 cm/);
    expect(result.notes?.join(' ')).toMatch(/rotated 90/);
  });

  it('embeds the exact pixels that were drawn', async () => {
    // A drawn signature (60 × 30) must survive the trip into the PDF unchanged.
    const pdf = await makePdf(1);
    const result = await sign(pdf, { signature: signaturePng(60, 30) });
    const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    expect(imageSizes(doc.getPage(0), doc)).toEqual([{ width: 60, height: 30 }]);
  });

  it('keeps the transparency of the signature as a soft mask', async () => {
    const pdf = await makePdf(1);
    const result = await sign(pdf, { signature: signaturePng(60, 30, 128) });
    const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const [dict] = imageDicts(doc.getPage(0), doc);
    expect(dict).toBeDefined();
    // A PNG with an alpha channel becomes an image with an /SMask, so the
    // signature really is transparent where the user did not draw.
    expect(dict!.has(PDFName.of('SMask'))).toBe(true);
  });

  it('notes when the signature image has no transparency', async () => {
    const pdf = await makePdf(1);
    const result = await sign(pdf, { signature: opaqueSignaturePng() });
    expect(result.notes?.join(' ')).toMatch(/no transparency/);
  });

  it('round-trips a drawn signature into the PDF (draw → PNG → embedded bytes)', async () => {
    const mock = installCanvasMock();
    try {
      const canvas = new FakeCanvas();
      const pad = createSignaturePad(canvas as unknown as HTMLCanvasElement, {
        width: 400,
        height: 120,
      });
      const event = (type: string, x: number, y: number) => {
        const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
        Object.defineProperty(e, 'pointerId', { value: 1 });
        Object.defineProperty(e, 'pointerType', { value: 'mouse' });
        return e;
      };
      canvas.dispatchEvent(event('pointerdown', 20, 30));
      canvas.dispatchEvent(event('pointermove', 180, 80));
      canvas.dispatchEvent(event('pointerup', 180, 80));

      const asset = pad.toAsset();
      expect(asset).not.toBeNull();

      const pdf = await makePdf(1);
      const result = await sign(pdf, { signature: asset!.dataUrl, width: 120 });
      const bytes = new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());
      const doc = await PDFDocument.load(bytes);

      // The embedded image has exactly the pixels that were drawn.
      expect(imageSizes(doc.getPage(0), doc)).toEqual([
        { width: asset!.width, height: asset!.height },
      ]);
      // …and it keeps the drawn aspect ratio on the page.
      const content = pageContent(doc.getPage(0), doc);
      const height = (120 * asset!.height) / asset!.width;
      const matrix = /120 0 0 ([0-9.]+) 0 0 cm/.exec(content);
      expect(matrix).not.toBeNull();
      expect(Number(matrix![1])).toBeCloseTo(height, 3);
    } finally {
      mock.restore();
    }
  });
});
