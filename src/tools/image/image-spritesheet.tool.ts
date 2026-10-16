import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { canvasFor, decodeImage } from '@/lib/image';
import { checkAbort, checkFiles } from './common';
import { meta } from './image-spritesheet.meta';

type Box = { name: string; w: number; h: number };
type Position = { name: string; x: number; y: number; w: number; h: number };

/** Largest sheet edge a browser canvas can be relied on to allocate. */
const MAX_DIMENSION = 32768;

/**
 * Shelf-pack sprites into rows. Items are ordered tallest-first and wrapped at a
 * target width derived from the total area, which keeps the sheet roughly square
 * while avoiding the wasted space of a uniform grid.
 */
function packSprites(items: Box[], padding: number) {
  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.h - a.item.h || b.item.w - a.item.w || a.index - b.index);
  const area = items.reduce((sum, item) => sum + (item.w + padding) * (item.h + padding), 0);
  const widest = Math.max(...items.map((item) => item.w));
  const target = Math.max(widest, Math.round(Math.sqrt(area)));

  const positions = new Array<Position>(items.length);
  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  let width = 0;
  for (const { item, index } of order) {
    if (x > 0 && x + item.w > target) {
      y += shelfHeight + padding;
      x = 0;
      shelfHeight = 0;
    }
    positions[index] = { name: item.name, x, y, w: item.w, h: item.h };
    x += item.w + padding;
    shelfHeight = Math.max(shelfHeight, item.h);
    width = Math.max(width, x - padding);
  }
  return { positions, width, height: y + shelfHeight };
}

/**
 * Compute sprite positions and the sheet size for a layout. Pure and exported so
 * the geometry can be unit-tested without a canvas.
 */
export function layoutSprites(items: Box[], layout: string, columns: number, pad: number) {
  if (!items.length) throw new ToolError('Choose at least one image.');
  if (
    items.some(
      (item) => !Number.isFinite(item.w) || !Number.isFinite(item.h) || item.w <= 0 || item.h <= 0,
    )
  ) {
    throw new ToolError('Each image must have positive finite dimensions.');
  }
  const padding = Number.isFinite(pad) && pad >= 0 ? Math.floor(pad) : 0;
  const columnCount =
    Number.isFinite(columns) && columns > 0 ? Math.min(64, Math.floor(columns)) : 0;

  let positions: Position[];
  let width: number;
  let height: number;

  if (layout === 'horizontal') {
    let x = 0;
    let tallest = 0;
    positions = items.map((item) => {
      const position = { name: item.name, x, y: 0, w: item.w, h: item.h };
      x += item.w + padding;
      tallest = Math.max(tallest, item.h);
      return position;
    });
    width = x - padding;
    height = tallest;
  } else if (layout === 'vertical') {
    let y = 0;
    let widest = 0;
    positions = items.map((item) => {
      const position = { name: item.name, x: 0, y, w: item.w, h: item.h };
      y += item.h + padding;
      widest = Math.max(widest, item.w);
      return position;
    });
    width = widest;
    height = y - padding;
  } else if (layout === 'packed') {
    ({ positions, width, height } = packSprites(items, padding));
  } else {
    const cols = Math.max(1, columnCount || Math.ceil(Math.sqrt(items.length)));
    const cellW = Math.max(...items.map((item) => item.w));
    const cellH = Math.max(...items.map((item) => item.h));
    positions = items.map((item, i) => ({
      name: item.name,
      x: (i % cols) * (cellW + padding),
      y: Math.floor(i / cols) * (cellH + padding),
      w: item.w,
      h: item.h,
    }));
    const usedColumns = Math.min(cols, items.length);
    const rows = Math.ceil(items.length / cols);
    width = usedColumns * cellW + (usedColumns - 1) * padding;
    height = rows * cellH + (rows - 1) * padding;
  }

  if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ToolError('The sprite sheet dimensions are too large to render.');
  }
  return { positions, width, height };
}

/** Turn a file name into a unique, CSS-safe sprite name. */
function spriteName(file: File, index: number, used: Map<string, number>): string {
  const base = file.name.replace(/\.[^.]*$/, '') || `sprite-${index + 1}`;
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  checkFiles(input.files, true);

  const bitmaps: ImageBitmap[] = [];
  try {
    const boxes: Box[] = [];
    const usedNames = new Map<string, number>();
    for (let i = 0; i < input.files.length; i++) {
      checkAbort(input.signal);
      input.onProgress?.(i / input.files.length, `Decoding ${input.files[i]!.name}`);
      const bitmap = await decodeImage(input.files[i]!);
      bitmaps.push(bitmap);
      boxes.push({
        name: spriteName(input.files[i]!, i, usedNames),
        w: bitmap.width,
        h: bitmap.height,
      });
    }

    const layout = layoutSprites(
      boxes,
      String(options.layout),
      Number(options.columns),
      Number(options.padding),
    );
    const canvas = canvasFor(layout.width, layout.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ToolError('Could not create a drawing context.');
    layout.positions.forEach((position, i) => ctx.drawImage(bitmaps[i]!, position.x, position.y));

    const format = options.format === 'webp' ? 'webp' : 'png';
    const mime = `image/${format}`;
    const blob = await canvas.convertToBlob({ type: mime });
    if (blob.type !== mime) throw new ToolError(`This browser cannot encode ${mime}.`);

    const json = JSON.stringify(
      { width: layout.width, height: layout.height, sprites: layout.positions },
      null,
      2,
    );
    const css = layout.positions
      .map(
        (position) =>
          `.sprite-${position.name.replace(/[^\w-]/g, '-')} { width: ${position.w}px; height: ${position.h}px; background-position: -${position.x}px -${position.y}px; }`,
      )
      .join('\n');

    input.onProgress?.(1, 'Done');
    return {
      outputs: [{ filename: `spritesheet.${format}`, blob }],
      report: {
        output: JSON.stringify({ headers: ['JSON', 'CSS'], rows: [[json, css]] }),
        render: 'table',
      },
      stats: { sprites: layout.positions.length, width: layout.width, height: layout.height },
    };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
