/**
 * Test-only fake browser image APIs.
 *
 * jsdom has no `OffscreenCanvas` / `createImageBitmap`, so the image tools can
 * only be tested beyond their guards if we stand in for those. This module
 * installs controllable fakes and records the calls the tools make, so tests can
 * assert on EXIF-orientation requests, JPEG flattening and encode options.
 *
 * Not a `.test.ts` / `.tool.ts` file, so vitest's glob and the registry both
 * ignore it in production builds.
 */

export interface MockBitmap {
  width: number;
  height: number;
  options: ImageBitmapOptions | undefined;
  closed: boolean;
  close(): void;
}

export interface MockDrawCall {
  args: unknown[];
  destW?: number;
  destH?: number;
}

export interface MockFillCall {
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
}

export class MockCanvas {
  width: number;
  height: number;
  draws: MockDrawCall[] = [];
  fills: MockFillCall[] = [];
  encodes: { type: string; quality?: number }[] = [];
  encodeType: string | null = null;
  encodeSize: number;
  private readonly supports: string[];

  constructor(width: number, height: number, supports: string[], encodeSize: number) {
    this.width = width;
    this.height = height;
    this.supports = supports;
    this.encodeSize = encodeSize;
  }

  getContext(_kind: string): unknown {
    let fillStyle = '#000000';
    return {
      canvas: this,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      get fillStyle() {
        return fillStyle;
      },
      set fillStyle(value: string) {
        fillStyle = value;
      },
      fillRect: (x: number, y: number, w: number, h: number) => {
        this.fills.push({ x, y, w, h, style: String(fillStyle) });
      },
      drawImage: (...args: unknown[]) => {
        const tail = args.slice(-2).map(Number);
        const destW = Number.isFinite(tail[0]) ? tail[0] : undefined;
        const destH = Number.isFinite(tail[1]) ? tail[1] : undefined;
        this.draws.push({ args, destW, destH });
      },
    };
  }

  async convertToBlob(opts?: { type?: string; quality?: number }): Promise<Blob> {
    const requested = opts?.type ?? 'image/png';
    this.encodes.push({ type: requested, quality: opts?.quality });
    const type = this.encodeType ?? (this.supports.includes(requested) ? requested : '');
    const size = Math.max(0, Math.round(this.encodeSize));
    return new Blob([new Uint8Array(size)], { type });
  }
}

export interface MockConfig {
  /** Dimensions of the decoded bitmap. */
  width?: number;
  height?: number;
  /** Per-decode dimensions consumed in order (overrides width/height). */
  dimensions?: { width: number; height: number }[];
  /** Reject `createImageBitmap` when an options bag is passed (no EXIF support). */
  rejectOrientation?: boolean;
  /** Always reject `createImageBitmap` (invalid image bytes). */
  failDecode?: boolean;
  /** MIME types `convertToBlob` can encode; others return an empty type. */
  supports?: string[];
  /** Byte length of encoded blobs. */
  encodeSize?: number;
}

export interface MockHandle {
  bitmaps: MockBitmap[];
  canvases: MockCanvas[];
  restore(): void;
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

  const makeBitmap = (options?: ImageBitmapOptions): MockBitmap => {
    const next = config.dimensions?.[decodeIndex];
    decodeIndex += 1;
    const bitmap: MockBitmap = {
      width: next?.width ?? config.width ?? 100,
      height: next?.height ?? config.height ?? 100,
      options,
      closed: false,
      close() {
        bitmap.closed = true;
      },
    };
    bitmaps.push(bitmap);
    return bitmap;
  };

  function fakeCreateImageBitmap(_source: unknown, options?: ImageBitmapOptions): Promise<ImageBitmap> {
    if (config.failDecode) return Promise.reject(new Error('decode failed'));
    if (options && config.rejectOrientation) return Promise.reject(new Error('options not supported'));
    return Promise.resolve(makeBitmap(options) as unknown as ImageBitmap);
  }

  function FakeOffscreenCanvas(this: MockCanvas, width: number, height: number) {
    const canvas = new MockCanvas(width, height, supports, encodeSize);
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
