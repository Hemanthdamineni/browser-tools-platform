/**
 * Pure, unit-testable core for `pdf-compress`.
 *
 * Design
 * ------
 * Input   one PDF file (`application/pdf`).
 * Options quality preset (`light` | `balanced` | `strong` | `custom`), plus
 *         `maxEdge`/`quality` for the custom preset, `stripMetadata`, and an
 *         output file name.
 * Output  a rebuilt PDF that is *smaller* than the input. Raster image
 *         XObjects may be downsampled and re-encoded to JPEG; unused indirect
 *         objects are pruned; the file is written as a single revision with
 *         compressed object streams.
 *
 * The tool never grows a file: when the rebuild is not smaller the original
 * bytes are returned unchanged and the caller says so.
 *
 * Edge cases handled here
 * -----------------------
 * - already-optimised PDF  → `compressionOutcome()` reports "no gain".
 * - PDF with no images     → `planImage()` is simply never called.
 * - encrypted / malformed  → rejected while loading (see `shared.loadPdfBytes`).
 * - huge PDF               → `assertSizeWithinLimit()`.
 * - object streams         → parsed by pdf-lib and re-emitted compressed.
 * - alpha / CMYK / 1-bit / predictor / mask images → deliberately skipped.
 *
 * Everything in this module is deterministic and free of DOM/canvas APIs so it
 * can be unit-tested in jsdom; the canvas re-encode path lives in the tool.
 */
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  type PDFContext,
  type PDFObject,
} from 'pdf-lib';
import { formatBytes } from '@/lib/format';
import { ToolError } from '@/lib/types';

/** Hard ceiling for a single input; beyond this a browser tab is likely to choke. */
export const MAX_INPUT_BYTES = 100 * 1024 * 1024;

export interface CompressionPreset {
  id: string;
  /** Whether embedded raster images may be downsampled / re-encoded. */
  reencode: boolean;
  /** Longest-side target in pixels (0 = never resize). */
  maxEdge: number;
  /** JPEG quality, 1–100. */
  quality: number;
  /** Only touch images whose encoded stream is at least this many bytes. */
  minBytes: number;
}

export const PRESETS: Record<'light' | 'balanced' | 'strong', CompressionPreset> = {
  light: { id: 'light', reencode: false, maxEdge: 0, quality: 0, minBytes: 0 },
  balanced: { id: 'balanced', reencode: true, maxEdge: 1600, quality: 75, minBytes: 32 * 1024 },
  strong: { id: 'strong', reencode: true, maxEdge: 1100, quality: 55, minBytes: 16 * 1024 },
};

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Resolve the preset, clamping custom numbers and falling back to `balanced`. */
export function resolvePreset(
  id: unknown,
  maxEdge?: unknown,
  quality?: unknown,
): CompressionPreset {
  const key = String(id ?? '');
  if (key === 'light') return PRESETS.light;
  if (key === 'strong') return PRESETS.strong;
  if (key === 'custom') {
    return {
      id: 'custom',
      reencode: true,
      maxEdge: clampNumber(maxEdge, 200, Number.MAX_SAFE_INTEGER, 1600),
      quality: clampNumber(quality, 1, Number.MAX_SAFE_INTEGER, 75),
      minBytes: 8 * 1024,
    };
  }
  return PRESETS.balanced;
}

/**
 * Scale `width`×`height` so the longest side is at most `maxEdge`. An image that
 * already fits is returned unchanged (never upscaled); aspect ratio is kept and
 * a dimension is never rounded below 1 px.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width) || 1);
  const h = Math.max(1, Math.round(height) || 1);
  if (!(maxEdge > 0)) return { width: w, height: h };
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function assertSizeWithinLimit(size: number, limit = MAX_INPUT_BYTES): void {
  if (size > limit) {
    throw new ToolError(
      `This PDF is ${formatBytes(size)} — too large to compress in a browser tab.`,
      `Files up to ${formatBytes(limit)} are supported.`,
    );
  }
}

export interface EmbeddedImage {
  width: number;
  height: number;
  bitsPerComponent: number;
  /** PDF filter name including the slash, e.g. `/DCTDecode`. */
  filter: string;
  /** PDF colour-space name including the slash, e.g. `/DeviceRGB`. */
  colorSpace: string;
  /** 1 for grey, 3 for RGB, 0 when unknown/unsupported. */
  colorComponents: number;
  imageMask: boolean;
  hasSoftMask: boolean;
  hasMask: boolean;
  hasPredictor: boolean;
  /** Byte size of the encoded stream as stored in the file. */
  encodedBytes: number;
}

function numberValue(dict: PDFDict, key: string): number | undefined {
  const value = dict.lookup(PDFName.of(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

function boolValue(dict: PDFDict, key: string): boolean {
  const value = dict.lookup(PDFName.of(key));
  return value instanceof PDFBool && value.asBoolean();
}

function filterName(dict: PDFDict): string {
  const filter = dict.lookup(PDFName.of('Filter'));
  if (filter instanceof PDFName) return filter.asString();
  if (filter instanceof PDFArray && filter.size() === 1) {
    const only = filter.get(0);
    if (only instanceof PDFName) return only.asString();
  }
  return filter instanceof PDFArray ? '/Multiple' : '';
}

function colorSpaceName(dict: PDFDict): string {
  const space = dict.lookup(PDFName.of('ColorSpace'));
  if (space instanceof PDFName) return space.asString();
  if (space instanceof PDFArray) {
    const first = space.get(0);
    if (first instanceof PDFName) return first.asString();
  }
  return '';
}

function componentCount(name: string): number {
  if (name === '/DeviceGray' || name === '/CalGray') return 1;
  if (name === '/DeviceRGB' || name === '/CalRGB') return 3;
  return 0;
}

function hasPredictor(dict: PDFDict): boolean {
  const parms = dict.lookup(PDFName.of('DecodeParms'));
  const dicts =
    parms instanceof PDFDict ? [parms] : parms instanceof PDFArray ? parms.asArray() : [];
  for (const entry of dicts) {
    if (!(entry instanceof PDFDict)) continue;
    const predictor = entry.lookup(PDFName.of('Predictor'));
    if (predictor instanceof PDFNumber && predictor.asNumber() > 1) return true;
  }
  return false;
}

/** Read the metadata of an image XObject stream, or `null` for a non-image stream. */
export function readEmbeddedImage(stream: PDFRawStream): EmbeddedImage | null {
  const { dict } = stream;
  const subtype = dict.lookup(PDFName.of('Subtype'));
  if (!(subtype instanceof PDFName) || subtype.asString() !== '/Image') return null;
  const width = numberValue(dict, 'Width');
  const height = numberValue(dict, 'Height');
  if (!width || !height) return null;
  const colorSpace = colorSpaceName(dict);
  const filter = filterName(dict);
  return {
    width,
    height,
    // /BitsPerComponent is optional for DCTDecode (JPEG) streams; 8 is implied.
    bitsPerComponent: numberValue(dict, 'BitsPerComponent') ?? (filter === '/DCTDecode' ? 8 : 0),
    filter,
    colorSpace,
    colorComponents: componentCount(colorSpace),
    imageMask: boolValue(dict, 'ImageMask'),
    hasSoftMask: dict.has(PDFName.of('SMask')),
    hasMask: dict.has(PDFName.of('Mask')),
    hasPredictor: hasPredictor(dict),
    encodedBytes: stream.contents.length,
  };
}

/** Decoding more pixels than this risks exhausting a browser tab's memory. */
export const MAX_DECODE_PIXELS = 40_000_000;

export interface ImageDecision {
  process: boolean;
  reason: string;
  width: number;
  height: number;
}

/**
 * Decide whether a single embedded image should be re-encoded, and at what size.
 * Conservative by design: anything we cannot decode faithfully is left untouched
 * so the output is never visibly wrong.
 */
export function planImage(image: EmbeddedImage, preset: CompressionPreset): ImageDecision {
  const skip = (reason: string): ImageDecision => ({
    process: false,
    reason,
    width: image.width,
    height: image.height,
  });
  if (!preset.reencode) return skip('the selected preset keeps images untouched');
  if (image.imageMask) return skip('image mask (used for clipping, not a picture)');
  if (image.hasSoftMask || image.hasMask)
    return skip('image has transparency, which JPEG cannot keep');
  if (image.width * image.height > MAX_DECODE_PIXELS)
    return skip('too many pixels to decode safely');
  if (image.filter === '/DCTDecode' && image.colorSpace === '/DeviceCMYK') {
    return skip('CMYK JPEGs decode inconsistently across browsers');
  }
  if (image.filter !== '/DCTDecode' && image.filter !== '/FlateDecode') {
    return skip(`${image.filter.replace('/', '') || 'unknown'}-encoded images are not supported`);
  }
  if (image.filter === '/FlateDecode' && image.bitsPerComponent !== 8) {
    return skip(`unsupported bit depth (${image.bitsPerComponent})`);
  }
  if (image.hasPredictor) return skip('predictor-filtered stream');
  if (image.filter === '/FlateDecode' && !image.colorComponents) {
    return skip(`unsupported colour space (${image.colorSpace.replace('/', '') || 'unknown'})`);
  }
  const target = fitWithin(image.width, image.height, preset.maxEdge);
  const resized = target.width !== image.width || target.height !== image.height;
  if (!resized && image.encodedBytes < preset.minBytes) return skip('already small enough');
  return { process: true, reason: resized ? 'downsample' : 're-encode', ...target };
}

export interface CompressionOutcome {
  /** True only when the rebuilt file is strictly smaller. */
  improved: boolean;
  savedBytes: number;
  /** output / input, where 1 means "no change". */
  ratio: number;
  /** Fraction saved (0..1), never negative. */
  percent: number;
}

export function compressionOutcome(originalBytes: number, outputBytes: number): CompressionOutcome {
  const savedBytes = originalBytes - outputBytes;
  const improved = originalBytes > 0 && outputBytes > 0 && savedBytes > 0;
  const ratio = originalBytes > 0 ? outputBytes / originalBytes : 1;
  const percent = originalBytes > 0 ? Math.max(0, savedBytes) / originalBytes : 0;
  return { improved, savedBytes, ratio, percent };
}

/**
 * Collect every indirect ref reachable from the trailer (`Root`, `Info`, `ID`)
 * by walking dictionaries, arrays and stream dictionaries. Used to find unused
 * objects; stream *contents* are never inspected (they reference resources by
 * name, not by number).
 */
export function collectReachableRefs(context: PDFContext): Set<string> {
  const seen = new Set<string>();
  const stack: PDFObject[] = [];
  const { Root, Info, ID } = context.trailerInfo;
  if (Root) stack.push(Root);
  if (Info) stack.push(Info);
  if (ID) stack.push(ID);

  while (stack.length) {
    const object = stack.pop()!;
    if (object instanceof PDFRef) {
      const key = object.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      const target = context.lookup(object);
      if (target) stack.push(target);
    } else if (object instanceof PDFDict) {
      for (const [, value] of object.entries()) stack.push(value);
    } else if (object instanceof PDFArray) {
      stack.push(...object.asArray());
    } else if (object instanceof PDFStream) {
      stack.push(object.dict);
    }
  }
  return seen;
}

/** Delete indirect objects that nothing in the document references. Returns the count removed. */
export function pruneUnreachableObjects(context: PDFContext): number {
  const reachable = collectReachableRefs(context);
  let pruned = 0;
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reachable.has(ref.toString()) && context.delete(ref)) pruned++;
  }
  return pruned;
}

/** Remove the standard document-info entries so they cost no bytes. Returns true if anything changed. */
export function stripDocumentMetadata(doc: { context: PDFContext }): boolean {
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  if (!(info instanceof PDFDict)) return false;
  let changed = false;
  for (const key of [
    'Title',
    'Author',
    'Subject',
    'Keywords',
    'Creator',
    'Producer',
    'CreationDate',
    'ModDate',
  ]) {
    if (info.delete(PDFName.of(key))) changed = true;
  }
  return changed;
}
