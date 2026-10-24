import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { isAbortError, loadModel } from '@/lib/ml';
import { checkAbort, checkFiles } from './common';
import { context2d, createCanvas, decodeOriented, encodeCanvas } from './image-batch';
import {
  OUTPUT_MIME,
  assertInputBytes,
  assertInputPixels,
  composite,
  matteCoverage,
  modelProgressUpdate,
  normalizeCutoff,
  outputFilename,
  resolveBackground,
  type Matte,
} from './background-remover.core';
import { meta } from './background-remover.meta';

/**
 * Remove an image background on-device with MODNet.
 *
 * The model (`Xenova/modnet`, Apache-2.0) is a *portrait matting* network: it
 * estimates a soft alpha matte for the person in the picture. The weights are
 * downloaded from the Hugging Face Hub on first use and cached in the browser;
 * the user's image never leaves the tab.
 *
 * The model call is injectable (`setMatteProducer`) so the pure logic in
 * `background-remover.core.ts` can be tested without a model.
 */

/** The reviewed, permissively licensed model this tool uses. */
export const MODEL_ID = 'Xenova/modnet';

/** The transformers.js task that produces the alpha matte. */
export const MODEL_TASK = 'image-segmentation';

/** The mask the image-segmentation pipeline returns for the subject. */
interface MaskLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

interface SegmentationEntry {
  label: string | null;
  score: number | null;
  mask: MaskLike;
}

type SegmentationPipeline = (input: OffscreenCanvas) => Promise<SegmentationEntry[]>;

/** What a producer returns: the matte plus a little run metadata. */
export interface MatteResult extends Matte {
  /** True when the model weights came from the browser cache. */
  fromCache?: boolean;
  /** Which backend actually ran the model (`webgpu` or `wasm`). */
  backend?: string;
}

export interface MatteContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/**
 * Produces the alpha matte for a canvas. Injectable so tests never need the
 * real model (or a network connection).
 */
export type MatteProducer = (
  canvas: OffscreenCanvas,
  context: MatteContext,
) => Promise<MatteResult>;

let producer: MatteProducer | null = null;

/** Replace the model producer (tests). Pass `null` to restore MODNet. */
export function setMatteProducer(next: MatteProducer | null): void {
  producer = next;
}

/**
 * The default producer: load MODNet through the shared ML runtime and run it.
 *
 * The loader's download progress is mapped onto the workbench bar, including
 * the byte counts, so the first run says how much it is downloading instead of
 * looking like a hung tab.
 */
async function runModnet(canvas: OffscreenCanvas, context: MatteContext): Promise<MatteResult> {
  const loaded = await loadModel<SegmentationPipeline>({
    task: MODEL_TASK,
    model: MODEL_ID,
    signal: context.signal,
    onProgress: (progress) => {
      const update = modelProgressUpdate(progress, 0.05, 0.8);
      context.onProgress?.(update.fraction, update.message);
    },
  });

  try {
    context.onProgress?.(0.86, 'Removing the background…');
    const result = await loaded.pipeline(canvas);
    const entry = Array.isArray(result) ? result[0] : undefined;
    const mask = entry?.mask;
    if (!mask || !mask.data?.length) {
      throw new ToolError(
        'The model did not return a matte for this image.',
        'Try another picture.',
      );
    }
    return {
      data: mask.data,
      width: mask.width,
      height: mask.height,
      fromCache: loaded.fromCache,
      backend: loaded.backend,
    };
  } finally {
    await loaded.dispose();
  }
}

/** Turn an unexpected model failure into a friendly, user-facing error. */
function producerError(error: unknown): unknown {
  if (error instanceof ToolError || isAbortError(error)) return error;
  const detail = error instanceof Error ? error.message : String(error);
  const trimmed = detail.length > 160 ? `${detail.slice(0, 157)}…` : detail;
  return new ToolError(
    'The background could not be removed.',
    trimmed
      ? `The model failed to run: ${trimmed}`
      : 'The model failed to run. Try a recent Chrome, Edge, Firefox or Safari.',
  );
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, false);
  const file = input.files[0]!;

  // Validate everything cheap before the heavy work starts.
  assertInputBytes(file.size, file.name);
  const background = resolveBackground(o.background);
  const cutoff = normalizeCutoff(o.cutoff);

  checkAbort(input.signal);
  input.onProgress?.(0.02, 'Reading the image…');

  const bitmap = await decodeOriented(file);
  let width = 0;
  let height = 0;
  let source: Uint8ClampedArray = new Uint8ClampedArray(0);
  let result: MatteResult;
  try {
    width = bitmap.width;
    height = bitmap.height;
    assertInputPixels(width, height);

    // Draw the (EXIF-oriented) source into a canvas: the model reads pixels
    // from there, and the output keeps the same dimensions.
    const canvas = createCanvas(width, height);
    const ctx = context2d(canvas);
    ctx.drawImage(bitmap, 0, 0);
    // Keep the source pixels around: the model only returns a matte, so the
    // colours are composited here.
    source = ctx.getImageData(0, 0, width, height).data;

    input.onProgress?.(0.05, 'Loading the portrait matting model…');
    const produce = producer ?? runModnet;
    try {
      result = await produce(canvas, {
        signal: input.signal,
        onProgress: (fraction, message) => input.onProgress?.(fraction, message),
      });
    } catch (error) {
      throw producerError(error);
    }
  } finally {
    bitmap.close();
  }

  if (result.width !== width || result.height !== height) {
    throw new ToolError(
      'The model returned a matte that does not match the image.',
      'Try another picture.',
    );
  }

  input.onProgress?.(0.92, 'Compositing the result…');
  const pixels = composite(source, result.data, width, height, background.rgb, cutoff);

  const outCanvas = createCanvas(width, height);
  const outCtx = context2d(outCanvas);
  const imageData = outCtx.createImageData(width, height);
  imageData.data.set(pixels.subarray(0, imageData.data.length));
  outCtx.putImageData(imageData, 0, 0);

  input.onProgress?.(0.97, 'Encoding the PNG…');
  const blob = await encodeCanvas(outCanvas, OUTPUT_MIME);

  const coverage = matteCoverage(result.data, cutoff);
  const warnings: string[] = [];
  if (coverage < 0.005) {
    warnings.push(
      'No subject was found. MODNet is a portrait matting model, so it works best on a photo of a person.',
    );
  } else if (coverage > 0.995) {
    warnings.push(
      'Almost the whole image was kept. MODNet is a portrait matting model — on a landscape or an object it usually cannot find a subject.',
    );
  }

  const notes = [
    `Subject cut out with MODNet, a portrait-matting model: it is built for photos of people, not for scenery or objects.`,
    `Background: ${background.label}. Foreground coverage: ${Math.round(coverage * 100)}%.`,
    'The image was processed on your device — only the model weights were downloaded (about 6 MB) and they are cached for the next run.',
  ];
  if (result.fromCache) {
    notes.push('The model was already cached, so nothing was downloaded this time.');
  }

  input.onProgress?.(1, 'Done');

  return {
    outputs: [{ filename: outputFilename(file.name), blob }],
    notes,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      width,
      height,
      model: MODEL_ID,
      backend: result.backend ?? 'unknown',
      foregroundPercent: Math.round(coverage * 100),
      outputBytes: blob.size,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
