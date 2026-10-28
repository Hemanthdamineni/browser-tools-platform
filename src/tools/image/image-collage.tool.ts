import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, extension, parseHexColor, resolveBackground, stem } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  flattenForJpeg,
  runBatch,
  throwIfAborted,
} from './image-batch';
import { meta } from './image-collage.meta';

type Box = { name: string; w: number; h: number };
type Position = { name: string; x: number; y: number; w: number; h: number };

/**
 * Compute collage layout: positions and overall canvas size.
 * Pure function so geometry can be unit-tested without a canvas.
 */
export function layoutCollage(
  items: Box[],
  columns: number,
  spacing: number,
): { positions: Position[]; width: number; height: number } {
  if (!items.length) throw new ToolError('Choose at least one image.');
  if (items.some((item) => !Number.isFinite(item.w) || !Number.isFinite(item.h) || item.w <= 0 || item.h <= 0)) {
    throw new ToolError('Each image must have positive finite dimensions.');
  }
  const gap = Number.isFinite(spacing) && spacing >= 0 ? Math.floor(spacing) : 0;
  const colCount = Number.isFinite(columns) && columns > 0 ? Math.min(16, Math.floor(columns)) : 0;

  const cols = Math.max(1, colCount || Math.ceil(Math.sqrt(items.length)));
  const cellW = Math.max(...items.map((item) => item.w));
  const cellH = Math.max(...items.map((item) => item.h));

  const positions = items.map((item, i) => ({
    name: item.name,
    x: (i % cols) * (cellW + gap),
    y: Math.floor(i / cols) * (cellH + gap),
    w: item.w,
    h: item.h,
  }));

  const rows = Math.ceil(items.length / cols);
  const usedColumns = Math.min(cols, items.length);
  const width = usedColumns * cellW + (usedColumns - 1) * gap;
  const height = rows * cellH + (rows - 1) * gap;

  assertCanvasBudget(width, height, 'collage');
  return { positions, width, height };
}

/**
 * Compute the source and destination rectangles for drawing an image into a cell
 * based on aspect handling mode ('fit' = letterbox, 'crop' = fill).
 */
 export function computeDrawRect(
  srcW: number,
  srcH: number,
  cellW: number,
  cellH: number,
  mode: 'fit' | 'crop',
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const srcAspect = srcW / srcH;
  const cellAspect = cellW / cellH;

  if (mode === 'fit') {
    // Letterbox: scale to fit entirely within cell, centered
    if (srcAspect > cellAspect) {
      // Source is wider - fit to width
      const scale = cellW / srcW;
      const dw = cellW;
      const dh = srcH * scale;
      return {
        sx: 0,
        sy: 0,
        sw: srcW,
        sh: srcH,
        dx: 0,
        dy: (cellH - dh) / 2,
        dw,
        dh,
      };
    } else {
      // Source is taller - fit to height
      const scale = cellH / srcH;
      const dw = srcW * scale;
      const dh = cellH;
      return {
        sx: 0,
        sy: 0,
        sw: srcW,
        sh: srcH,
        dx: (cellW - dw) / 2,
        dy: 0,
        dw,
        dh,
      };
    }
  } else {
    // Crop: scale to fill cell completely, centered
    if (srcAspect > cellAspect) {
      // Source is wider - crop sides
      const scale = cellH / srcH;
      const sw = cellW / scale;
      return {
        sx: (srcW - sw) / 2,
        sy: 0,
        sw,
        sh: srcH,
        dx: 0,
        dy: 0,
        dw: cellW,
        dh: cellH,
      };
    } else {
      // Source is taller - crop top/bottom
      const scale = cellW / srcW;
      const sh = cellH / scale;
      return {
        sx: 0,
        sy: (srcH - sh) / 2,
        sw: srcW,
        sh,
        dx: 0,
        dy: 0,
        dw: cellW,
        dh: cellH,
      };
    }
  }
}

function validateBackground(value: unknown): string {
  const raw = String(value ?? 'transparent').trim();
  if (raw === 'transparent') return raw;
  const rgb = parseHexColor(raw);
  if (!rgb) {
    throw new ToolError('Enter "transparent" or a hex colour such as #ffffff.', 'Use a 3- or 6-digit hex value.');
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files, true);
  throwIfAborted(input.signal);

  // Read all images first to get dimensions
  const bitmaps = await Promise.all(input.files.map((f) => decodeOriented(f)));
  try {
    // Check source bitmap budget to prevent tab crashes
    for (const bmp of bitmaps) {
      assertCanvasBudget(bmp.width, bmp.height, 'source image');
    }

    const items: Box[] = bitmaps.map((b, i) => ({
      name: stem(input.files[i].name),
      w: b.width,
      h: b.height,
    }));

    const columns = Math.min(16, Math.max(0, Number(o.columns) || 0));
    const spacing = Math.max(0, Math.floor(Number(o.spacing) || 4));
    const aspectMode = String(o.aspect ?? 'fit') as 'fit' | 'crop';
    const format = String(o.format ?? 'png');
    const targetMime = format === 'original' ? 'image/png' : `image/${format}`;
    const quality = Math.min(100, Math.max(10, Number(o.quality) || 90)) / 100;

    // Compute layout
    const { positions, width, height } = layoutCollage(items, columns, spacing);
    const cellW = Math.max(...items.map((item) => item.w));
    const cellH = Math.max(...items.map((item) => item.h));
    // Validate background
    const background = validateBackground(o.background);
    const needsFlatten = targetMime === 'image/jpeg' && background !== 'transparent';

    const canvas = createCanvas(width, height);
    const ctx = context2d(canvas);

    // Fill background if needed
    if (background !== 'transparent') {
      const rgb = parseHexColor(background.replace('rgb(', '').replace(')', ''));
      if (rgb) {
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      } else {
        ctx.fillStyle = background;
      }
      ctx.fillRect(0, 0, width, height);
    }

    // Draw each image into its cell
    for (let i = 0; i < bitmaps.length; i++) {
      const bitmap = bitmaps[i];
      const pos = positions[i];

      // Calculate cell boundaries
      const cellX = pos.x;
      const cellY = pos.y;

      // Compute draw rect
      const rect = computeDrawRect(bitmap.width, bitmap.height, cellW, cellH, aspectMode);

      // Save context, translate to cell position, draw
      ctx.save();
      ctx.translate(cellX, cellY);

      if (needsFlatten) {
        flattenForJpeg(ctx, targetMime, cellW, cellH, background);
      }

      ctx.drawImage(bitmap, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);
      ctx.restore();
    }

    const blob = await encodeCanvas(canvas, targetMime, quality);
    const filename = `collage.${extension(targetMime)}`;

    return { outputs: [{ filename, blob }], stats: { files: 1, originalBytes: input.files.reduce((a, f) => a + f.size, 0), outputBytes: blob.size, format: targetMime } };
  } finally {
    bitmaps.forEach((b) => b.close());
  }
}

const tool: FileToolModule = { meta, run };
export default tool;