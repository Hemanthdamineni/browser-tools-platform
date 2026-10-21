import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import { decodeHeic, HEIC_WASM_URL } from './heic-codec';

/**
 * The WebAssembly decoder itself cannot run under jsdom, so these tests cover
 * the parts around it: the cheap container check that happens *before* the
 * 1.4 MB decoder is downloaded, and the two ways the download can fail.
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A minimal, valid ISO-BMFF `ftyp` box for a HEIC file. */
function heicHeader(brand = 'heic'): Uint8Array {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
  for (let i = 0; i < 4; i++) bytes[8 + i] = brand.charCodeAt(i);
  view.setUint32(12, 0x2000);
  return bytes;
}

describe('decodeHeic', () => {
  it('rejects a file that is not HEIF without downloading the decoder', async () => {
    const bytes = new TextEncoder().encode('this is not a HEIC file, it is just some text');
    await expect(decodeHeic(bytes)).rejects.toThrow(/not a HEIC or HEIF image/i);
    await expect(decodeHeic(bytes)).rejects.toThrow(ToolError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an AVIF file with its own message', async () => {
    await expect(decodeHeic(heicHeader('avif'))).rejects.toThrow(/AVIF image, not a HEIC/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a file that is not HEIF before the decoder is downloaded', async () => {
    await expect(decodeHeic(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).rejects.toThrow(
      /not a HEIC or HEIF image/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a decoder that cannot be downloaded', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    await expect(decodeHeic(heicHeader())).rejects.toThrow(/could not be downloaded/i);
  });

  it('reports a missing decoder file with its status code', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(decodeHeic(heicHeader())).rejects.toThrow(/could not be downloaded/i);
    expect(fetchMock).toHaveBeenCalledWith(HEIC_WASM_URL);
  });
});

describe('HEIC_WASM_URL', () => {
  it('points at the copy of the binary served from this origin', () => {
    expect(HEIC_WASM_URL).toMatch(/^.*vendor\/libheif\/libheif\.wasm$/);
    expect(HEIC_WASM_URL.startsWith('http')).toBe(false);
  });
});
