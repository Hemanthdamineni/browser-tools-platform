/**
 * Image Upscale — enlarges an image with a classical resampling kernel
 * (Lanczos3, bicubic or nearest) plus an optional unsharp mask, then re-encodes
 * it in the Web Worker.
 *
 * The resampling maths lives in `src/components/panels/image-upscale-panel.ts`
 * (pure, unit-tested) and is shared by this worker and the on-page preview, so
 * the two always agree. There is deliberately no AI model: the browser-ready
 * super-resolution ONNX models are GPL-3.0 and this project only ships
 * permissively licensed code, so the enlargement is algorithmic instead.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  throwIfAborted,
} from './image-batch';
import {
  readUpscaleOptions,
  renderUpscale,
  upscaleTarget,
  type PixelBuffer,
} from '@/components/panels/image-upscale-panel';
import { meta } from './image-upscale.meta';

/** Label for the stats row: `2×`, `4×` or `150%`. */
function factorLabel(factor: number): string {
  if (factor === 2 || factor === 4) return `${factor}×`;
  return `${Math.round(factor * 100)}%`;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, false);
  // Validate the options first, so a typo fails before any image is decoded.
  const options = readUpscaleOptions(o);
  const mime = options.mime;
  const file = input.files[0]!;

  throwIfAborted(input.signal);
  input.onProgress?.(0.05, 'Decoding the image');
  const bitmap = await decodeOriented(file);
  try {
    assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
    const plan = upscaleTarget(bitmap.width, bitmap.height, options);
    // Fail before allocating anything: a 4× of a large photo is comfortably over
    // the browser's canvas budget, and the buffers below are sized from it.
    assertCanvasBudget(plan.width, plan.height, 'upscaled image');

    // Read the source pixels once. The scratch canvas is the source size; the
    // output canvas is the target size (createCanvas enforces the budget).
    const scratch = createCanvas(bitmap.width, bitmap.height, 'source image');
    const sourceContext = context2d(scratch);
    sourceContext.drawImage(bitmap, 0, 0);
    const sourceImage = sourceContext.getImageData(0, 0, bitmap.width, bitmap.height);
    const source: PixelBuffer = {
      data: sourceImage.data,
      width: bitmap.width,
      height: bitmap.height,
    };

    throwIfAborted(input.signal);
    input.onProgress?.(0.3, `Resampling to ${plan.width}×${plan.height}`);
    const out = renderUpscale(source, plan.width, plan.height, options);

    const canvas = createCanvas(plan.width, plan.height, 'upscaled image');
    const ctx = context2d(canvas);
    // `putImageData` writes whole pixels, so the JPEG flattening that RGB-only
    // encoders need is done in the buffer itself (see `renderUpscale`), not by
    // filling the canvas first — a fill would be overwritten here.
    const target = ctx.createImageData(plan.width, plan.height);
    target.data.set(out.data);
    ctx.putImageData(target, 0, 0);

    throwIfAborted(input.signal);
    input.onProgress?.(0.75, 'Encoding');
    const blob = await encodeCanvas(canvas, mime, options.quality);
    input.onProgress?.(1, 'Done');

    return {
      outputs: [
        { filename: `${stem(file.name)}-${plan.width}x${plan.height}.${extension(mime)}`, blob },
      ],
      notes: [
        'Enlarged by resampling — Lanczos3, bicubic or nearest interpolation plus an optional unsharp mask. No AI model is involved, so no detail is invented.',
        'The export is redrawn from pixels, so EXIF, GPS, XMP, the ICC profile and comments are dropped.',
      ],
      stats: {
        size: `${plan.width} × ${plan.height}`,
        factor: factorLabel(plan.factor),
        interpolation: options.kernel,
        sharpen: options.sharpen > 0 ? `${options.sharpen}%` : 'off',
        originalBytes: file.size,
        outputBytes: blob.size,
      },
    };
  } finally {
    bitmap.close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
