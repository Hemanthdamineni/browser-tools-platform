import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { degrees } from 'pdf-lib';
import { decodeDataUrl, readPngInfo } from '@/lib/signature/pixels';
import { abort, firstFile, loadPdf, output, resolve } from './shared';
import {
  aspectOf,
  clampRect,
  displayPageSize,
  fitSize,
  MIN_SIGNATURE_WIDTH,
  toUserSpace,
  visiblePageBox,
  wasClamped,
  type DisplayRect,
  type PageBox,
} from './pdf-sign.core';
import { meta } from './pdf-sign.meta';

/*
 * Lazy loading: like every other PDF tool, this module is only pulled in when
 * the tool actually runs (the registry turns `*.tool.ts` into a lazy `import()`
 * factory), so pdf-lib is fetched on demand and never on page load.
 */

/** PDFs above this size are refused with a clear message instead of hanging the tab. */
const MAX_PDF_BYTES = 100 * 1024 * 1024;

/** `report.pdf` → `report-signed.pdf`. */
function signedFilename(original: string): string {
  const base = original.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}-signed.pdf`;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  if (file.size > MAX_PDF_BYTES) {
    throw new ToolError(
      `This PDF is ${formatBytes(file.size)} — too large to sign in a browser tab.`,
      `Files up to ${formatBytes(MAX_PDF_BYTES)} are supported.`,
    );
  }

  const signature = String(o.signature ?? '').trim();
  if (!signature) {
    throw new ToolError('Create a signature first — draw it, type it or upload a PNG.');
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeDataUrl(signature).bytes;
  } catch {
    throw new ToolError('The signature image is malformed.', 'Try creating it again.');
  }
  const info = readPngInfo(bytes);
  if (!info) throw new ToolError('The signature is not a valid PNG image.');

  const rawPage = Number(o.page);
  const pageNumber = Number.isFinite(rawPage) ? Math.round(rawPage) : 1;
  if (pageNumber < 1) {
    throw new ToolError('Choose a page number of 1 or more.');
  }
  const width = Number(o.width);
  if (!Number.isFinite(width) || width <= 0) {
    throw new ToolError('The signature width must be greater than zero.');
  }
  if (width < MIN_SIGNATURE_WIDTH) {
    throw new ToolError(`The signature width must be at least ${MIN_SIGNATURE_WIDTH} points.`);
  }

  input.onProgress?.(0, 'Reading PDF');
  const doc = await loadPdf(file);
  const pageCount = doc.getPageCount();
  if (pageNumber > pageCount) {
    throw new ToolError(`Page ${pageNumber} is outside this PDF (1–${pageCount}).`);
  }
  abort(input);

  const page = doc.getPage(pageNumber - 1)!;
  // The visible region of the page: the crop box clipped to the media box.
  // pdf.js uses the same box for its preview, so both agree on where the
  // signature ends up.
  const media: PageBox = page.getMediaBox();
  const crop: PageBox = page.getCropBox();
  const box = visiblePageBox(media, crop);
  const rotation = page.getRotation().angle;
  const pageSize = displayPageSize(box, rotation);
  const aspect = aspectOf(info.width, info.height);

  // The height follows the signature's own aspect ratio so it is never stretched.
  const size = fitSize(width, aspect, pageSize);
  const requested: DisplayRect = {
    x: Number(o.x) || 0,
    y: Number(o.y) || 0,
    width: size.width,
    height: size.height,
  };
  const placement = clampRect(requested, pageSize);
  // "Clamped" covers both a signature that was moved back onto the page and
  // one that had to be scaled down to fit at all.
  const clamped = wasClamped(requested, placement) || size.width < width - 0.01;

  input.onProgress?.(0.5, 'Embedding the signature');
  let image;
  try {
    image = await doc.embedPng(bytes);
  } catch {
    throw new ToolError(
      'The signature image could not be embedded.',
      'Try exporting it as a plain PNG with transparency.',
    );
  }
  const anchor = toUserSpace(placement, box, rotation);
  page.drawImage(image, {
    x: anchor.x,
    y: anchor.y,
    width: placement.width,
    height: placement.height,
    rotate: degrees(anchor.rotate),
  });

  abort(input);
  input.onProgress?.(0.9, 'Saving the signed PDF');
  const saved = await doc.save();
  const result = output(signedFilename(file.name), saved);
  result.stats = {
    pages: pageCount,
    page: pageNumber,
    width: Math.round(placement.width),
    height: Math.round(placement.height),
  };
  result.notes = [`Signed page ${pageNumber} of ${pageCount}.`];
  if (clamped) {
    result.notes.push('The signature was moved or shrunk to fit inside the page.');
  }
  if (rotation) {
    result.notes.push(
      `The page is rotated ${rotation}° — the signature was placed to match the preview.`,
    );
  }
  if (!info.hasAlpha) {
    result.notes.push(
      'The signature image has no transparency, so its background is part of the mark.',
    );
  }
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
