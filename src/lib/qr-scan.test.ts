import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_BYTES,
  MAX_PIXELS,
  clampMaxDimension,
  decodePixels,
  isAbortError,
  resetNativeDetectorCache,
  scanImageBlob,
} from './qr-scan';
import {
  FakeImageBitmap,
  FakeImageData,
  FakeOffscreenCanvas,
  blankPixels,
  invertPixels,
  qrPixels,
  rotateSource,
  type Source,
} from './qr-test-helpers';

beforeEach(() => {
  resetNativeDetectorCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Point `createImageBitmap` + `OffscreenCanvas` at real generated pixels. */
function stubImageStack(directiveToSource: (directive: string) => Source | null): void {
  vi.stubGlobal(
    'createImageBitmap',
    async (blob: Blob): Promise<FakeImageBitmap> => {
      const directive = await blob.text();
      const source = directiveToSource(directive);
      if (!source) throw new Error('not a decodable image');
      return new FakeImageBitmap(source) as unknown as ImageBitmap;
    },
  );
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
}

/** Install a fake `BarcodeDetector` + the `ImageData` it needs. */
function stubNativeDetector(detector: { detect: unknown }, formats: string[]): void {
  class FakeDetector {
    detect = detector.detect;
    static async getSupportedFormats() {
      return formats;
    }
  }
  vi.stubGlobal('BarcodeDetector', FakeDetector);
  vi.stubGlobal('ImageData', FakeImageData);
}

describe('clampMaxDimension', () => {
  it('clamps into the supported range and rejects nonsense', () => {
    expect(clampMaxDimension(2048)).toBe(2048);
    expect(clampMaxDimension(10)).toBe(256);
    expect(clampMaxDimension(99_999)).toBe(8192);
    expect(clampMaxDimension(1024.6)).toBe(1025);
    expect(clampMaxDimension(Number.NaN)).toBe(2048);
  });
});

describe('decodePixels', () => {
  it('finds nothing in a blank image', async () => {
    expect(await decodePixels(blankPixels(240, 240), { tryHarder: false })).toEqual([]);
  });

  it('decodes a real QR code with the bundled fallback', async () => {
    const codes = await decodePixels(qrPixels('https://example.com/hello'), { tryHarder: true });
    expect(codes).toHaveLength(1);
    expect(codes[0]!.text).toBe('https://example.com/hello');
    expect(codes[0]!.source).toBe('jsqr');
  });

  it('decodes Unicode payloads byte for byte', async () => {
    for (const text of ['héllo wörld', '日本語のテキスト', 'ok ✅'] as const) {
      const codes = await decodePixels(qrPixels(text), { tryHarder: true });
      expect(codes[0]!.text).toBe(text);
    }
  });

  it('decodes a rotated code without needing rotated passes', async () => {
    const sideways = rotateSource(qrPixels('sideways-code'), 1);
    const lax = await decodePixels(sideways, { tryHarder: false });
    expect(lax[0]!.text).toBe('sideways-code');
  });

  it('reports progress and finishes', async () => {
    const seen: string[] = [];
    await decodePixels(qrPixels('progress'), {
      tryHarder: true,
      onProgress: (fraction, message) => {
        expect(fraction).toBeGreaterThanOrEqual(0);
        expect(fraction).toBeLessThanOrEqual(1);
        if (message) seen.push(message);
      },
    });
    expect(seen[0]).toMatch(/looking for a code/i);
    expect(seen.at(-1)).toBe('Code found');
  });

  it('reads inverted (white-on-black) codes only when tryHarder is on', async () => {
    const inverted = invertPixels(qrPixels('inverted-code'));
    expect(await decodePixels(inverted, { tryHarder: false })).toEqual([]);
    const hard = await decodePixels(inverted, { tryHarder: true });
    expect(hard[0]!.text).toBe('inverted-code');
  });

  it('prefers the native detector when the browser has one', async () => {
    const detect = vi.fn(async () => [{ rawValue: 'from-barcode-detector' }]);
    stubNativeDetector({ detect }, ['qr_code']);

    const codes = await decodePixels(blankPixels(240, 240), { tryHarder: true });
    expect(codes).toEqual([{ text: 'from-barcode-detector', source: 'native' }]);
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('skips a detector that does not support QR codes', async () => {
    const detect = vi.fn(async () => [{ rawValue: 'should-not-be-used' }]);
    stubNativeDetector({ detect }, ['ean_13']);

    const codes = await decodePixels(qrPixels('fallback-after-format-check'), {
      tryHarder: false,
    });
    expect(codes[0]!.source).toBe('jsqr');
    expect(detect).not.toHaveBeenCalled();
  });

  it('falls back to the bundled decoder when the native one fails', async () => {
    const detect = vi.fn(async () => {
      throw new Error('detector exploded');
    });
    stubNativeDetector({ detect }, ['qr_code']);

    const codes = await decodePixels(qrPixels('after-native-failure'), { tryHarder: false });
    expect(detect).toHaveBeenCalledTimes(1);
    expect(codes[0]!.text).toBe('after-native-failure');
    expect(codes[0]!.source).toBe('jsqr');
  });

  it('stops when the caller aborts', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      decodePixels(blankPixels(64, 64), { signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);
  });

  it('recognises abort errors by name', () => {
    expect(isAbortError(new DOMException('stop', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('other'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('scanImageBlob', () => {
  it('refuses files that are too large before decoding', async () => {
    const huge = { size: MAX_BYTES + 1, type: 'image/png' } as unknown as Blob;
    await expect(scanImageBlob(huge)).rejects.toThrow(/too large/i);
  });

  it('explains when the browser cannot decode images', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(scanImageBlob(file)).rejects.toThrow(/createImageBitmap/);
  });

  it('refuses images with an absurd pixel count', async () => {
    const side = Math.ceil(Math.sqrt(MAX_PIXELS)) + 10;
    stubImageStack(() => ({ data: new Uint8ClampedArray(4), width: side, height: side }));
    const file = new File(['anything'], 'huge.png', { type: 'image/png' });
    await expect(scanImageBlob(file)).rejects.toThrow(/megapixels/);
  });

  it('wraps unreadable images in a friendly error', async () => {
    stubImageStack(() => null);
    const file = new File(['not an image'], 'broken.png', { type: 'image/png' });
    await expect(scanImageBlob(file)).rejects.toThrow(/could not be decoded as an image/i);
  });

  it('decodes an uploaded image end to end', async () => {
    stubImageStack((directive) => (directive === 'QR' ? qrPixels('wifi:scan-me', 6) : null));
    const file = new File(['QR'], 'photo.png', { type: 'image/png' });

    const result = await scanImageBlob(file, { maxDimension: 512, tryHarder: true });
    expect(result.codes[0]!.text).toBe('wifi:scan-me');
    expect(result.scannedWidth).toBe(result.width);
    expect(result.scannedHeight).toBe(result.height);
  });

  it('downscales large images but still decodes them', async () => {
    stubImageStack(() => qrPixels('big-image-code', 16, 4));
    const file = new File(['QR'], 'big.png', { type: 'image/png' });

    const result = await scanImageBlob(file, { maxDimension: 300, tryHarder: true });
    expect(result.scannedWidth).toBe(300);
    expect(result.scannedWidth).toBeLessThan(result.width);
    expect(result.codes[0]!.text).toBe('big-image-code');
  });
});
