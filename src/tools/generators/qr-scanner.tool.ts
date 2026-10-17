import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import { meta } from './qr-scanner.meta';
import {
  ALL_FORMATS,
  QR_FORMATS,
  detectCodes,
  type DetectedCode,
  type DecodeOutcome,
} from './qr-decode';
import { classifyPayload } from './qr-payload';

/** Refuse anything above this outright — a decode would exhaust the tab. */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
/** Pixel budget for the decoded bitmap (a 40 MP image is already ~160 MB in RGBA). */
export const MAX_IMAGE_PIXELS = 40_000_000;
/** Practical per-side limit shared by browsers. */
export const MAX_IMAGE_EDGE = 16_384;

const IMAGE_EXTENSION = /\.(?:png|jpe?g|jfif|webp|gif|bmp|avif|heic|heif|tiff?|svg)$/i;

/** True when a file looks like an image by MIME type or extension. */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  if (file.type) return false;
  return IMAGE_EXTENSION.test(file.name);
}

/**
 * Decode a blob into a bitmap, honouring EXIF orientation where supported so a
 * phone photo is not mirrored (mirrored codes are unreadable).
 */
async function decodeOriented(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new ToolError(
      'Your browser does not support createImageBitmap.',
      'Try a recent Chrome, Edge, Firefox or Safari.',
    );
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    /* Older engines reject the options bag — retry with defaults. */
  }
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new ToolError(
      'That file could not be decoded as an image.',
      'Check that it is a valid PNG, JPEG, WebP, GIF, BMP or AVIF file.',
    );
  }
}

function guardDimensions(bitmap: ImageBitmap): void {
  const { width, height } = bitmap;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_EDGE ||
    height > MAX_IMAGE_EDGE ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new ToolError(
      `That image is too large to scan safely (${width}×${height} px).`,
      `The limit is ${MAX_IMAGE_PIXELS.toLocaleString()} pixels — about 40 megapixels. Downscale or crop around the code first.`,
    );
  }
}

export interface CodeSummary {
  file: string;
  code: DetectedCode;
  typeLabel: string;
  summary: string;
  fields: { label: string; value: string }[];
  warnings: string[];
  /** Safe link the payload offers, when it has one. */
  href?: string;
}

/** Build the flat, render-ready summary rows for the workbench report. */
export function summariseCodes(codes: CodeSummary[]): string[][] {
  const rows: string[][] = [];
  codes.forEach((entry, i) => {
    const n = String(i + 1);
    rows.push([n, entry.typeLabel, 'Format', entry.code.format || 'unknown']);
    if (entry.code.raw.trim()) {
      for (const field of entry.fields) rows.push(['', '', field.label, field.value]);
    } else {
      rows.push(['', '', 'Payload', '(empty)']);
    }
    if (entry.code.raw.includes('\n')) rows.push(['', '', 'Raw', entry.code.raw]);
    for (const warning of entry.warnings) rows.push(['', '⚠', 'Note', warning]);
  });
  return rows;
}

const DECODER_LABELS: Record<DecodeOutcome['backend'], string> = {
  native: 'Browser\u2019s built-in detector',
  fallback: 'Bundled decoder (jsQR)',
  none: 'No decoder produced a result',
};

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const formats = String(o.formats ?? 'all') === 'qr' ? [...QR_FORMATS] : [...ALL_FORMATS];
  const tryFallback = o.tryFallback !== false;
  const invert = o.invert !== false;

  const files = (input.files ?? []).filter(Boolean);
  if (!files.length) {
    throw new ToolError(
      'Choose an image that contains a code.',
      'Upload a screenshot or photo, or use the camera panel above.',
    );
  }

  const summaries: CodeSummary[] = [];
  const emptyFiles: string[] = [];
  let backend: DecodeOutcome['backend'] = 'none';
  let nativeAvailable = false;

  input.onProgress?.(0, 'Reading image');
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    input.signal?.throwIfAborted?.();

    if (!isImageFile(file)) {
      throw new ToolError(
        `"${file.name}" is not an image.`,
        'Upload a PNG, JPEG, WebP, GIF, BMP or AVIF file.',
      );
    }
    if (file.size === 0) {
      throw new ToolError(
        `"${file.name}" is empty.`,
        'Pick a file that actually contains an image.',
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ToolError(
        `"${file.name}" is ${formatBytes(file.size)} — too large to scan.`,
        `Images up to ${formatBytes(MAX_IMAGE_BYTES)} are accepted. Crop around the code or downscale it first.`,
      );
    }

    input.onProgress?.(i / files.length, `Decoding ${file.name}`);
    const bitmap = await decodeOriented(file);
    let outcome: DecodeOutcome;
    try {
      guardDimensions(bitmap);
      outcome = await detectCodes(bitmap, { formats, tryFallback, invert });
    } finally {
      bitmap.close?.();
    }

    nativeAvailable = nativeAvailable || outcome.nativeAvailable;
    if (outcome.codes.length) backend = outcome.backend;
    else emptyFiles.push(file.name);

    for (const code of outcome.codes) {
      const parsed = classifyPayload(code.raw);
      summaries.push({
        file: file.name,
        code,
        typeLabel: parsed.typeLabel,
        summary: parsed.summary,
        fields: parsed.fields,
        warnings: parsed.warnings,
        href: parsed.href,
      });
    }
    input.onProgress?.((i + 1) / files.length, `Scanned ${file.name}`);
  }

  if (!summaries.length) {
    throw new ToolError(
      files.length === 1
        ? `No code found in "${files[0]!.name}".`
        : `No code found in the ${files.length} chosen images.`,
      'Crop tightly around the code so it fills the frame, use a sharper screenshot, and avoid glare. Codes at any rotation work; blur, low contrast and heavy stylisation do not.',
    );
  }

  const notes: string[] = ['Decoded in this tab — the images were never uploaded or stored.'];
  if (emptyFiles.length) {
    notes.push(`No code found in: ${emptyFiles.join(', ')}.`);
  }
  if (backend === 'fallback' || (!nativeAvailable && tryFallback)) {
    notes.push(
      'This browser found nothing with its built-in detector, so the bundled fallback decoder was used (loaded on demand from this site).',
    );
  }
  notes.push(
    'Scan with your camera above for one-tap actions such as opening a link or copying a Wi-Fi password.',
  );

  const warnings: string[] = [];
  const openable = summaries.filter((s) => s.href);
  if (openable.length) {
    warnings.push(
      `Contains ${openable.length} openable link${openable.length === 1 ? '' : 's'} — open it deliberately, nothing navigated automatically.`,
    );
  }

  return {
    outputs: [],
    report: {
      output: JSON.stringify({
        headers: ['#', 'Type', 'Field', 'Value'],
        rows: summariseCodes(summaries),
      }),
      render: 'table',
    },
    notes,
    warnings,
    stats: {
      'Codes found': summaries.length,
      'Images scanned': files.length,
      Decoder: DECODER_LABELS[backend],
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
