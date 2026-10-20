import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { degrees } from 'pdf-lib';
import { abort, firstFile, loadPdf, output, resolve } from './shared';
import { meta } from './pdf-sign.meta';

/** Refuse obviously huge jobs with a friendly message instead of running out of memory. */
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_PAGES = 2000;
const MAX_SIGNATURE_BYTES = 8 * 1024 * 1024;
const MAX_SIGNATURE_WIDTH = 5000;

const POSITIONS = new Set([
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'top-right',
  'top-left',
  'center',
  'custom',
]);

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function decodeBase64(value: string): Uint8Array {
  const clean = value.replace(/\s+/g, '');
  if (!clean || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    throw new ToolError('The signature image is not valid base64 data.');
  }
  let binary: string;
  try {
    binary = atob(clean);
  } catch {
    throw new ToolError('The signature image is not valid base64 data.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The signature always reaches `run()` as a PNG or JPEG data URL produced by the pad. */
function parseSignature(value: unknown): { bytes: Uint8Array; format: 'png' | 'jpg' } {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new ToolError(
      'Add a signature first.',
      'Draw, type or upload one in the signature pad, then run the tool.',
    );
  }
  const match = /^data:image\/(png|jpe?g)(?:;charset=[^;,]+)?;base64,(.*)$/is.exec(text);
  if (!match) {
    throw new ToolError(
      'The signature must be a PNG or JPEG image.',
      'Use the signature pad, or paste a data:image/png;base64,… URL.',
    );
  }
  const bytes = decodeBase64(match[2] ?? '');
  if (!bytes.length) throw new ToolError('The signature image is empty.');
  if (bytes.length > MAX_SIGNATURE_BYTES) {
    throw new ToolError(
      'That signature image is too large (over 8 MB).',
      'Upload a smaller PNG or JPEG, or redraw it in the pad.',
    );
  }
  return { bytes, format: match[1]!.toLowerCase() === 'png' ? 'png' : 'jpg' };
}

function presetPosition(
  position: string,
  box: { pageWidth: number; pageHeight: number; width: number; height: number; margin: number },
): { x: number; y: number } {
  const { pageWidth, pageHeight, width, height, margin } = box;
  switch (position) {
    case 'bottom-center':
      return { x: (pageWidth - width) / 2, y: margin };
    case 'bottom-left':
      return { x: margin, y: margin };
    case 'top-right':
      return { x: pageWidth - margin - width, y: pageHeight - margin - height };
    case 'top-left':
      return { x: margin, y: pageHeight - margin - height };
    case 'center':
      return { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2 };
    case 'bottom-right':
    default:
      return { x: pageWidth - margin - width, y: margin };
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  if (file.size > MAX_FILE_BYTES) {
    throw new ToolError(
      'That PDF is too large to sign (over 200 MB).',
      'Split it first with the Split PDF tool, sign each part, then merge them again.',
    );
  }

  const signature = parseSignature(o.signatureImage);

  input.onProgress?.(0, 'Reading PDF');
  const doc = await loadPdf(file);
  abort(input);

  const total = doc.getPageCount();
  if (total > MAX_PAGES) {
    throw new ToolError(
      `This PDF has ${total.toLocaleString('en-US')} pages — signing is limited to ${MAX_PAGES.toLocaleString('en-US')} pages.`,
      'Split it first with the Split PDF tool.',
    );
  }

  const requestedPage = Math.trunc(Number(o.page));
  if (!Number.isFinite(requestedPage) || requestedPage < 1 || requestedPage > total) {
    throw new ToolError(`Page ${o.page} is outside this PDF (1–${total}).`);
  }
  const page = doc.getPage(requestedPage - 1)!;

  input.onProgress?.(0.35, 'Embedding signature');
  let image;
  try {
    image =
      signature.format === 'png'
        ? await doc.embedPng(signature.bytes)
        : await doc.embedJpg(signature.bytes);
  } catch {
    throw new ToolError(
      'That signature image could not be embedded.',
      'Try a different PNG or JPEG, or redraw the signature in the pad.',
    );
  }

  const width = clamp(o.width, 10, MAX_SIGNATURE_WIDTH, 150);
  const height = Math.max(1, (width * image.height) / image.width);
  const { width: pageWidth, height: pageHeight } = page.getSize();

  const position = String(o.position ?? 'bottom-right');
  if (!POSITIONS.has(position)) throw new ToolError('Choose a valid signature position.');

  let x: number;
  let y: number;
  if (position === 'custom') {
    if (!Number.isFinite(Number(o.x)) || !Number.isFinite(Number(o.y))) {
      throw new ToolError('Enter numeric X and Y coordinates.');
    }
    x = Number(o.x);
    y = Number(o.y);
  } else {
    const margin = clamp(o.margin, 0, 2000, 36);
    ({ x, y } = presetPosition(position, { pageWidth, pageHeight, width, height, margin }));
  }

  const opacity = clamp(o.opacity, 5, 100, 100) / 100;
  const rotation = clamp(o.rotation, -180, 180, 0);

  abort(input);
  input.onProgress?.(0.7, `Signing page ${requestedPage}`);
  const transform = { x, y, width, height, rotate: degrees(rotation) };
  if (opacity < 1) page.drawImage(image, { ...transform, opacity });
  else page.drawImage(image, transform);

  const bytes = await doc.save();
  const result = output(`${file.name.replace(/\.pdf$/i, '') || 'document'}-signed.pdf`, bytes);
  result.stats = {
    pages: total,
    signed: requestedPage,
    width: round(width),
    height: round(height),
    x: round(x),
    y: round(y),
    opacity: Math.round(opacity * 100),
    rotation,
  };
  result.notes = [
    `Signature flattened onto page ${requestedPage} of ${total} at (${round(x)}, ${round(y)}) points from the bottom-left.`,
  ];
  if (x < 0 || y < 0 || x + width > pageWidth || y + height > pageHeight) {
    result.warnings = [
      'The signature extends past the page edge — lower its width or move it inside the page.',
    ];
  }
  input.onProgress?.(1, 'Done');
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
