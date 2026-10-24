import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, outputMime, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  flattenForJpeg,
  runBatch,
} from './image-batch';
import {
  computeLayout,
  dataUrlToBlob,
  drawWatermark,
  fontSpec,
  resolveWatermarkSettings,
  textFontPx,
} from './image-watermark.core';
import { meta } from './image-watermark.meta';

/**
 * Decode the logo once, before the batch, so a broken logo fails fast with a
 * message about the logo instead of one about "the file".
 */
async function decodeLogo(dataUrl: string): Promise<ImageBitmap> {
  const blob = dataUrlToBlob(dataUrl);
  try {
    return await decodeOriented(blob);
  } catch {
    throw new ToolError(
      'The logo image could not be decoded.',
      'Choose a PNG, JPEG or SVG file — SVG logos work best under 1 MB.',
    );
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  // Validate every option before touching a single pixel so a bad value fails
  // fast, with nothing decoded and no half-written output.
  const settings = resolveWatermarkSettings(o);
  const logo = settings.mode === 'logo' ? await decodeLogo(settings.logo) : null;

  try {
    const outputs = await runBatch(
      input.files,
      input,
      'Watermarking',
      async (file): Promise<FileRunResult['outputs'][number]> => {
        const bitmap = await decodeOriented(file);
        try {
          assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
          const mime = outputMime(o.format, file.type);
          const canvas = createCanvas(bitmap.width, bitmap.height);
          const ctx = context2d(canvas);

          // JPEG has no alpha channel: flatten transparency onto white before
          // anything is drawn, so the result never ends up black.
          flattenForJpeg(ctx, mime, bitmap.width, bitmap.height);
          ctx.drawImage(bitmap, 0, 0);

          // Text is measured with the real font so the mark lands exactly where
          // the layout says; the pure layout falls back to an estimate.
          let textWidth: number | undefined;
          if (settings.mode === 'text') {
            ctx.font = fontSpec(textFontPx(settings, bitmap.width, bitmap.height));
            textWidth = ctx.measureText(settings.text).width;
          }

          const layout = computeLayout({
            settings,
            imageWidth: bitmap.width,
            imageHeight: bitmap.height,
            textWidth,
            logoWidth: logo?.width,
            logoHeight: logo?.height,
          });
          drawWatermark(ctx, layout, settings, logo, input.signal);

          const blob = await encodeCanvas(canvas, mime);
          return { filename: `${stem(file.name)}-watermarked.${extension(mime)}`, blob };
        } finally {
          bitmap.close();
        }
      },
    );

    return { outputs, stats: { files: outputs.length } };
  } finally {
    logo?.close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
