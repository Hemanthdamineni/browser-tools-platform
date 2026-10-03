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

  return new Uint8Array(
    Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])]),
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** JPEG EXIF with an ExifIFDPointer, LensModel, and a RATIONAL FNumber. */
function exifJpegWithPointerBytes(): Uint8Array {
  const IFD0 = 8;
  const EXIF_IFD = 38;
  const DTO = 96; // DateTimeOriginal, 20-byte ASCII
  const FNUM = 120; // FNumber, RATIONAL
  const LENS = 128; // LensModel, ASCII
  const tiff = Buffer.alloc(144);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(IFD0, 4);

  // IFD0: ExifIFDPointer (0x8769) + Orientation.
  tiff.writeUInt16LE(2, IFD0);
  tiff.writeUInt16LE(0x8769, IFD0 + 2);
  tiff.writeUInt16LE(4, IFD0 + 4); // LONG
  tiff.writeUInt32LE(1, IFD0 + 6);
  tiff.writeUInt32LE(EXIF_IFD, IFD0 + 10);
  tiff.writeUInt16LE(0x0112, IFD0 + 14);
  tiff.writeUInt16LE(3, IFD0 + 16); // SHORT
  tiff.writeUInt32LE(1, IFD0 + 18);
  tiff.writeUInt16LE(1, IFD0 + 22);
  tiff.writeUInt32LE(0, IFD0 + 26); // no next IFD

  // Exif sub-IFD: DateTimeOriginal, FNumber, LensModel.
  tiff.writeUInt16LE(3, EXIF_IFD);
  tiff.writeUInt16LE(0x9003, EXIF_IFD + 2);
  tiff.writeUInt16LE(2, EXIF_IFD + 4); // ASCII
  tiff.writeUInt32LE(20, EXIF_IFD + 6);
  tiff.writeUInt32LE(DTO, EXIF_IFD + 10);
  tiff.writeUInt16LE(0x829d, EXIF_IFD + 14);
  tiff.writeUInt16LE(5, EXIF_IFD + 16); // RATIONAL
  tiff.writeUInt32LE(1, EXIF_IFD + 18);
  tiff.writeUInt32LE(FNUM, EXIF_IFD + 22);
  tiff.writeUInt16LE(0xa434, EXIF_IFD + 26);
  tiff.writeUInt16LE(2, EXIF_IFD + 28); // ASCII
  tiff.writeUInt32LE(10, EXIF_IFD + 30);
  tiff.writeUInt32LE(LENS, EXIF_IFD + 34);
  tiff.writeUInt32LE(0, EXIF_IFD + 38); // no next IFD

  tiff.write('2026:03:14 15:09:26\0', DTO, 'ascii');
  tiff.writeUInt32LE(35, FNUM); // 35/10 = 3.5
  tiff.writeUInt32LE(10, FNUM + 4);
  tiff.write('Prime Lens\0', LENS, 'ascii');

  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const app1 = Buffer.alloc(4 + payload.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(2 + payload.length, 2);
  payload.copy(app1, 4);
  return new Uint8Array(
    Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])]),
  );
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
    return (crc32 ^ 0xffffffff) >>> 0;
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
  const text = Buffer.concat([Buffer.from('Author\0Claude', 'latin1')]);
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(2835, 0); // x
  phys.writeUInt32BE(2835, 4); // y
  phys[8] = 1; // meter
  return new Uint8Array(
    Buffer.concat([sig, chunk('IHDR', ihdr), chunk('tEXt', text), chunk('pHYs', phys)]),
  );
}

/** Minimal PNG carrying a tIME chunk (2-byte year, then M/D/h/m/s). */
function pngBytesWithTime(year: number): Uint8Array {
  const crc = (data: Uint8Array): number => {
    let crc32 = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      let c = (crc32 ^ data[i]!) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32 = (crc32 >>> 8) ^ c;
    }
    return (crc32 ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(4 + body.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), 4 + body.length);
    return out;
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const time = Buffer.alloc(7);
  time.writeUInt16BE(year, 0); // two-byte year per the PNG spec
  time[2] = 3; // month
  time[3] = 14; // day
  time[4] = 15; // hour
  time[5] = 9; // minute
  time[6] = 26; // second
  return new Uint8Array(Buffer.concat([sig, chunk('IHDR', ihdr), chunk('tIME', time)]));
}

describe('readExif', () => {
  it('reads a little-endian APP1 Exif Orientation tag', () => {
    expect(readExif(toArrayBuffer(exifJpegBytes()))).toMatchObject({ Orientation: 6 });
  });
  it('follows ExifIFDPointer and reads Exif tags', () => {
    expect(readExif(toArrayBuffer(exifJpegWithPointerBytes()))).toMatchObject({
      DateTimeOriginal: '2026:03:14 15:09:26',
      FNumber: 3.5,
      LensModel: 'Prime Lens',
    });
  });

  it('returns an empty record for a JPEG without an Exif block', () => {
    expect(readExif(toArrayBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])))).toEqual({});
  });
  it('is safe against truncated input', () => {
    expect(readExif(toArrayBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00])))).toEqual({});
  });
});

describe('decodePngChunks', () => {
  it('reads the two-byte PNG tIME year field', () => {
    const bytes = pngBytesWithTime(2026);
    expect(decodePngChunks(toArrayBuffer(bytes)).Modified).toBe('2026-03-14 15:09:26');
  });

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
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(
      /not be decoded as an image/i,
    );
  });
});
