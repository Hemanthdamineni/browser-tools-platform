import { describe, expect, it } from 'vitest';
import { bytesToDataUrl, decodeDataUrl, isPngBytes, readPngInfo, trimAlpha } from './pixels';
import { encodePng } from '../../../test/signature-fakes';

function pngBytes(width: number, height: number, colorType = 6): Uint8Array {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 10;
    pixels[i + 1] = 20;
    pixels[i + 2] = 30;
    pixels[i + 3] = 255;
  }
  const png = encodePng(pixels, width, height);
  if (colorType === 2) png[25] = 2; // pretend it is an opaque RGB PNG
  return png;
}

describe('isPngBytes', () => {
  it('accepts a PNG signature', () => {
    expect(isPngBytes(pngBytes(2, 2))).toBe(true);
  });

  it('rejects other bytes and truncated data', () => {
    expect(isPngBytes(new Uint8Array([1, 2, 3]))).toBe(false);
    expect(isPngBytes(new Uint8Array(0))).toBe(false);
    expect(isPngBytes(new TextEncoder().encode('%PDF-1.7'))).toBe(false);
  });
});

describe('readPngInfo', () => {
  it('reads the intrinsic size and colour type', () => {
    const info = readPngInfo(pngBytes(120, 60));
    expect(info).toEqual({
      width: 120,
      height: 60,
      bitDepth: 8,
      colorType: 6,
      hasAlpha: true,
    });
  });

  it('reports a PNG without an alpha channel', () => {
    const info = readPngInfo(pngBytes(10, 10, 2));
    expect(info?.hasAlpha).toBe(false);
  });

  it('returns null for data that is not a PNG', () => {
    expect(readPngInfo(new TextEncoder().encode('not a png at all'))).toBeNull();
    expect(readPngInfo(pngBytes(4, 4).slice(0, 20))).toBeNull();
  });
});

describe('decodeDataUrl', () => {
  it('round-trips bytes through a base64 data URL', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252]);
    const url = bytesToDataUrl('image/png', bytes);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    const decoded = decodeDataUrl(url);
    expect(decoded.mime).toBe('image/png');
    expect(Array.from(decoded.bytes)).toEqual(Array.from(bytes));
  });

  it('decodes a real PNG back to the same bytes', () => {
    const bytes = pngBytes(8, 4);
    const decoded = decodeDataUrl(bytesToDataUrl('image/png', bytes));
    expect(Array.from(decoded.bytes)).toEqual(Array.from(bytes));
  });

  it('rejects malformed payloads', () => {
    expect(() => decodeDataUrl('https://example.com/a.png')).toThrow(/Not a data URL/);
    expect(() => decodeDataUrl('data:image/png,raw')).toThrow(/base64/);
    expect(() => decodeDataUrl('data:image/png;base64,!!!not base64!!!')).toThrow(/base64/);
  });
});

describe('trimAlpha', () => {
  const pixel = (r: number, g: number, b: number, a: number) => [r, g, b, a];

  it('finds the bounding box of the ink', () => {
    const width = 6;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    const put = (x: number, y: number, rgba: number[]) => {
      const i = (y * width + x) * 4;
      data[i] = rgba[0]!;
      data[i + 1] = rgba[1]!;
      data[i + 2] = rgba[2]!;
      data[i + 3] = rgba[3]!;
    };
    put(2, 1, pixel(0, 0, 0, 255));
    put(3, 3, pixel(0, 0, 0, 255));
    expect(trimAlpha(data, width, height)).toEqual({ x: 2, y: 1, width: 2, height: 3 });
  });

  it('ignores nearly transparent pixels', () => {
    const width = 3;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4);
    const i = 4;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 3; // below the default threshold of 8
    expect(trimAlpha(data, width, height)).toBeNull();
  });

  it('returns null for an empty or fully transparent image', () => {
    expect(trimAlpha(new Uint8ClampedArray(16), 2, 2)).toBeNull();
    expect(trimAlpha(new Uint8ClampedArray(0), 0, 0)).toBeNull();
  });
});
