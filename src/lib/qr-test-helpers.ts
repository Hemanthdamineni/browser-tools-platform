/**
 * Test-only helpers for the QR scanner. Rasterises real QR codes into RGBA
 * pixels (no canvas needed) and provides the minimum fake canvas/bitmap
 * surface the scanner talks to, so decode paths can be exercised for real.
 */
import qrcode from 'qrcode-generator';

export interface Source {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function blankPixels(width: number, height: number, value = 255): Source {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

/** Invert every pixel (white-on-black codes). */
export function invertPixels(source: Source): Source {
  const data = new Uint8ClampedArray(source.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]!;
    data[i + 1] = 255 - data[i + 1]!;
    data[i + 2] = 255 - data[i + 2]!;
  }
  return { data, width: source.width, height: source.height };
}

/**
 * Rasterise `text` as a QR code with a 4-module quiet zone.
 *
 * The default `qrcode-generator` byte encoder writes UTF-16 code units, which
 * produces byte-mode QR codes that real decoders cannot read once the text
 * leaves ASCII. Switching to the bundled UTF-8 encoder fixes that (and matches
 * what real generators do).
 */
export function qrPixels(text: string, scale = 6, margin = 4): Source {
  const previous = qrcode.stringToBytes;
  const utf8 = qrcode.stringToBytesFuncs['UTF-8'];
  if (utf8) qrcode.stringToBytes = utf8;

  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const size = (count + margin * 2) * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!qr.isDark(row, col)) continue;
        for (let y = 0; y < scale; y++) {
          for (let x = 0; x < scale; x++) {
            const px = (col + margin) * scale + x;
            const py = (row + margin) * scale + y;
            const offset = (py * size + px) * 4;
            data[offset] = 0;
            data[offset + 1] = 0;
            data[offset + 2] = 0;
            data[offset + 3] = 255;
          }
        }
      }
    }
    return { data, width: size, height: size };
  } finally {
    qrcode.stringToBytes = previous;
  }
}

/** Rotate pixels by `quarters` × 90° clockwise (test utility). */
export function rotateSource(source: Source, quarters: number): Source {
  const turns = ((Math.trunc(quarters) % 4) + 4) % 4;
  if (turns === 0) return source;
  const { data, width, height } = source;
  const out = new Uint8ClampedArray(data.length);

  if (turns === 2) {
    const stride = width * 4;
    for (let y = 0; y < height; y++) {
      const src = y * stride;
      const dst = (height - 1 - y) * stride;
      for (let x = 0; x < width; x++) {
        const s = src + x * 4;
        const d = dst + (width - 1 - x) * 4;
        for (let k = 0; k < 4; k++) out[d + k] = data[s + k]!;
      }
    }
    return { data: out, width, height };
  }

  const outWidth = height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = turns === 1 ? height - 1 - y : y;
      const dy = turns === 1 ? x : width - 1 - x;
      const s = (y * width + x) * 4;
      const d = (dy * outWidth + dx) * 4;
      for (let k = 0; k < 4; k++) out[d + k] = data[s + k]!;
    }
  }
  return { data: out, width: outWidth, height: width };
}

/** Nearest-neighbour resample — stands in for `drawImage` scaling. */
export function sample(source: Source, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(source.height - 1, Math.floor((y * source.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(source.width - 1, Math.floor((x * source.width) / width));
      const s = (sy * source.width + sx) * 4;
      const d = (y * width + x) * 4;
      out[d] = source.data[s]!;
      out[d + 1] = source.data[s + 1]!;
      out[d + 2] = source.data[s + 2]!;
      out[d + 3] = source.data[s + 3]!;
    }
  }
  return out;
}

/** Stand-in for an `ImageBitmap`, carrying its pixels for the fake canvas. */
export class FakeImageBitmap {
  readonly width: number;
  readonly height: number;
  readonly source: Source;
  closed = false;

  constructor(source: Source) {
    this.source = source;
    this.width = source.width;
    this.height = source.height;
  }

  close(): void {
    this.closed = true;
  }
}

/** Stand-in for `OffscreenCanvas` that can hand back real pixels. */
export class FakeOffscreenCanvas {
  width: number;
  height: number;
  private source: Source | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(): {
    drawImage: (source: Source | FakeImageBitmap, dx: number, dy: number, dw: number, dh: number) => void;
    getImageData: (
      sx: number,
      sy: number,
      sw: number,
      sh: number,
    ) => { data: Uint8ClampedArray; width: number; height: number };
  } {
    return {
      drawImage: (source: Source | FakeImageBitmap) => {
        this.source = 'data' in source ? source : source.source;
      },
      getImageData: (_sx: number, _sy: number, sw: number, sh: number) => {
        const source = this.source;
        if (!source) throw new Error('drawImage was never called');
        return { data: sample(source, sw, sh), width: sw, height: sh };
      },
    };
  }
}

/** Minimal `ImageData` stand-in (jsdom has none). */
export class FakeImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    if (data.length !== width * height * 4) throw new Error('ImageData size mismatch');
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

/** Build a `File` whose bytes describe what the fake decoder should return. */
export function imageFile(name: string, directive: string, type = 'image/png'): File {
  return new File([directive], name, { type });
}
