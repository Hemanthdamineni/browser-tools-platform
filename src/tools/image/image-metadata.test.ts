import { afterEach, describe, expect, it, vi } from 'vitest';
import { zlibSync } from 'fflate';
import tool, { decodePngChunks, readExif } from './image-metadata.tool';

/* -------------------------------------------------------------------------- */
/*  Fixture builders                                                          */
/* -------------------------------------------------------------------------- */

type TiffEntry = { tag: number; type: number; values: number[] | string };

function typeSizeOf(type: number): number {
  switch (type) {
    case 1:
    case 2:
    case 6:
    case 7:
      return 1;
    case 3:
    case 8:
      return 2;
    case 4:
    case 9:
    case 11:
      return 4;
    case 5:
    case 10:
    case 12:
      return 8;
    default:
      return 1;
  }
}

function u16(n: number, le: boolean): number[] {
  const b = [n & 0xff, (n >> 8) & 0xff];
  return le ? b : b.reverse();
}
function u32(n: number, le: boolean): number[] {
  const b = [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  return le ? b : b.reverse();
}

function encodeValue(type: number, values: number[] | string, le: boolean): number[] {
  if (typeof values === 'string') {
    return [...Array.from(values, (c) => c.charCodeAt(0) & 0xff), 0];
  }
  const per = type === 5 || type === 10 ? 4 : typeSizeOf(type);
  const out: number[] = [];
  for (const n of values) {
    const word: number[] = [];
    for (let i = 0; i < per; i++) word.push((n >>> (8 * i)) & 0xff);
    out.push(...(le ? word : word.reverse()));
  }
  return out;
}

function countOf(type: number, values: number[] | string, encodedLength: number): number {
  if (typeof values === 'string') return encodedLength;
  return type === 5 || type === 10 ? values.length / 2 : values.length;
}

/** Build a TIFF blob: header + IFD0 (+ optional Exif sub-IFD) + value pool. */
function buildTiff(le: boolean, ifd0: TiffEntry[], exif: TiffEntry[]): number[] {
  const hasExif = exif.length > 0;
  const entries0: TiffEntry[] = hasExif
    ? [...ifd0, { tag: 0x8769, type: 4, values: [0] }]
    : ifd0;
  const ifd0Size = 2 + entries0.length * 12 + 4;
  const exifStart = 8 + ifd0Size;
  const exifSize = hasExif ? 2 + exif.length * 12 + 4 : 0;
  if (hasExif) entries0[entries0.length - 1] = { tag: 0x8769, type: 4, values: [exifStart] };

  const dataStart = 8 + ifd0Size + exifSize;
  const data: number[] = [];

  const writeIfd = (entries: TiffEntry[]): number[] => {
    const bytes = [...u16(entries.length, le)];
    for (const e of entries) {
      const encoded = encodeValue(e.type, e.values, le);
      bytes.push(...u16(e.tag, le), ...u16(e.type, le), ...u32(countOf(e.type, e.values, encoded.length), le));
      if (encoded.length <= 4) {
        bytes.push(...encoded, ...new Array(4 - encoded.length).fill(0));
      } else {
        const off = dataStart + data.length;
        data.push(...encoded);
        if (encoded.length % 2 !== 0) data.push(0);
        bytes.push(...u32(off, le));
      }
    }
    bytes.push(...u32(0, le));
    return bytes;
  };

  const header = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42, le), ...u32(8, le)];
  return [...header, ...writeIfd(entries0), ...(hasExif ? writeIfd(exif) : []), ...data];
}

/** Wrap a TIFF blob in a JPEG SOI + APP1 Exif segment + EOI. */
function exifJpeg(le: boolean, ifd0: TiffEntry[], exif: TiffEntry[] = []): Uint8Array {
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...buildTiff(le, ifd0, exif)];
  const segLen = payload.length + 2;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    (segLen >> 8) & 0xff,
    segLen & 0xff,
    ...payload,
    0xff,
    0xd9,
  ]);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    let c = (crc ^ data[i]!) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(4 + body.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 4 + body.length);
  return out;
}

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function ihdr(width = 2, height = 1, bitDepth = 8, colourType = 6): Buffer {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(width, 0);
  b.writeUInt32BE(height, 4);
  b[8] = bitDepth;
  b[9] = colourType;
  return b;
}

/** A PNG carrying IHDR, tEXt, zTXt, iTXt, pHYs (metre) and tIME chunks. */
function richPng(): Uint8Array {
  const text = Buffer.from('Author\0Claude', 'latin1');
  const ztxt = Buffer.concat([
    Buffer.from('Comment\0', 'latin1'),
    Buffer.from([0]),
    Buffer.from(zlibSync(Buffer.from('Compressed value', 'utf8'))),
  ]);
  const itxt = Buffer.concat([
    Buffer.from('Title\0', 'latin1'),
    Buffer.from([0, 0]), // uncompressed, method 0
    Buffer.from('en\0', 'latin1'),
    Buffer.from('Title\0', 'latin1'),
    Buffer.from('Hello 世界', 'utf8'),
  ]);
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(2835, 0);
  phys.writeUInt32BE(2835, 4);
  phys[8] = 1; // metre
  const time = Buffer.from([0x07, 0xe4, 1, 2, 3, 4, 5]); // 2020-01-02 03:04:05
  return new Uint8Array(
    Buffer.concat([
      PNG_SIG,
      pngChunk('IHDR', ihdr()),
      pngChunk('tEXt', text),
      pngChunk('zTXt', ztxt),
      pngChunk('iTXt', itxt),
      pngChunk('pHYs', phys),
      pngChunk('tIME', time),
    ]),
  );
}

afterEach(() => vi.unstubAllGlobals());

/* -------------------------------------------------------------------------- */
/*  readExif                                                                  */
/* -------------------------------------------------------------------------- */

describe('readExif', () => {
  const ifd0: TiffEntry[] = [
    { tag: 0x0112, type: 3, values: [6] }, // Orientation (inline SHORT)
    { tag: 0x010f, type: 2, values: 'Test Camera' }, // Make (offset ASCII)
    { tag: 0x0131, type: 2, values: 'A' }, // Software (inline ASCII)
    { tag: 0x013b, type: 2, values: 'Café IX' }, // Artist (offset, Latin-1)
  ];
  const exif: TiffEntry[] = [
    { tag: 0x9003, type: 2, values: '2020:01:02 03:04:05' }, // DateTimeOriginal (offset)
    { tag: 0x8827, type: 3, values: [200] }, // ISO (inline)
    { tag: 0x920a, type: 5, values: [50, 1] }, // FocalLength (offset RATIONAL)
    { tag: 0xa405, type: 3, values: [35] }, // FocalLength35mm
    { tag: 0xa434, type: 2, values: 'Lens X' }, // LensModel (offset)
  ];

  it('reads IFD0 and the Exif sub-IFD (little-endian)', () => {
    expect(readExif(toArrayBuffer(exifJpeg(true, ifd0, exif)))).toEqual({
      Orientation: 6,
      Make: 'Test Camera',
      Software: 'A',
      Artist: 'Café IX',
      DateTimeOriginal: '2020:01:02 03:04:05',
      ISO: 200,
      FocalLength: 50,
      FocalLength35mm: 35,
      LensModel: 'Lens X',
    });
  });

  it('reads the same tags from a big-endian file', () => {
    const out = readExif(toArrayBuffer(exifJpeg(false, ifd0, exif)));
    expect(out.Orientation).toBe(6);
    expect(out.Make).toBe('Test Camera');
    expect(out.FocalLength).toBe(50);
    expect(out.FocalLength35mm).toBe(35);
    expect(out.DateTimeOriginal).toBe('2020:01:02 03:04:05');
  });

  it('reads long ASCII values stored behind an offset (>4 bytes)', () => {
    const out = readExif(
      toArrayBuffer(exifJpeg(true, [{ tag: 0x0110, type: 2, values: 'Model Number 3000' }])),
    );
    expect(out.Model).toBe('Model Number 3000');
  });

  it('rounds rational values with trailing precision', () => {
    const out = readExif(
      toArrayBuffer(exifJpeg(true, [], [{ tag: 0x829d, type: 5, values: [28, 10] }])),
    );
    expect(out.FNumber).toBe(2.8);
  });

  it('returns an empty record for a JPEG without an Exif block', () => {
    expect(readExif(toArrayBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])))).toEqual({});
  });

  it('skips a non-Exif APP1 (e.g. XMP) and still finds the Exif segment', () => {
    // A well-formed APP1 segment whose payload is "http://x" (not "Exif\0\0").
    const xmp = [
      0xff, 0xe1, 0x00, 0x0a, 0x68, 0x74, 0x74, 0x70, 0x3a, 0x2f, 0x2f, 0x78,
    ];
    const exifJpegBytes = exifJpeg(true, [{ tag: 0x0112, type: 3, values: [3] }]);
    const combined = new Uint8Array([0xff, 0xd8, ...xmp, ...exifJpegBytes.slice(2)]);
    expect(readExif(toArrayBuffer(combined)).Orientation).toBe(3);
  });

  it('is safe against truncated input', () => {
    expect(readExif(toArrayBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00])))).toEqual({});
  });

  it('is safe against a malformed TIFF header or bad IFD offset', () => {
    const bogus = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x12, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0x58, 0x58, // invalid byte order
      0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0xff, 0xd9,
    ]);
    expect(readExif(toArrayBuffer(bogus))).toEqual({});
    expect(() => readExif(toArrayBuffer(new Uint8Array([0xff, 0xd8])))).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*  decodePngChunks                                                           */
/* -------------------------------------------------------------------------- */

describe('decodePngChunks', () => {
  it('extracts IHDR, tEXt, zTXt, iTXt, pHYs and tIME metadata', () => {
    const meta = decodePngChunks(toArrayBuffer(richPng()));
    expect(meta['Bit depth']).toBe('8 bit');
    expect(meta['Colour type']).toBe('Truecolour + alpha');
    expect(meta.Author).toBe('Claude');
    expect(meta.Comment).toBe('Compressed value');
    expect(meta.Title).toBe('Hello 世界');
    expect(meta['Pixel density']).toBe('2835×2835 px/m (≈72×72 dpi)');
    expect(meta.Modified).toBe('2020-01-02 03:04:05');
  });

  it('reports unspecified pixel density without a dpi conversion', () => {
    const phys = Buffer.alloc(9);
    phys.writeUInt32BE(72, 0);
    phys.writeUInt32BE(72, 4);
    phys[8] = 0; // unit unspecified
    const bytes = Buffer.concat([PNG_SIG, pngChunk('IHDR', ihdr()), pngChunk('pHYs', phys)]);
    expect(decodePngChunks(toArrayBuffer(new Uint8Array(bytes)))['Pixel density']).toBe('72×72 px');
  });

  it('returns an empty record for a non-PNG header', () => {
    expect(decodePngChunks(toArrayBuffer(new Uint8Array([1, 2, 3, 4])))).toEqual({});
  });

  it('stops safely on a truncated or over-long chunk', () => {
    const malformed = Buffer.concat([
      PNG_SIG,
      pngChunk('IHDR', ihdr()),
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x74, 0x45, 0x58, 0x74]), // bogus huge tEXt length
    ]);
    expect(() => decodePngChunks(toArrayBuffer(new Uint8Array(malformed)))).not.toThrow();
    expect(decodePngChunks(toArrayBuffer(new Uint8Array(malformed)))).toEqual({
      'Bit depth': '8 bit',
      'Colour type': 'Truecolour + alpha',
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  image-metadata run                                                        */
/* -------------------------------------------------------------------------- */

function stubBitmap(width = 4000, height = 3000) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })));
  return close;
}

function rowsOf(output: string): [string, string][] {
  return (JSON.parse(output) as { rows: [string, string][] }).rows;
}

describe('image-metadata run', () => {
  it('rejects an empty selection', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose an image file/i);
  });

  it('rejects a non-image file', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(/not an image/i);
  });

  it('throws a friendly decode error for undecodable image files', async () => {
    const file = new File(['not a real image'], 'image.png', { type: 'image/png' });
    await expect(tool.run({ files: [file], options: {} })).rejects.toThrow(
      /not be decoded as an image/i,
    );
  });

  it('reports file details, dimensions, EXIF tags and orientation meaning', async () => {
    const close = stubBitmap();
    const bytes = exifJpeg(true, [
      { tag: 0x0112, type: 3, values: [6] },
      { tag: 0x010f, type: 2, values: 'Café Caméra' },
    ]);
    const file = new File([toArrayBuffer(bytes)], 'фото.jpg', { type: 'image/jpeg' });
    const result = await tool.run({ files: [file], options: {} });
    const rows = rowsOf(result.report!.output);

    expect(rows).toContainEqual(['Filename', 'фото.jpg']);
    expect(rows).toContainEqual(['MIME type', 'image/jpeg']);
    expect(rows).toContainEqual(['Pixel dimensions', '4000 × 3000']);
    expect(rows).toContainEqual(['Orientation', '6']);
    expect(rows).toContainEqual(['Orientation (meaning)', 'Rotated 90° clockwise']);
    expect(rows).toContainEqual(['Make', 'Café Caméra']);
    expect(result.stats).toMatchObject({ tags: rows.length });
    expect(close).toHaveBeenCalled();
  });

  it('reports PNG chunk metadata', async () => {
    stubBitmap(2, 1);
    const file = new File([toArrayBuffer(richPng())], 'диаграмма.png', { type: 'image/png' });
    const result = await tool.run({ files: [file], options: {} });
    const rows = rowsOf(result.report!.output);
    expect(rows).toContainEqual(['Author', 'Claude']);
    expect(rows).toContainEqual(['Title', 'Hello 世界']);
    expect(rows).toContainEqual(['Pixel density', '2835×2835 px/m (≈72×72 dpi)']);
    expect(result.report).toMatchObject({ render: 'table' });
  });

  it('emits progress and honours an aborted signal', async () => {
    stubBitmap();
    const progress: number[] = [];
    const file = new File([toArrayBuffer(exifJpeg(true, []))], 'a.jpg', { type: 'image/jpeg' });
    await tool.run({ files: [file], options: {}, onProgress: (f) => progress.push(f) });
    expect(progress.at(0)).toBe(0);
    expect(progress.at(-1)).toBe(1);

    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.run({ files: [file], options: {}, signal: controller.signal }),
    ).rejects.toThrow(/cancel/i);
  });
});
