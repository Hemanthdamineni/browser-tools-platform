import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension } from './common';
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
  collageCanvas,
  drawCell,
  fitRect,
  gridCells,
  parseOrder,
  readCollageOptions,
} from './image-collage.core';
import { meta } from './image-collage.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const bitmaps: ImageBitmap[] = [];
  let cellSize = 0;
  try {
    await runBatch(input.files, input, 'Decoding', async (file) => {
      const bitmap = await decodeOriented(file);
      assertCanvasBudget(bitmap.width, bitmap.height, `image “${file.name}”`);
      bitmaps.push(bitmap);
      // The largest source edge sizes every cell, so nothing is ever upscaled.
      cellSize = Math.max(cellSize, bitmap.width, bitmap.height);
    });

    const count = bitmaps.length;
    const options = readCollageOptions(o, count);
    const mime = `image/${options.format}`;
    const size = collageCanvas(count, options.columns, options.spacing, cellSize);
    assertCanvasBudget(size.width, size.height, 'collage');

    const { cells } = gridCells(count, options.columns, options.spacing, size.width, size.height);
    const order = parseOrder(o.order, count);

    input.onProgress?.(0.9, 'Composing the collage');
    const canvas = createCanvas(size.width, size.height, 'collage');
    const ctx = context2d(canvas);
    if (options.background !== 'transparent') {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, size.width, size.height);
    } else {
      // JPEG has no alpha channel: a transparent background is flattened white.
      flattenForJpeg(ctx, mime, size.width, size.height, '#ffffff');
    }

    for (let i = 0; i < count; i++) {
      const bitmap = bitmaps[order[i]!]!;
      const cell = cells[i]!;
      drawCell(ctx, bitmap, cell, fitRect(cell, bitmap.width, bitmap.height), options);
    }

    const blob = await encodeCanvas(
      canvas,
      mime,
      mime === 'image/jpeg' ? options.quality / 100 : undefined,
    );
    input.onProgress?.(1, 'Done');

    return {
      outputs: [{ filename: `collage.${extension(mime)}`, blob }],
      stats: {
        images: count,
        columns: options.columns,
        width: size.width,
        height: size.height,
      },
    };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

const tool: FileToolModule = { meta, run };
export default tool;