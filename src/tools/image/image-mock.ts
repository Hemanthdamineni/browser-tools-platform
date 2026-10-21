/**
 * Test-only fake browser image APIs — the single shared mock for the image
 * tools.
 *
 * jsdom has no `OffscreenCanvas` / `createImageBitmap`, so the image tools can
 * only be tested beyond their guards if we stand in for those. This module
 * installs controllable fakes and records the calls the tools make, so tests can
 * assert on EXIF-orientation requests, JPEG flattening, encode options **and the
 * actual pixels** that end up on (or come off) a canvas.
 *
 * The fake 2D context implements `fillRect`, `drawImage` (with source-over
 * compositing), `createImageData`, `getImageData` and `putImageData`, which
 * lets the pixel-based tools (favicon, diff, spritesheet, svg-to-png) assert
 * real output rather than only call shapes.
 *
 * Not a `.test.ts` / `.tool.ts` file, so vitest's glob and the registry both
 * ignore it in production builds.
 */

/** A 4-tuple of RGBA channel values (0–255). */
export type Rgba = [number, number, number, number];

export interface MockBitmap {
  width: number;
  height: number;
  options: ImageBitmapOptions | undefined;
  pixels: Uint8ClampedArray;
  closed: boolean;
  close(): void;
}

/** Snapshot of the 2D transform applied before a draw. */
export interface MockTransform {
  translate: [number, number];
  rotate: number;
  scale: [number, number];
}

export interface MockDrawCall {
  args: unknown[];
  destW?: number;
  destH?: number;
  /** Current transform state when `drawImage` was called. */
  transform?: MockTransform;
}

export interface MockFillCall {
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
}

export interface MockEncodeCall {
  type: string;
  quality?: number;
}

/** Parse the CSS colours the tools actually use: transparent, #rgb, #rrggbb, rgb()/rgba(). */
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

function solidPixels(width: number, height: number, color: Rgba): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(Math.max(0, width) * Math.max(0, height) * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3];
  }
  return pixels;
}

/** The slice of the 2D context surface the tools use, with real pixel output. */
export class MockContext2D {
  readonly canvas: MockCanvas;
  imageSmoothingEnabled = true;
  imageSmoothingQuality: ImageSmoothingQuality = 'high';
  private style = '#000000';
  private transform: MockTransform = { translate: [0, 0], rotate: 0, scale: [1, 1] };

  constructor(canvas: MockCanvas) {
    this.canvas = canvas;
  }

  get fillStyle(): string {
    return this.style;
  }

  set fillStyle(value: string) {
    this.style = String(value);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.canvas.fills.push({ x, y, w, h, style: this.style });
    const color = parseColor(this.style);
    if (color) this.canvas.writeRect(x, y, w, h, color);
  }

  translate(x: number, y: number): void {
    this.transform.translate = [x, y];
  }

  rotate(angle: number): void {
    this.transform.rotate = angle;
  }

  scale(x: number, y: number): void {
    this.transform.scale = [x, y];
  }

  drawImage(source: unknown, ...args: number[]): void {
    const tail = args.slice(-2).map(Number);
    const destW = Number.isFinite(tail[0]) ? tail[0] : undefined;
    const destH = Number.isFinite(tail[1]) ? tail[1] : undefined;
    this.canvas.draws.push({
      args: [source, ...args],
      destW,
      destH,
      transform: {
        translate: [...this.transform.translate],
        rotate: this.transform.rotate,
        scale: [...this.transform.scale],
      },
    });

    const bitmap = source as { width?: unknown; height?: unknown; pixels?: unknown };
    const sw = Math.max(1, Math.round(Number(bitmap.width) || 0));
    const sh = Math.max(1, Math.round(Number(bitmap.height) || 0));
    const sp = bitmap.pixels instanceof Uint8ClampedArray ? bitmap.pixels : null;
    if (!sp || bitmap.width === undefined) return;

    let sx = 0;
    let sy = 0;
    let sWidth = sw;
    let sHeight = sh;
    let dx = 0;
    let dy = 0;
    let dWidth = sw;
    let dHeight = sh;
    if (args.length >= 8) {
      [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight] = args as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
    } else if (args.length >= 4) {
      [dx, dy, dWidth, dHeight] = args as [number, number, number, number];
    } else {
      [dx, dy] = args as [number, number];
    }
    const outW = Math.max(1, Math.round(dWidth));
    const outH = Math.max(1, Math.round(dHeight));
    for (let y = 0; y < outH; y++) {
      const syp = Math.min(sh - 1, Math.floor(sy + ((y + 0.5) * sHeight) / outH));
      for (let x = 0; x < outW; x++) {
        const sxp = Math.min(sw - 1, Math.floor(sx + ((x + 0.5) * sWidth) / outW));
        const si = (Math.max(0, syp) * sw + Math.max(0, sxp)) * 4;
        this.canvas.blend(dx + x, dy + y, [sp[si]!, sp[si + 1]!, sp[si + 2]!, sp[si + 3]!]);
      }
    }
  }

  createImageData(width: number, height: number): ImageData {
    const w = Math.max(0, Math.round(width));
    const h = Math.max(0, Math.round(height));
    return {
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
      colorSpace: 'srgb',
    } as unknown as ImageData;
  }

  getImageData(x: number, y: number, width: number, height: number): ImageData {
    const canvas = this.canvas;
    const data = new Uint8ClampedArray(Math.max(0, width) * Math.max(0, height) * 4);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const px = x + col;
        const py = y + row;
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
        const si = (py * canvas.width + px) * 4;
        const di = (row * width + col) * 4;
        data[di] = canvas.pixels[si]!;
        data[di + 1] = canvas.pixels[si + 1]!;
        data[di + 2] = canvas.pixels[si + 2]!;
        data[di + 3] = canvas.pixels[si + 3]!;
      }
    }
    return { data, width, height } as unknown as ImageData;
  }

  putImageData(image: ImageData, x: number, y: number): void {
    const canvas = this.canvas;
    for (let row = 0; row < image.height; row++) {
      for (let col = 0; col < image.width; col++) {
        const px = x + col;
        const py = y + row;
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
        const si = (row * image.width + col) * 4;
        const di = (py * canvas.width + px) * 4;
        canvas.pixels[di] = image.data[si]!;
        canvas.pixels[di + 1] = image.data[si + 1]!;
        canvas.pixels[di + 2] = image.data[si + 2]!;
        canvas.pixels[di + 3] = image.data[si + 3]!;
      }
    }
  }
}

export class MockCanvas {
  width: number;
  height: number;
  draws: MockDrawCall[] = [];
  fills: MockFillCall[] = [];
  encodes: MockEncodeCall[] = [];
  encodeType: string | null;
  encodeSize: number;
  readonly pixels: Uint8ClampedArray;
  private readonly supports: string[];
  private readonly pixelOutput: boolean;
  private context: MockContext2D | null = null;

  constructor(
    width: number,
    height: number,
    supports: string[],
    encodeSize: number,
    pixelOutput = false,
    encodeType: string | null = null,
    pixels?: Uint8ClampedArray | number[],
  ) {
    this.width = Math.max(0, Math.round(width));
    this.height = Math.max(0, Math.round(height));
    this.supports = supports;
    this.encodeSize = encodeSize;
    this.pixelOutput = pixelOutput;
    this.encodeType = encodeType;
    this.pixels = pixels
      ? pixels instanceof Uint8ClampedArray
        ? pixels
        : Uint8ClampedArray.from(pixels)
      : new Uint8ClampedArray(this.width * this.height * 4);
  }

  getContext(kind: string): MockContext2D | null {
    if (kind !== '2d') return null;
    this.context ??= new MockContext2D(this);
    return this.context;
  }

  /** Source-over composite one pixel, so transparent draws reveal the backdrop. */
  blend(x: number, y: number, color: Rgba): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const sa = color[3] / 255;
    if (sa === 0) return;
    const i = (y * this.width + x) * 4;
    const data = this.pixels;
    if (sa === 1) {
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
      return;
    }
    const da = data[i + 3]! / 255;
    const outA = sa + da * (1 - sa);
    const channel = (sc: number, dc: number) =>
      outA === 0 ? 0 : Math.round((sc * sa + dc * da * (1 - sa)) / outA);
    data[i] = channel(color[0], data[i]!);
    data[i + 1] = channel(color[1], data[i + 1]!);
    data[i + 2] = channel(color[2], data[i + 2]!);
    data[i + 3] = Math.round(outA * 255);
  }

  writeRect(x: number, y: number, w: number, h: number, color: Rgba): void {
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) this.blend(x + col, y + row, color);
    }
  }

  async convertToBlob(opts?: { type?: string; quality?: number }): Promise<Blob> {
    const requested = opts?.type ?? 'image/png';
    this.encodes.push({ type: requested, quality: opts?.quality });
    const type = this.encodeType ?? (this.supports.includes(requested) ? requested : '');
    if (this.pixelOutput) return new Blob([this.pixels.slice()], { type });
    const size = Math.max(0, Math.round(this.encodeSize));
    return new Blob([new Uint8Array(size)], { type });
  }
}

export interface BitmapSpec {
  width: number;
  height: number;
  pixels?: Uint8ClampedArray;
}

export interface MockConfig {
  /** Dimensions of every decoded bitmap. */
  width?: number;
  height?: number;
  /** Per-decode dimensions consumed in order (overrides width/height). */
  dimensions?: { width: number; height: number }[];
  /** Solid colour for every decoded bitmap. */
  color?: Rgba;
  /** Per-decode solid colours consumed in order (overrides color). */
  colors?: Rgba[];
  /** Reject `createImageBitmap` when an options bag is passed (no EXIF support). */
  rejectOrientation?: boolean;
  /** Always reject `createImageBitmap` (invalid image bytes). */
  failDecode?: boolean;
  /** MIME types `convertToBlob` can encode; others return an empty type. */
  supports?: string[];
  /** Byte length of encoded blobs (ignored when `pixelOutput` is set). */
  encodeSize?: number;
  /** Fixed RGBA buffer used for decoded bitmaps and seeded canvases. */
  pixels?: number[] | Uint8ClampedArray;
  /** Make `convertToBlob` return the raw RGBA pixels instead of a sized stub. */
  pixelOutput?: boolean;
  /** Force the MIME type `convertToBlob` reports (simulates an unsupported encoder). */
  blobType?: string;
}

export interface MockHandle {
  bitmaps: MockBitmap[];
  canvases: MockCanvas[];
  /** Force the type `convertToBlob` reports, or `null` to clear. */
  setBlobType(type: string | null): void;
  /** Replace the bitmap decoder, or pass `null` to restore the default. */
  setDecoder(decoder: ((source: Blob) => BitmapSpec | Promise<BitmapSpec>) | null): void;
  restore(): void;
}

/** Read `width`/`height`/`viewBox` from SVG source text, mirroring the tool. */
async function svgSpec(source: Blob): Promise<BitmapSpec | null> {
  if (!source.type.includes('svg')) return null;
  let text = '';
  try {
    text = await source.text();
  } catch {
    return null;
  }
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

/**
 * Install the fakes on `globalThis` and return the recorded calls. Call
 * `restore()` in `afterEach`.
 */
export function installImageMock(config: MockConfig = {}): MockHandle {
  const originalCreate = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  const originalCanvas = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas');

  const supports = config.supports ?? ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
  const encodeSize = config.encodeSize ?? 4;
  const bitmaps: MockBitmap[] = [];
  const canvases: MockCanvas[] = [];
  let decodeIndex = 0;
  let blobTypeOverride = config.blobType ?? null;
  let decoderOverride: ((source: Blob) => BitmapSpec | Promise<BitmapSpec>) | null = null;

  const makeBitmap = (spec: BitmapSpec, options?: ImageBitmapOptions): MockBitmap => {
    const color = config.colors?.[decodeIndex] ?? config.color ?? ([0, 0, 0, 0] as Rgba);
    decodeIndex += 1;
    // Pixels are allocated on demand: a huge decode that the tool rejects on
    // size never touches them, so tests for the limit stay cheap.
    let stored: Uint8ClampedArray | null = spec.pixels ?? null;
    if (!stored && config.pixels) {
      stored =
        config.pixels instanceof Uint8ClampedArray
          ? config.pixels
          : Uint8ClampedArray.from(config.pixels);
    }
    const bitmap: MockBitmap = {
      width: spec.width,
      height: spec.height,
      options,
      get pixels(): Uint8ClampedArray {
        stored ??= solidPixels(spec.width, spec.height, color);
        return stored;
      },
      closed: false,
      close() {
        bitmap.closed = true;
      },
    };
    bitmaps.push(bitmap);
    return bitmap;
  };

  async function defaultSpec(source: Blob): Promise<BitmapSpec> {
    const dimension = config.dimensions?.[decodeIndex];
    if (dimension) return dimension;
    if (config.width !== undefined || config.height !== undefined) {
      return { width: config.width ?? 100, height: config.height ?? 100 };
    }
    return (await svgSpec(source)) ?? { width: 100, height: 100 };
  }

  async function fakeCreateImageBitmap(
    source: Blob,
    options?: ImageBitmapOptions,
  ): Promise<ImageBitmap> {
    if (config.failDecode) throw new Error('decode failed');
    if (options && config.rejectOrientation) throw new Error('options not supported');
    const spec = decoderOverride ? await decoderOverride(source) : await defaultSpec(source);
    return makeBitmap(spec, options) as unknown as ImageBitmap;
  }

  function FakeOffscreenCanvas(this: unknown, width: number, height: number) {
    const canvas = new MockCanvas(
      width,
      height,
      supports,
      encodeSize,
      config.pixelOutput ?? false,
      blobTypeOverride,
      config.pixels,
    );
    canvases.push(canvas);
    return canvas;
  }

  Object.defineProperty(globalThis, 'createImageBitmap', {
    value: fakeCreateImageBitmap,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    value: FakeOffscreenCanvas,
    configurable: true,
    writable: true,
  });

  return {
    bitmaps,
    canvases,
    setBlobType(type: string | null) {
      blobTypeOverride = type;
      for (const canvas of canvases) canvas.encodeType = type;
    },
    setDecoder(decoder) {
      decoderOverride = decoder;
    },
    restore() {
      if (originalCreate) Object.defineProperty(globalThis, 'createImageBitmap', originalCreate);
      else delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
      if (originalCanvas) Object.defineProperty(globalThis, 'OffscreenCanvas', originalCanvas);
      else delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    },
  };
}

/** Build a File with a real byte length so size comparisons are meaningful. */
export function makeFile(name: string, type = 'image/png', size = 200): File {
  return new File([new Uint8Array(size)], name, { type });
}

/** Build an SVG File whose text the fake decoder can measure. */
export function svgFile(name: string, markup: string): File {
  return new File([markup], name, { type: 'image/svg+xml' });
}

/** Read the raw RGBA bytes a pixel-output fake canvas encoded into `blob`. */
export async function blobPixels(blob: Blob): Promise<Uint8ClampedArray> {
  return new Uint8ClampedArray(await blob.arrayBuffer());
}

/** Read an RGBA pixel from a raw buffer produced by {@link blobPixels}. */
export function pixelAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): Rgba {
  const i = (y * width + x) * 4;
  return [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0, pixels[i + 3] ?? 0];
}
