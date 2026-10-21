import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_SIGNATURE_EDGE, readUploadedSignature } from './upload';
import { decodeDataUrl, readPngInfo } from './pixels';
import {
  encodePng,
  installCanvasMock,
  makePngFile,
  type CanvasMockHandle,
} from '../../../test/signature-fakes';

let mock: CanvasMockHandle;
const originalCreateImageBitmap = globalThis.createImageBitmap;

beforeEach(() => {
  mock = installCanvasMock();
  // jsdom has no image decoder: stand in for one with a known bitmap.
  globalThis.createImageBitmap = (async (source: Blob) => {
    const bytes = new Uint8Array(await (source as File).arrayBuffer());
    const info = readPngInfo(bytes);
    if (!info) throw new Error('decode failed');
    const pixels = new Uint8ClampedArray(info.width * info.height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 255;
    }
    return { width: info.width, height: info.height, pixels } as unknown as ImageBitmap;
  }) as typeof createImageBitmap;
});

afterEach(() => {
  mock.restore();
  globalThis.createImageBitmap = originalCreateImageBitmap;
});

describe('readUploadedSignature', () => {
  it('reads a PNG into a signature asset', async () => {
    const asset = await readUploadedSignature(makePngFile('sign.png', 40, 20));
    expect(asset.mode).toBe('upload');
    expect(asset.hasAlpha).toBe(true);
    expect(asset.width).toBe(40);
    expect(asset.height).toBe(20);
    const info = readPngInfo(decodeDataUrl(asset.dataUrl).bytes);
    expect(info?.width).toBe(40);
    expect(info?.height).toBe(20);
  });

  it('scales a huge image down to the embedding limit', async () => {
    const file = makePngFile('big.png', MAX_SIGNATURE_EDGE * 2, 100);
    const asset = await readUploadedSignature(file);
    expect(asset.width).toBe(MAX_SIGNATURE_EDGE);
    expect(asset.height).toBe(50);
  });

  it('refuses a file that is not a PNG', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'sign.jpg', {
      type: 'image/jpeg',
    });
    await expect(readUploadedSignature(jpeg)).rejects.toThrow(/PNG/);
  });

  it('refuses a file whose bytes are not a valid PNG', async () => {
    const broken = new File([new TextEncoder().encode('definitely not a png')], 'sign.png', {
      type: 'image/png',
    });
    await expect(readUploadedSignature(broken)).rejects.toThrow(/not a valid PNG/);
  });

  it('refuses an empty file', async () => {
    const empty = new File([], 'sign.png', { type: 'image/png' });
    await expect(readUploadedSignature(empty)).rejects.toThrow(/empty/);
  });

  it('refuses a file that is too large', async () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], 'sign.png', { type: 'image/png' });
    await expect(readUploadedSignature(big)).rejects.toThrow(/larger than/);
  });

  it('reports an opaque PNG without an alpha channel', async () => {
    const bytes = encodePng(new Uint8ClampedArray(4 * 4 * 4), 2, 2);
    bytes[25] = 2; // colour type 2 = RGB, no alpha
    const file = new File([bytes], 'opaque.png', { type: 'image/png' });
    const asset = await readUploadedSignature(file);
    expect(asset.hasAlpha).toBe(false);
  });
});
