import { describe, expect, it } from 'vitest';
import { decodePngChunks, readExif } from './image-metadata.tool';
import tool from './image-metadata.tool';

/** Minimal JPEG: SOI + APP1 EXIF (little-endian TIFF, Orientation=6) + EOI. */
function exifJpegBytes(): Uint8Array {
  const header = Buffer.alloc(8);
  Buffer.from('II', 'ascii').copy(header); // little-endian
  header.writeUInt16LE(42, 2); // magic
  header.writeUInt32LE(8, 4); // IFD0 offset

  const ifd = Buffer.alloc(2 + 12 + 4);
  ifd.writeUInt16LE(1, 0); // 1 entry
  ifd.writeUInt16LE(0x0112, 2); // Orientation
  ifd.writeUInt16LE(3, 4); // SHORT
  ifd.writeUInt32LE(1, 6); // count
  ifd.writeUInt16LE(6, 10); // value
  ifd.writeUInt32LE(0, 14); // next IFD = none

  const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), header, ifd]);
  const app1 = Buffer.alloc(4 + exifPayload.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(2 + exifPayload.length, 2);
  exifPayload.copy(app1, 4);

  return new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])]));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Minimal PNG with a tEXt and pHYs chunk. */
function pngBytes(): Uint8Array {
  const crc = (data: Uint8Array): number => {
    // Simple CRC32 (the standard polynomial) for PNG chunk validation.
    let c: number;
    let crc32 = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      c = (crc32 ^ data[i]!) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32 = (crc32 >>> 8) ^ c;
    }
    return crc32 ^ 0xffffffff;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const t = Buffer.from(type, 'latin1');
    const body = Buffer.concat([t, data]);
    const out = Buffer.alloc(4 + body.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), 4 + body.length);
    return out;
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const text = Buffer.concat([
    Buffer.from('Author\0Claude', 'latin1'),
  ]);
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(2835, 0); // x
  phys.writeUInt32BE(2835, 4); // y
  phys[8] = 1; // meter
  return new Uint8Array(Buffer.concat([sig, chunk('IHDR', ihdr), chunk('tEXt', text), chunk('pHYs', phys)]));
}

describe('readExif', () => {
  it('reads a little-endian APP1 Exif Orientation tag', () => {
    expect(readExif(toArrayBuffer(exifJpegBytes()))).toMatchObject({ Orientation: 6 });
  });
  it('returns an empty record for a JPEG without an Exif block', () => {
    expect(readExif(toArrayBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])))).toEqual({});
  });
  it('is safe against truncated input', () => {
    expect(readExif(toArrayBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00])))).toEqual({});
  });
});

describe('decodePngChunks', () => {
  it('extracts tEXt and pHYs metadata', () => {
    const meta = decodePngChunks(toArrayBuffer(pngBytes()));
    expect(meta.Author).toBe('Claude');
    expect(meta['Pixel density']).toBe('2835×2835 ppu');
  });
  it('returns an empty record for a non-PNG header', () => {
    expect(decodePngChunks(toArrayBuffer(new Uint8Array([1, 2, 3, 4])))).toEqual({});
  });
});

describe('image-metadata run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });
  it('throws a decode error unsupported for non-decodable image files', async () => {
    const file = new File(['not a real image'], 'image.png', { type: 'image/png' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not be decoded as an image/i);
  });
});
