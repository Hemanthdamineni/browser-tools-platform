import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles } from './common';
import { meta } from './image-spritesheet.meta';

type Box = { name: string; w: number; h: number };

export function layoutSprites(items: Box[], layout: string, columns: number, pad: number) {
  if (!items.length) throw new ToolError('Choose at least one image.');
  if (items.some((item) => !Number.isFinite(item.w) || !Number.isFinite(item.h) || item.w <= 0 || item.h <= 0)) {
    throw new ToolError('Each image must have positive finite dimensions.');
  }
  const padding = Number.isFinite(pad) && pad >= 0 ? Math.floor(pad) : 0;
  const columnCount = Number.isFinite(columns) && columns > 0
    ? Math.min(64, Math.floor(columns))
    : 0;
  const positions: { name: string; x: number; y: number; w: number; h: number }[] = [];
  let width = 0;
  let height = 0;

  if (layout === 'horizontal') {
    let x = 0;
    for (const item of items) {
      positions.push({ name: item.name, x, y: 0, w: item.w, h: item.h });
      x += item.w + padding;
      height = Math.max(height, item.h);
    }
    width = x - padding;
  } else if (layout === 'vertical') {
    let y = 0;
    for (const item of items) {
      positions.push({ name: item.name, x: 0, y, w: item.w, h: item.h });
      y += item.h + padding;
      width = Math.max(width, item.w);
    }
    height = y - padding;
  } else {
    // Preserve existing grid behavior. "packed" currently falls back to a square grid.
    const cols = layout === 'grid'
      ? Math.max(1, columnCount || Math.ceil(Math.sqrt(items.length)))
      : Math.max(1, Math.ceil(Math.sqrt(items.length)));
    const cellW = Math.max(...items.map((item) => item.w));
    const cellH = Math.max(...items.map((item) => item.h));
    items.forEach((item, i) => positions.push({
      name: item.name,
      x: (i % cols) * (cellW + padding),
      y: Math.floor(i / cols) * (cellH + padding),
      w: item.w,
      h: item.h,
    }));
    const usedColumns = Math.min(cols, items.length);
    width = usedColumns * cellW + (usedColumns - 1) * padding;
    height = Math.ceil(items.length / cols) * cellH + (Math.ceil(items.length / cols) - 1) * padding;
  }

  if (!Number.isSafeInteger(Math.ceil(width)) || !Number.isSafeInteger(Math.ceil(height)) || width > 32768 || height > 32768) {
    throw new ToolError('The sprite sheet dimensions are too large to render.');
  }
  return { positions, width, height };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  const bitmaps: ImageBitmap[] = [];
  try {
    for (let i = 0; i < input.files.length; i++) {
      checkAbort(input.signal);
      input.onProgress?.(i / input.files.length, `Decoding ${input.files[i]!.name}`);
      bitmaps.push(await decodeImage(input.files[i]!));
    }
    const rawPadding = Number(options.padding);
    const padding = Number.isFinite(rawPadding) && rawPadding >= 0 ? Math.min(4096, Math.floor(rawPadding)) : 0;
    const rawColumns = Number(options.columns);
    const columns = Number.isFinite(rawColumns) && rawColumns > 0 ? Math.min(64, Math.floor(rawColumns)) : 0;
    const boxes = bitmaps.map((bitmap, i) => ({
      name: input.files[i]!.name.replace(/\.[^.]*$/, ''),
      w: bitmap.width,
      h: bitmap.height,
    }));
    const layout = layoutSprites(boxes, String(options.layout), columns, padding);
    const canvas = canvasFor(layout.width, layout.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ToolError('Could not create a drawing context.');
    layout.positions.forEach((position, i) => ctx.drawImage(bitmaps[i]!, position.x, position.y));

    const format = options.format === 'webp' ? 'webp' : 'png';
    const mime = `image/${format}`;
    const blob = await canvas.convertToBlob({ type: mime });
    if (blob.type !== mime) throw new ToolError(`This browser cannot encode ${mime}.`);
    const json = JSON.stringify({ width: layout.width, height: layout.height, sprites: layout.positions }, null, 2);
    const css = layout.positions.map((position) =>
      `.sprite-${position.name.replace(/[^\w-]/g, '-')} { width: ${position.w}px; height: ${position.h}px; background-position: -${position.x}px -${position.y}px; }`,
    ).join('\n');
    input.onProgress?.(1, 'Done');
    return {
      outputs: [{ filename: `spritesheet.${format}`, blob }],
      report: { output: JSON.stringify({ headers: ['JSON', 'CSS'], rows: [[json, css]] }), render: 'table' },
      stats: { sprites: layout.positions.length, width: layout.width, height: layout.height },
    };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
