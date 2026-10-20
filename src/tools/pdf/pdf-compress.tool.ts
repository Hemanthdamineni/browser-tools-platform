import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { formatBytes, formatPercent } from '@/lib/format';
import { unzlibSync } from 'fflate';
import { PDFDict, PDFName, PDFNumber, PDFRawStream, type PDFRef } from 'pdf-lib';
import { abort, firstFile, loadPdfBytes, output, PDFDocument, resolve } from './shared';
import { meta } from './pdf-compress.meta';
import {
  assertSizeWithinLimit,
  compressionOutcome,
  planImage,
  pruneUnreachableObjects,
  readEmbeddedImage,
  resolvePreset,
  stripDocumentMetadata,
  type CompressionPreset,
  type EmbeddedImage,
} from './pdf-compress.core';

/*
 * Lazy loading: this tool module is not part of any eager bundle. `registry.ts`
 * turns every `.tool.ts` into a lazy `import()` factory and the tool worker
 * awaits it only when this tool runs, so pdf-lib/fflate are only fetched when
 * the user clicks Run. No fetch/XHR/WebSocket/EventSource is used here.
 *
 * Caveat (repo-wide, pre-existing): `src/tools/pdf/*.meta.ts` (including this
 * tool's) import their credit objects from `./shared`, which statically imports
 * pdf-lib, and `*.meta.ts` files ARE eagerly bundled by the registry. That puts
 * pdf-lib into an eagerly-loaded chunk for every page. It is not introduced by
 * this tool — the fix is to move the credit constants to a pdf-lib-free module
 * and import them from the metas, which touches every PDF tool and is left to a
 * dedicated cleanup.
 */

function canReencodeImages(): boolean {
  return typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function';
}

function decodeToBitmap(
  stream: PDFRawStream,
  image: EmbeddedImage,
  target: { width: number; height: number },
): Promise<ImageBitmap> {
  if (image.filter === '/DCTDecode') {
    const blob = new Blob([stream.contents.slice()], { type: 'image/jpeg' });
    // Decode straight to the target size: full-resolution scans can be huge.
    const resized = target.width !== image.width || target.height !== image.height;
    if (resized) {
      try {
        return createImageBitmap(blob, {
          resizeWidth: target.width,
          resizeHeight: target.height,
          resizeQuality: 'high',
        });
      } catch {
        /* fall through to a plain decode below */
      }
    }
    return createImageBitmap(blob);
  }
  // FlateDecode raw samples → RGBA. Only 8-bit grey/RGB reach here (see planImage).
  const raw = unzlibSync(stream.contents);
  const pixels = image.width * image.height;
  const components = image.colorComponents;
  if ((components !== 1 && components !== 3) || raw.length < pixels * components) {
    throw new Error('unexpected raw image size');
  }
  const rgba = new Uint8ClampedArray(pixels * 4);
  for (let p = 0, src = 0, dst = 0; p < pixels; p++, src += components, dst += 4) {
    if (components === 3) {
      rgba[dst] = raw[src]!;
      rgba[dst + 1] = raw[src + 1]!;
      rgba[dst + 2] = raw[src + 2]!;
    } else {
      const grey = raw[src]!;
      rgba[dst] = grey;
      rgba[dst + 1] = grey;
      rgba[dst + 2] = grey;
    }
    rgba[dst + 3] = 255;
  }
  return createImageBitmap(new ImageData(rgba, image.width, image.height));
}

interface RecodeResult {
  stream: PDFRawStream;
  bytes: number;
}

async function recodeImage(
  stream: PDFRawStream,
  image: EmbeddedImage,
  width: number,
  height: number,
  preset: CompressionPreset,
): Promise<RecodeResult | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await decodeToBitmap(stream, image, { width, height });
    let canvas: OffscreenCanvas;
    try {
      canvas = new OffscreenCanvas(width, height);
    } catch {
      throw new ToolError(
        'Your browser could not create an offscreen canvas for image compression.',
      );
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ToolError('Your browser could not create a 2D drawing context.');
    // Flatten onto white: JPEG has no alpha channel.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: preset.quality / 100 });
    if (blob.type !== 'image/jpeg') return null;
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    if (jpeg.length >= image.encodedBytes) return null; // re-encoding this image would not help
    const dict = PDFDict.withContext(stream.dict.context);
    dict.set(PDFName.of('Type'), PDFName.of('XObject'));
    dict.set(PDFName.of('Subtype'), PDFName.of('Image'));
    dict.set(PDFName.of('Width'), PDFNumber.of(width));
    dict.set(PDFName.of('Height'), PDFNumber.of(height));
    dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
    dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
    dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    return { stream: PDFRawStream.of(dict, jpeg), bytes: jpeg.length };
  } catch (error) {
    if (error instanceof ToolError) throw error;
    return null; // undecodable image: keep the original bytes
  } finally {
    bitmap?.close?.();
  }
}

interface ImagePassStats {
  processed: number;
  skipped: number;
  savedBytes: number;
  reasons: string[];
}

async function optimizeImages(
  doc: PDFDocument,
  preset: CompressionPreset,
  input: FileRunInput,
): Promise<ImagePassStats> {
  const stats: ImagePassStats = { processed: 0, skipped: 0, savedBytes: 0, reasons: [] };
  if (!preset.reencode) return stats;

  const targets: { ref: PDFRef; stream: PDFRawStream; image: EmbeddedImage }[] = [];
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const image = readEmbeddedImage(object);
    if (image) targets.push({ ref, stream: object, image });
  }
  if (!targets.length) return stats;

  if (!canReencodeImages()) {
    stats.skipped = targets.length;
    stats.reasons.push(
      'this browser/worker has no OffscreenCanvas, so picture data was left untouched',
    );
    return stats;
  }

  for (let i = 0; i < targets.length; i++) {
    abort(input);
    const { ref, stream, image } = targets[i]!;
    const decision = planImage(image, preset);
    if (!decision.process) {
      stats.skipped++;
      if (!stats.reasons.includes(decision.reason)) stats.reasons.push(decision.reason);
      continue;
    }
    input.onProgress?.(
      0.1 + 0.7 * (i / targets.length),
      `Re-encoding image ${i + 1} of ${targets.length}`,
    );
    const result = await recodeImage(stream, image, decision.width, decision.height, preset);
    if (!result) {
      stats.skipped++;
      if (!stats.reasons.includes('re-encoding would not make it smaller')) {
        stats.reasons.push('re-encoding would not make it smaller');
      }
      continue;
    }
    doc.context.assign(ref, result.stream);
    stats.processed++;
    stats.savedBytes += image.encodedBytes - result.bytes;
  }
  return stats;
}

async function rebuildValid(doc: PDFDocument, expectedPages: number): Promise<Uint8Array | null> {
  try {
    const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    const check = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    return check.getPageCount() === expectedPages ? bytes : null;
  } catch {
    return null;
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  assertSizeWithinLimit(file.size);
  input.onProgress?.(0.02, 'Reading PDF');

  const bytes = new Uint8Array(await file.arrayBuffer());
  // updateMetadata:false keeps the document's own Info dict untouched.
  const doc = await loadPdfBytes(bytes, { ignoreEncryption: false, updateMetadata: false });
  abort(input);

  const pages = doc.getPageCount();
  const preset = resolvePreset(o.preset, o.maxEdge, o.quality);
  if (o.stripMetadata) stripDocumentMetadata(doc);

  const images = await optimizeImages(doc, preset, input);
  abort(input);

  input.onProgress?.(0.9, 'Rebuilding PDF');
  const pruned = pruneUnreachableObjects(doc.context);
  let outputBytes = await rebuildValid(doc, pages);
  let fallbackNote: string | null = null;
  if (!outputBytes) {
    // A prune we made was load-bearing after all — rebuild cleanly instead.
    fallbackNote =
      'Structural cleanup was skipped because it changed the document, so a straight rebuild was used.';
    const fresh = await loadPdfBytes(bytes, { ignoreEncryption: false, updateMetadata: false });
    if (o.stripMetadata) stripDocumentMetadata(fresh);
    outputBytes = await rebuildValid(fresh, pages);
  }
  abort(input);

  const outcome = compressionOutcome(bytes.length, outputBytes?.length ?? bytes.length);
  const rows: string[][] = [
    ['Original size', formatBytes(bytes.length)],
    ['Compressed size', formatBytes(outcome.improved ? outputBytes!.length : bytes.length)],
    [
      'Saved',
      outcome.improved
        ? `${formatBytes(outcome.savedBytes)} (${formatPercent(outcome.percent)})`
        : 'none',
    ],
    ['Pages', String(pages)],
    ['Images re-encoded', String(images.processed)],
    ['Images left as-is', String(images.skipped)],
    ['Unused objects removed', String(outcome.improved && !fallbackNote ? pruned : 0)],
  ];
  const report = {
    output: JSON.stringify({ headers: ['Metric', 'Value'], rows }),
    render: 'table' as const,
  };
  const stats = {
    originalBytes: bytes.length,
    outputBytes: outcome.improved ? outputBytes!.length : bytes.length,
    savedBytes: outcome.improved ? outcome.savedBytes : 0,
    ratio: outcome.improved ? Math.round(outcome.ratio * 1000) / 1000 : 1,
    pages,
    imagesProcessed: images.processed,
    imagesSkipped: images.skipped,
    prunedObjects: outcome.improved && !fallbackNote ? pruned : 0,
  };

  const warnings: string[] = [];
  const notes: string[] = [
    'Existing raster pictures are re-encoded and, when large, downsampled; text and vector content is rebuilt byte-for-byte by pdf-lib.',
  ];
  if (fallbackNote) notes.push(fallbackNote);
  if (images.reasons.length) notes.push(`Images left unchanged: ${images.reasons.join('; ')}.`);

  if (!outputBytes || !outcome.improved) {
    if (!outputBytes) {
      warnings.push(
        'A valid compressed copy could not be produced, so the original file is returned unchanged.',
      );
    } else {
      warnings.push(
        'This PDF is already optimised — compressing it would not make it smaller, so the original file is returned unchanged.',
      );
    }
    input.onProgress?.(1, 'No gain');
    const result = output(file.name, bytes);
    result.report = report;
    result.notes = notes;
    result.warnings = warnings;
    result.stats = stats;
    return result;
  }

  const filename = String(o.outputName || 'compressed.pdf');
  input.onProgress?.(1, 'Done');
  const result = output(filename, outputBytes);
  result.report = report;
  result.notes = notes;
  result.stats = stats;
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
