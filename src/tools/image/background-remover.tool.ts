/**
 * Background Remover — runs MODNet segmentation in a Web Worker to separate
 * foreground from background, then exports transparent PNG or solid-colour PNG.
 */
import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, outputMime, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  runBatch,
  throwIfAborted,
} from './image-batch';
import { loadModel, assertAllowedModel, type LoadedModel } from '@/lib/ml';
import { meta } from './background-remover.meta';

/** Options shape from the meta definition. */
interface BgRemoverOptions {
  output: 'transparent' | 'color';
  color: string;
  threshold: number;
}

/** Validated, resolved options for the processing pipeline. */
interface ResolvedOptions {
  output: 'transparent' | 'color';
  backgroundColor: string; // CSS color string for canvas fill
  threshold: number;
}

let modelCache: LoadedModel | null = null;

/** Validate and normalise raw options from the UI. */
function resolveBgOptions(raw: unknown): ResolvedOptions {
  const opt = resolveOptions(meta, raw as Record<string, unknown>);
  const output = opt.output === 'color' ? 'color' : 'transparent';
  const color = typeof opt.color === 'string' ? opt.color : '#ffffff';
  const threshold = typeof opt.threshold === 'number' ? opt.threshold : 0.5;

  const backgroundColor = output === 'color' ? color : 'transparent';

  return {
    output,
    backgroundColor,
    threshold,
  };
}

/**
 * Apply the segmentation mask to the source bitmap.
 * Returns an OffscreenCanvas with the foreground composited over the chosen background.
 */
async function applyMask(
  source: ImageBitmap,
  mask: ImageBitmap,
  opts: ResolvedOptions,
): Promise<OffscreenCanvas> {
  const width = source.width;
  const height = source.height;

  assertCanvasBudget(width, height, 'background-remover output');

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);

  // Fill background first (transparent or solid colour)
  if (opts.backgroundColor !== 'transparent') {
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Explicitly clear to transparent (default, but be explicit)
    ctx.clearRect(0, 0, width, height);
  }

  // Draw the source image using the mask as alpha
  // We'll do this by drawing the mask to a temporary canvas, then using
  // globalCompositeOperation to apply it as an alpha mask

  // Create a temporary canvas for the mask
  const maskCanvas = createCanvas(width, height);
  const maskCtx = context2d(maskCanvas);
  maskCtx.drawImage(mask, 0, 0, width, height);

  // Get the mask pixel data (alpha channel)
  const maskData = maskCtx.getImageData(0, 0, width, height);

  // Create a canvas for the source
  const sourceCanvas = createCanvas(width, height);
  const sourceCtx = context2d(sourceCanvas);
  sourceCtx.drawImage(source, 0, 0, width, height);
  const sourceData = sourceCtx.getImageData(0, 0, width, height);

  // Apply the mask to the source alpha channel
  // The mask is a grayscale image where white = foreground, black = background
  // We use the mask's red channel (since it's grayscale, all channels are equal)
  // as the alpha multiplier
  const srcPixels = sourceData.data;
  const maskPixels = maskData.data;

  for (let i = 0; i < srcPixels.length; i += 4) {
    // maskPixels[i] is the red channel (0-255)
    // Normalize to 0-1 and apply threshold
    const maskValue = maskPixels[i] / 255;
    const alpha = maskValue >= opts.threshold ? maskValue : 0;
    srcPixels[i + 3] = Math.round(srcPixels[i + 3] * alpha);
  }

  // Put the modified pixels back and draw to output
  sourceCtx.putImageData(sourceData, 0, 0);
  ctx.drawImage(sourceCanvas, 0, 0);

  return canvas;
}

/** Process a single file through the background removal pipeline. */
async function processFile(
  file: File,
  opts: ResolvedOptions,
  signal?: AbortSignal,
): Promise<OutputFile> {
  throwIfAborted(signal);

  // Load the model (cached after first load)
  if (!modelCache) {
    // Verify the model is on the allow-list (throws if not)
    assertAllowedModel('Xenova/modnet');

    modelCache = await loadModel({
      task: 'image-segmentation',
      model: 'Xenova/modnet',
      // The model expects 512x512 input; pipeline handles resizing
      pipelineOptions: {},
      onProgress: undefined, // Could be wired to progress callback
      signal,
    });
  }

  throwIfAborted(signal);

  const { pipeline } = modelCache;

  // Decode the input image
  const sourceBitmap = await decodeOriented(file);

  throwIfAborted(signal);

  // Run segmentation
  // The pipeline returns an array of { mask: ImageBitmap, score: number, label: string }
  // For MODNet, we get a single mask for the foreground (person)
  const results = await pipeline(sourceBitmap);

  throwIfAborted(signal);

  // Find the foreground mask (highest score, or label 'person'/'foreground')
  let bestMask: ImageBitmap | null = null;
  let bestScore = -1;

  for (const result of results) {
    if (result.score > bestScore) {
      bestScore = result.score;
      bestMask = result.mask;
    }
  }

  if (!bestMask) {
    throw new ToolError('The model did not produce a segmentation mask.');
  }

  // Resize mask to match source if needed (pipeline may output different size)
  let maskBitmap = bestMask;
  if (bestMask.width !== sourceBitmap.width || bestMask.height !== sourceBitmap.height) {
    const maskCanvas = createCanvas(sourceBitmap.width, sourceBitmap.height);
    const maskCtx = context2d(maskCanvas);
    maskCtx.drawImage(bestMask, 0, 0, sourceBitmap.width, sourceBitmap.height);
    maskBitmap = await maskCanvas.transferToImageBitmap();
  }

  // Apply the mask
  const outputCanvas = await applyMask(sourceBitmap, maskBitmap, opts);

  // Determine output MIME type
  const mime = outputMime('png', file.type); // Always PNG for transparency support
  const name = `${stem(file.name)}-no-bg.${extension(mime)}`;

  // Encode
  const blob = await encodeCanvas(outputCanvas, mime);

  return { blob, name, mime };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, options, signal } = input;

  checkFiles(files, false);

  const opts = resolveBgOptions(options);

  const outputs = await runBatch(files, { signal }, 'Removing background', (file) =>
    processFile(file, opts, signal),
  );

  return { outputs };
}

const tool: FileToolModule = { meta, run };
export default tool;