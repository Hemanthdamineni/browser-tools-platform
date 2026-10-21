/**
 * Test-only canvas fakes for the signature module.
 *
 * jsdom has no 2D canvas implementation, so the signature sources are tested
 * against a fake that behaves like a real one where it matters:
 *
 * - strokes and text really paint pixels (so trimming finds the ink),
 * - `toDataURL()` returns a **genuine** PNG, so a drawn signature can be
 *   embedded by pdf-lib in a round-trip test.
 *
 * Nothing here ships: it lives in `test/` and is only imported by unit tests.
 */
import { deflateSync } from 'node:zlib';

/* -------------------------------------------------------------------------- */
/*  PNG encoding                                                              */
/* -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcInput = out.subarray(4, 8 + data.length);
  view.setUint32(8 + data.length, crc32(crcInput));
  return out;
}

/** Encode raw RGBA pixels into a real 8-bit RGBA PNG. */
export function encodePng(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width * 4; x++) {
      raw[rowStart + 1 + x] = pixels[y * width * 4 + x] ?? 0;
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

/* -------------------------------------------------------------------------- */
/*  Fake 2D context                                                           */
/* -------------------------------------------------------------------------- */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** The drawing surface a context paints on. */
export interface CanvasSurface {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

/** Parse the CSS colours the fakes use. */
function parseColor(css: string): Rgba {
  const value = String(css).trim().toLowerCase();
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex) {
    const digits = hex[1]!;
    const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 255,
    };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1]!.split(',').map((part) => Number.parseFloat(part.trim()));
    return {
      r: parts[0] ?? 0,
      g: parts[1] ?? 0,
      b: parts[2] ?? 0,
      a: parts.length > 3 ? Math.round((parts[3] ?? 1) * 255) : 255,
    };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

interface Point {
  x: number;
  y: number;
}

export class FakeContext2D {
  readonly canvas: CanvasSurface;
  lineCap = 'butt';
  lineJoin = 'miter';
  strokeStyle = '#000000';
  fillStyle = '#000000';
  font = '10px sans-serif';
  textBaseline = 'alphabetic';
  textAlign = 'start';
  /** Every stroke the context painted — handy for assertions. */
  readonly strokes: Point[][] = [];

  private path: Point[] = [];

  constructor(canvas: CanvasSurface) {
    this.canvas = canvas;
  }

  get fontSize(): number {
    const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
    return match ? Number(match[1]) : 10;
  }

  beginPath(): void {
    this.path = [];
  }

  moveTo(x: number, y: number): void {
    this.path.push({ x, y });
  }

  lineTo(x: number, y: number): void {
    this.path.push({ x, y });
  }

  quadraticCurveTo(_cx: number, _cy: number, x: number, y: number): void {
    this.path.push({ x, y });
  }

  closePath(): void {
    /* no-op */
  }

  stroke(): void {
    if (this.path.length === 0) return;
    this.strokes.push(this.path.map((point) => ({ ...point })));
    const color = parseColor(this.strokeStyle);
    for (let i = 1; i < this.path.length; i++) {
      this.drawLine(this.path[i - 1]!, this.path[i]!, color);
    }
    if (this.path.length === 1) {
      const only = this.path[0]!;
      this.fillPixel(only.x, only.y, color);
    }
  }

  fill(): void {
    /* no-op */
  }

  save(): void {
    /* no-op */
  }

  restore(): void {
    /* no-op */
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    for (let row = Math.floor(y); row < Math.ceil(y + h); row++) {
      for (let col = Math.floor(x); col < Math.ceil(x + w); col++) {
        this.setPixel(col, row, { r: 0, g: 0, b: 0, a: 0 });
      }
    }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const color = parseColor(this.fillStyle);
    for (let row = Math.floor(y); row < Math.ceil(y + h); row++) {
      for (let col = Math.floor(x); col < Math.ceil(x + w); col++) {
        this.setPixel(col, row, color);
      }
    }
  }

  fillText(text: string, x: number, y: number): void {
    const size = this.fontSize;
    const width = this.measureText(text).width;
    // Approximate the glyph box: the baseline sits at `y`.
    const top = this.textBaseline === 'middle' ? y - size * 0.5 : y - size * 0.8;
    this.fillRect(x, top, width, size);
  }

  measureText(text: string): { width: number } {
    // A fixed advance per character keeps the geometry predictable.
    return { width: text.length * this.fontSize * 0.5 };
  }

  drawImage(source: unknown, ...args: number[]): void {
    const bitmap = source as { width?: number; height?: number; pixels?: Uint8ClampedArray };
    const sw = Math.max(1, Math.round(Number(bitmap.width) || 0));
    const sh = Math.max(1, Math.round(Number(bitmap.height) || 0));
    const tail = args.slice(-2).map(Number);
    const dw = Number.isFinite(tail[0] ?? NaN) ? tail[0]! : sw;
    const dh = Number.isFinite(tail[1] ?? NaN) ? tail[1]! : sh;
    const dx = args.length >= 4 ? Number(args[args.length - 4]) : 0;
    const dy = args.length >= 4 ? Number(args[args.length - 3]) : 0;
    const pixels = bitmap.pixels;
    if (!pixels) return;
    for (let y = 0; y < Math.round(dh); y++) {
      const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
      for (let x = 0; x < Math.round(dw); x++) {
        const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
        const si = (sy * sw + sx) * 4;
        this.fillPixel(dx + x, dy + y, {
          r: pixels[si] ?? 0,
          g: pixels[si + 1] ?? 0,
          b: pixels[si + 2] ?? 0,
          a: pixels[si + 3] ?? 0,
        });
      }
    }
  }

  getImageData(x: number, y: number, width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(Math.max(0, width) * Math.max(0, height) * 4);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const px = x + col;
        const py = y + row;
        if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) continue;
        const si = (py * this.canvas.width + px) * 4;
        const di = (row * width + col) * 4;
        data[di] = this.canvas.pixels[si]!;
        data[di + 1] = this.canvas.pixels[si + 1]!;
        data[di + 2] = this.canvas.pixels[si + 2]!;
        data[di + 3] = this.canvas.pixels[si + 3]!;
      }
    }
    return { data, width, height } as unknown as ImageData;
  }

  putImageData(image: ImageData, dx: number, dy: number): void {
    for (let row = 0; row < image.height; row++) {
      for (let col = 0; col < image.width; col++) {
        const si = (row * image.width + col) * 4;
        const alpha = image.data[si + 3] ?? 0;
        if (alpha === 0) continue;
        this.fillPixel(dx + col, dy + row, {
          r: image.data[si] ?? 0,
          g: image.data[si + 1] ?? 0,
          b: image.data[si + 2] ?? 0,
          a: alpha,
        });
      }
    }
  }

  private setPixel(x: number, y: number, color: Rgba): void {
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;
    const i = (y * this.canvas.width + x) * 4;
    this.canvas.pixels[i] = color.r;
    this.canvas.pixels[i + 1] = color.g;
    this.canvas.pixels[i + 2] = color.b;
    this.canvas.pixels[i + 3] = color.a;
  }

  private fillPixel(x: number, y: number, color: Rgba): void {
    // A 3px square gives strokes a visible thickness.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.setPixel(Math.round(x) + dx, Math.round(y) + dy, color);
      }
    }
  }

  private drawLine(from: Point, to: Point, color: Rgba): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.fillPixel(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, color);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Fake canvas element                                                       */
/* -------------------------------------------------------------------------- */

export class FakeCanvas extends EventTarget {
  private _width = 300;
  private _height = 150;
  pixels = new Uint8ClampedArray(300 * 150 * 4);
  context: FakeContext2D | null = null;
  /** Every `toDataURL()` call — handy for assertions. */
  readonly encodings: string[] = [];

  get width(): number {
    return this._width;
  }

  /** Resizing a canvas discards its content, exactly like the real thing. */
  set width(value: number) {
    this._width = Math.max(0, Math.round(value));
    this.pixels = new Uint8ClampedArray(this._width * this._height * 4);
    this.context = null;
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    this._height = Math.max(0, Math.round(value));
    this.pixels = new Uint8ClampedArray(this._width * this._height * 4);
    this.context = null;
  }

  getContext(kind: string): FakeContext2D | null {
    if (kind !== '2d') return null;
    if (!this.context) this.context = new FakeContext2D(this);
    return this.context;
  }

  toDataURL(type = 'image/png'): string {
    this.encodings.push(type);
    const png = encodePng(this.pixels, this.width, this.height);
    return `data:${type};base64,${Buffer.from(png).toString('base64')}`;
  }

  getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: this.width,
      bottom: this.height,
      width: this.width,
      height: this.height,
      toJSON: () => ({}),
    } as DOMRect;
  }
}

export interface CanvasMockHandle {
  /** Every canvas handed out by `document.createElement('canvas')`. */
  readonly canvases: FakeCanvas[];
  restore(): void;
}

/**
 * Install the fake canvas.
 *
 * Both `document.createElement('canvas')` and real `<canvas>` elements in the
 * document are faked, so the browser-only signature code can run under jsdom
 * whether it creates its own canvas or uses one from the markup.
 */
export function installCanvasMock(): CanvasMockHandle {
  const original = document.createElement.bind(document);
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const canvases: FakeCanvas[] = [];
  const states = new WeakMap<
    HTMLCanvasElement,
    CanvasSurface & { context: FakeContext2D | null }
  >();

  const surfaceFor = (element: HTMLCanvasElement) => {
    let state = states.get(element);
    if (!state) {
      state = {
        width: element.width,
        height: element.height,
        pixels: new Uint8ClampedArray(element.width * element.height * 4),
        context: null,
      };
      states.set(element, state);
    }
    if (state.width !== element.width || state.height !== element.height) {
      state.width = element.width;
      state.height = element.height;
      state.pixels = new Uint8ClampedArray(state.width * state.height * 4);
      state.context = null;
    }
    return state;
  };

  document.createElement = ((tag: string, options?: ElementCreationOptions) => {
    if (String(tag).toLowerCase() === 'canvas') {
      const canvas = new FakeCanvas();
      canvases.push(canvas);
      return canvas as unknown as HTMLElement;
    }
    return original(tag, options);
  }) as typeof document.createElement;

  HTMLCanvasElement.prototype.getContext = function getContext(
    this: HTMLCanvasElement,
    kind: string,
  ): FakeContext2D | null {
    if (kind !== '2d') return null;
    const state = surfaceFor(this);
    if (!state.context) state.context = new FakeContext2D(state);
    return state.context;
  } as unknown as HTMLCanvasElement['getContext'];

  HTMLCanvasElement.prototype.toDataURL = function toDataURL(
    this: HTMLCanvasElement,
    type = 'image/png',
  ): string {
    const state = surfaceFor(this);
    const png = encodePng(state.pixels, state.width, state.height);
    return `data:${type};base64,${Buffer.from(png).toString('base64')}`;
  } as unknown as HTMLCanvasElement['toDataURL'];

  return {
    canvases,
    restore() {
      document.createElement = original;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    },
  };
}

/** Build a PNG file (for the upload path). */
export function makePngFile(
  name = 'signature.png',
  width = 40,
  height = 20,
  color: Rgba = { r: 0, g: 0, b: 0, a: 255 },
): File {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color.r;
    pixels[i + 1] = color.g;
    pixels[i + 2] = color.b;
    pixels[i + 3] = color.a;
  }
  const png = encodePng(pixels, width, height);
  return new File([png], name, { type: 'image/png' });
}
