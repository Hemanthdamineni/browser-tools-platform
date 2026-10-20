import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { checkFiles, resolveBackground } from './common';
import {
  assertCanvasBudget,
  context2d,
  createCanvas,
  decodeOriented,
  encodeCanvas,
  throwIfAborted,
} from './image-batch';
import { zipSync } from 'fflate';
import { assertSafeSvg } from './svg-safety';
import { meta } from './favicon-generator.meta';

/**
 * Build a multi-image ICO file from PNG payloads and their pixel sizes.
 * Each PNG keeps its own directory entry so browsers can pick a size.
 */
export function icoEntries(pngs: Uint8Array[], sizes: number[]): Uint8Array {
  const header = new Uint8Array(6 + 16 * pngs.length);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // resource type: icon
  view.setUint16(4, pngs.length, true); // image count

  let offset = 6 + 16 * pngs.length;
  for (let i = 0; i < pngs.length; i++) {
    const entry = 16 * i + 6;
    view.setUint8(entry, sizes[i]!); // width
    view.setUint8(entry + 1, sizes[i]!); // height
    view.setUint8(entry + 2, 0); // palette colours
    view.setUint8(entry + 3, 0); // reserved
    view.setUint16(entry + 4, 1, true); // colour planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, pngs[i]!.length, true); // payload size
    view.setUint32(entry + 12, offset, true); // payload offset
    offset += pngs[i]!.length;
  }

  const out = new Uint8Array(offset);
  out.set(header, 0);
  let cursor = header.length;
  for (const png of pngs) {
    out.set(png, cursor);
    cursor += png.length;
  }
  return out;
}

/**
 * Fit `srcW × srcH` inside a square `size` canvas, preserving aspect ratio and
 * leaving `paddingPct`% of the edge free (used for maskable-icon safe zones).
 */
export function resizeMath(
  srcW: number,
  srcH: number,
  size: number,
  paddingPct: number,
): { x: number; y: number; w: number; h: number } {
  const pct = Number.isFinite(paddingPct) ? Math.min(45, Math.max(0, paddingPct)) : 0;
  const inner = size * (1 - (pct / 100) * 2);
  const scale = Math.min(inner / srcW, inner / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  return {
    x: Math.round((size - drawW) / 2),
    y: Math.round((size - drawH) / 2),
    w: drawW,
    h: drawH,
  };
}

/** Pixel size for each generated icon, used to build an accurate manifest. */
const ICON_SIZES: Record<string, number> = {
  'favicon-16.png': 16,
  'favicon-32.png': 32,
  'favicon-48.png': 48,
  'favicon-180.png': 180,
  'favicon-192.png': 192,
  'favicon-512.png': 512,
  'apple-touch-icon.png': 180,
  'icon-maskable-512.png': 512,
};

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  checkFiles(input.files);
  const file = input.files[0]!;
  throwIfAborted(input.signal);

  // A dropped logo may be an SVG; reject external references before decoding it.
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    assertSafeSvg(await file.text());
  }

  const background = resolveBackground(o.background);
  const paddingPct = Number(o.padding);
  const include512 = o.include512 !== false;

  input.onProgress?.(0, 'Decoding source image');
  const source = await decodeOriented(file);
  try {
    assertCanvasBudget(source.width, source.height, 'source image');

    const sizes = [16, 32, 48, 180, 192];
    if (include512) sizes.push(512);
    const total = sizes.length + 1; // + the maskable safe-zone render
    let done = 0;

    const render = async (size: number, padding: number, label: string): Promise<Uint8Array> => {
      throwIfAborted(input.signal);
      input.onProgress?.(done / total, label);
      const canvas = createCanvas(size, size, 'icon canvas');
      const ctx = context2d(canvas);
      if (background !== 'transparent') {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
      }
      const rect = resizeMath(source.width, source.height, size, padding);
      ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
      const blob = await encodeCanvas(canvas, 'image/png');
      done += 1;
      return new Uint8Array(await blob.arrayBuffer());
    };

    const icons: Record<string, Uint8Array> = {};
    for (const size of sizes) {
      icons[`favicon-${size}.png`] = await render(size, 0, `Rendering ${size}px icon`);
    }
    icons['apple-touch-icon.png'] = icons['favicon-180.png']!;
    // Android maskable icons keep a safe-zone border; padding only applies here.
    icons['icon-maskable-512.png'] = await render(512, paddingPct, 'Rendering maskable icon');

    throwIfAborted(input.signal);
    const ico = icoEntries(
      [icons['favicon-16.png']!, icons['favicon-32.png']!, icons['favicon-48.png']!],
      [16, 32, 48],
    );
    const zipBytes = zipSync({ ...icons, 'favicon.ico': ico });

    const html = [
      '<link rel="icon" href="/favicon.ico" sizes="32x32">',
      '<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
      '<link rel="manifest" href="/site.webmanifest">',
    ].join('\n');

    const manifest = JSON.stringify(
      {
        name: 'Web App',
        icons: Object.keys(icons)
          .map((name) => {
            const size = ICON_SIZES[name] ?? 32;
            return {
              src: `/${name}`,
              sizes: `${size}x${size}`,
              type: 'image/png',
              purpose: name.includes('maskable') ? 'maskable' : undefined,
            };
          })
          .concat([
            {
              src: '/favicon.ico',
              sizes: '32x32',
              type: 'image/x-icon',
              purpose: undefined,
            },
          ]),
      },
      null,
      2,
    );

    input.onProgress?.(1, 'Done');
    return {
      outputs: [
        { filename: 'favicons.zip', blob: new Blob([zipBytes], { type: 'application/zip' }) },
      ],
      report: { output: `${html}\n\n${manifest}`, render: 'code', language: 'html' },
      stats: { icons: Object.keys(icons).length + 1, zipBytes: zipBytes.length },
    };
  } finally {
    source.close();
  }
}

const tool: FileToolModule = { meta, run };
export default tool;
