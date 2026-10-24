import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  flattenForJpeg,
  throwIfAborted,
} from './image-batch';
import {
  OUTPUT_FORMATS,
  drawCaption,
  planCaption,
  readTextOptions,
  type MeasureFn,
} from './image-add-text.core';
import { meta } from './image-add-text.meta';

/** Measure text the way the canvas will draw it: same font shorthand. */
function canvasMeasure(ctx: OffscreenCanvasRenderingContext2D): MeasureFn {
  return (text, fontPx, fontStack) => {
    ctx.font = `${fontPx}px ${fontStack}`;
    return ctx.measureText(text).width;
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, false);
  // Validate the caption first so a typo fails before the image is decoded.
  const options = readTextOptions(o);
  const mime = OUTPUT_FORMATS[String(o.format ?? 'png')];
  if (!mime) {
    throw new ToolError(
      `Unknown output format "${String(o.format ?? '')}".`,
      'Choose PNG, JPEG or WebP.',
    );
  }
  const file = input.files[0]!;
  throwIfAborted(input.signal);
  input.onProgress?.(0.05, 'Decoding the image');

  const bitmap = await decodeOriented(file);
  try {
    assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
    const canvas = createCanvas(bitmap.width, bitmap.height);
    const ctx = context2d(canvas);
    flattenForJpeg(ctx, mime, bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);

    const plan = planCaption(canvasMeasure(ctx), options, bitmap.width, bitmap.height);
    drawCaption(ctx, plan);

    throwIfAborted(input.signal);
    input.onProgress?.(0.6, 'Encoding');
    const blob = await encodeCanvas(canvas, mime);
    input.onProgress?.(1, 'Done');

    return {
      outputs: [{ filename: `${stem(file.name)}-text.${extension(mime)}`, blob }],
      stats: {
        size: `${bitmap.width} × ${bitmap.height}`,
        lines: plan.lines.length,
        'font size': `${Math.round(plan.fontPx)} px`,
        position: `${Math.round(options.x)}% / ${Math.round(options.y)}%`,
      },
    };
  } finally {
    bitmap.close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
