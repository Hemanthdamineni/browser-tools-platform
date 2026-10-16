/**
 * In-memory stand-ins for `OffscreenCanvas` and `createImageBitmap`, used by the
 * image tool unit tests so the full `run()` happy path can be exercised without
 * a real browser.
 *
 * This module lives in `src/` so TypeScript still type-checks it, but it is only
 * imported from `*.test.ts` files, so it is never part of the production bundle
 * (the registry only eagerly loads `*.meta.ts` and lazily loads `*.tool.ts`).
 */

export interface BitmapSpec {
  width: number;
  height: number;
  /** Row-major RGBA bytes. Defaults to fully transparent. */
  pixels?: Uint8ClampedArray;
}

/** A 4-tuple of RGBA channel values (0–255). */
export type Rgba = [number, number, number, number];

type Drawable = {
  width: number;
  height: number;
  pixels?: Uint8ClampedArray;
  _pixels?: Uint8ClampedArray;
};

const specBySource = new WeakMap<Blob, BitmapSpec>();

let saved = false;
let active = false;
let hadCanvas = false;
let hadBitmap = false;
let originalCanvas: unknown;
let originalBitmap: unknown;
let blobTypeOverride: string | null = null;
let decoderOverride: ((source: Blob) => BitmapSpec | Promise<BitmapSpec>) | null = null;

function toSize(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function parseColor(css: string): Rgba | null {
  const value = css.trim().toLowerCase();
  if (value === 'transparent') return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex) {
    const digits = hex[1]!;
    const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      255,
    ];
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1]!.split(',').map((part) => Number.parseFloat(part.trim()));
    const alpha = parts.length > 3 ? parts[3]! : 1;
    return [
      parts[0] ?? 0,
      parts[1] ?? 0,
      parts[2] ?? 0,
      Math.round(Math.min(1, Math.max(0, alpha)) * 255),
    ];
  }
  return null;
}

class FakeImageBitmap implements Drawable {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;

  constructor(width: number, height: number, pixels?: Uint8ClampedArray) {
    this.width = Math.max(1, toSize(width));
    this.height = Math.max(1, toSize(height));
    this.pixels = pixels ?? new Uint8ClampedArray(this.width * this.height * 4);
  }

  close(): void {
    /* nothing to release in the fake */
  }
}

class FakeContext2D {
  fillStyle = '#000000';
  readonly canvas: FakeOffscreenCanvas;

  constructor(canvas: FakeOffscreenCanvas) {
    this.canvas = canvas;
  }

  private writePixel(x: number, y: number, color: Rgba): void {
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    const i = (y * this.canvas.width + x) * 4;
    const data = this.canvas.pixels;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    const color = parseColor(this.fillStyle);
    if (!color) return;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) this.writePixel(x + col, y + row, color);
    }
  }

  drawImage(source: unknown, dx = 0, dy = 0, dWidth?: number, dHeight?: number): void {
    const src = source as Drawable;
    const sw = Math.max(1, src.width);
    const sh = Math.max(1, src.height);
    const sp = src.pixels ?? src._pixels ?? new Uint8ClampedArray(sw * sh * 4);
    const tw = Math.max(1, Math.round(dWidth ?? sw));
    const th = Math.max(1, Math.round(dHeight ?? sh));
    for (let y = 0; y < th; y++) {
      const sy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / th));
      for (let x = 0; x < tw; x++) {
        const sx = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / tw));
        const si = (sy * sw + sx) * 4;
        this.blend(dx + x, dy + y, [sp[si]!, sp[si + 1]!, sp[si + 2]!, sp[si + 3]!]);
      }
    }
  }

  /** Source-over compositing so transparent pixels leave the backdrop intact. */
  private blend(x: number, y: number, color: Rgba): void {
    const sa = color[3] / 255;
    if (sa === 0) return;
    if (sa === 1) {
      this.writePixel(x, y, color);
      return;
    }
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    const i = (y * this.canvas.width + x) * 4;
    const data = this.canvas.pixels;
    const da = data[i + 3]! / 255;
    const outA = sa + da * (1 - sa);
    const channel = (sc: number, dc: number) =>
      outA === 0 ? 0 : Math.round((sc * sa + dc * da * (1 - sa)) / outA);
    data[i] = channel(color[0], data[i]!);
    data[i + 1] = channel(color[1], data[i + 1]!);
    data[i + 2] = channel(color[2], data[i + 2]!);
    data[i + 3] = Math.round(outA * 255);
  }

  getImageData(x: number, y: number, width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const sx = x + col;
        const sy = y + row;
        if (sx < 0 || sy < 0 || sx >= this.canvas.width || sy >= this.canvas.height) continue;
        const si = (sy * this.canvas.width + sx) * 4;
        const di = (row * width + col) * 4;
        data[di] = this.canvas.pixels[si]!;
        data[di + 1] = this.canvas.pixels[si + 1]!;
        data[di + 2] = this.canvas.pixels[si + 2]!;
        data[di + 3] = this.canvas.pixels[si + 3]!;
      }
    }
    return { data, width, height } as unknown as ImageData;
  }

  putImageData(image: ImageData, x: number, y: number): void {
    for (let row = 0; row < image.height; row++) {
      for (let col = 0; col < image.width; col++) {
        const dx = x + col;
        const dy = y + row;
        if (dx < 0 || dy < 0 || dx >= this.canvas.width || dy >= this.canvas.height) continue;
        const si = (row * image.width + col) * 4;
        const di = (dy * this.canvas.width + dx) * 4;
        this.canvas.pixels[di] = image.data[si]!;
        this.canvas.pixels[di + 1] = image.data[si + 1]!;
        this.canvas.pixels[di + 2] = image.data[si + 2]!;
        this.canvas.pixels[di + 3] = image.data[si + 3]!;
      }
    }
  }
}

class FakeOffscreenCanvas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
  private context: FakeContext2D | null = null;

  constructor(width: number, height: number) {
    this.width = toSize(width);
    this.height = toSize(height);
    this.pixels = new Uint8ClampedArray(this.width * this.height * 4);
  }

  getContext(type: string): FakeContext2D | null {
    if (type !== '2d') return null;
    this.context ??= new FakeContext2D(this);
    return this.context;
  }

  async convertToBlob(options: { type?: string } = {}): Promise<Blob> {
    const type = blobTypeOverride ?? options.type ?? 'image/png';
    return new Blob([this.pixels.slice()], { type });
  }
}

function parseSvgSizes(text: string): BitmapSpec | null {
  const root = /<svg\b([^>]*)>/i.exec(text)?.[1];
  if (root === undefined) return null;
  const read = (key: string) => {
    const match = new RegExp(`\\b${key}\\s*=\\s*["']([0-9.]+)(?:px)?["']`, 'i').exec(root);
    return match ? Number(match[1]) : 0;
  };
  let width = read('width');
  let height = read('height');
  if (!width || !height) {
    const viewBox = /\bviewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(
      root,
    );
    if (viewBox) {
      width = width || Number(viewBox[1]);
      height = height || Number(viewBox[2]);
    }
  }
  if (!width || !height) return null;
  return { width, height };
}

async function defaultDecode(source: Blob): Promise<BitmapSpec> {
  const known = specBySource.get(source);
  if (known) return known;
  let text = '';
  try {
    text = await source.text();
  } catch {
    text = '';
  }
  const spec = parseSvgSizes(text);
  if (spec) return spec;
  throw new Error('No fake bitmap registered for this source.');
}

function saveOriginals(): void {
  if (saved) return;
  saved = true;
  hadCanvas = 'OffscreenCanvas' in globalThis;
  originalCanvas = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
  hadBitmap = 'createImageBitmap' in globalThis;
  originalBitmap = (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
}

/** Install the fake canvas + bitmap decoder globals. */
export function installFakeImageEnv(): void {
  saveOriginals();
  active = true;
  (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = FakeOffscreenCanvas;
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = async (source: Blob) => {
    const spec = decoderOverride ? await decoderOverride(source) : await defaultDecode(source);
    return new FakeImageBitmap(spec.width, spec.height, spec.pixels);
  };
}

/** Restore the original globals and clear any per-test overrides. */
export function resetFakeImageEnv(): void {
  if (active) {
    active = false;
    if (hadCanvas) (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = originalCanvas;
    else delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    if (hadBitmap)
      (globalThis as { createImageBitmap?: unknown }).createImageBitmap = originalBitmap;
    else delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
  }
  blobTypeOverride = null;
  decoderOverride = null;
}

/** Force `convertToBlob()` to report an encoder MIME type (for unsupported-encoder tests). */
export function setFakeBlobType(type: string | null): void {
  blobTypeOverride = type;
}

/** Replace the bitmap decoder (for decode-failure tests). */
export function setFakeDecoder(
  decoder: ((source: Blob) => BitmapSpec | Promise<BitmapSpec>) | null,
): void {
  decoderOverride = decoder;
}

/** Build a solid-colour RGBA pixel buffer. */
export function solidImage(width: number, height: number, rgba: Rgba): BitmapSpec {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = rgba[0];
    pixels[i * 4 + 1] = rgba[1];
    pixels[i * 4 + 2] = rgba[2];
    pixels[i * 4 + 3] = rgba[3];
  }
  return { width, height, pixels };
}

/** Create an image File that the fake decoder resolves to `spec`. */
export function imageFile(name: string, spec: BitmapSpec, type = 'image/png'): File {
  const bytes = new Uint8Array(Math.max(1, spec.width * spec.height * 4));
  const file = new File([bytes], name, { type });
  specBySource.set(file, spec);
  return file;
}

/** Create an SVG File whose text is parsed for intrinsic dimensions. */
export function svgFile(name: string, markup: string): File {
  return new File([markup], name, { type: 'image/svg+xml' });
}

/** Read the raw RGBA bytes a fake canvas encoded into `blob`. */
export async function blobPixels(blob: Blob): Promise<Uint8ClampedArray> {
  return new Uint8ClampedArray(await blob.arrayBuffer());
}

/** Read an RGBA pixel from a raw buffer produced by {@link blobPixels}. */
export function pixelAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): Rgba {
  const i = (y * width + x) * 4;
  return [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0, pixels[i + 3] ?? 0];
}
