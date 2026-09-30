import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { checkAbort, checkFiles } from './common';
import { meta } from './image-metadata.meta';

/** TIFF tag → [friendly name, IFD type number]. */
const TIFF_TAGS: Record<number, [string, number]> = {
  0x010f: ['Make', 2], // ascii
  0x0110: ['Model', 2], // ascii
  0x0112: ['Orientation', 3], // uint16
  0x011a: ['XResolution', 5], // rational
  0x011b: ['YResolution', 5], // rational
  0x0132: ['DateTime', 2], // ascii
  0x8298: ['Copyright', 2], // ascii
  0x829a: ['ExposureTime', 5], // rational
  0x829d: ['FNumber', 5], // rational
  0x8827: ['ISO', 3], // uint16
  0x920a: ['FocalLength', 5], // rational
  0xa434: ['LensModel', 2], // ascii
  0x9003: ['DateTimeOriginal', 2], // ascii (Exif IFD)
};

/** Bytes-per-value for the IFD types we understand. */
function typeSize(type: number): number {
  switch (type) {
    case 1: // BYTE
    case 2: // ASCII
    case 6: // SBYTE
    case 7: // UNDEFINED
      return 1;
    case 3: // SHORT
    case 8: // SSHORT
      return 2;
    case 4: // LONG
    case 9: // SLONG
    case 11: // FLOAT
      return 4;
    case 5: // RATIONAL
    case 10: // SRATIONAL
    case 12: // DOUBLE
      return 8;
    default:
      return 1;
  }
}

interface ValueReader {
  readonly u8: (a: number) => number;
  readonly u16: (a: number) => number;
  readonly u32: (a: number) => number;
}

/** Read a single IFD value at absolute offset `off`. */
function readIfdValue(buf: ArrayBuffer, r: ValueReader, off: number, type: number, count: number): string | number {
  const raw = new Uint8Array(buf);
  if (type === 2 || type === 7) {
    // ASCII / UNDEFINED — return the text up to the first NUL.
    let s = '';
    for (let i = 0; i < count && off + i < raw.length; i++) {
      const c = raw[off + i];
      if (c === undefined || c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }
  const valueAt = (p: number): number => {
    if (p < 0 || p + 8 > raw.length) return 0;
    switch (type) {
      case 1:
      case 6:
      case 7:
        return r.u8(p);
      case 3:
      case 8:
        return r.u16(p);
      case 4:
      case 9:
      case 11:
        return r.u32(p);
      case 5:
      case 10: {
        const denom = r.u32(p + 4);
        return denom ? Math.round((r.u32(p) / denom) * 1000) / 1000 : 0;
      }
      case 12:
        return Math.round(r.u32(p) / Math.max(1, r.u32(p + 4)) * 1000) / 1000;
      default:
        return 0;
    }
  };
  const totalBytes = count * typeSize(type);
  // Value fits inline when it occupies ≤ 4 bytes; otherwise it is an offset.
  return totalBytes <= 4 ? valueAt(off) : valueAt(r.u32(off));
}

/**
 * Parse JPEG APP1 "Exif\0\0" TIFF metadata and return a record of known tags.
 * Returns an empty object when no readable EXIF block is present — callers can
 * then rely on the basic rows.
 */
export function readExif(buf: ArrayBuffer): Record<string, string | number> {
  const d = new DataView(buf);
  const out: Record<string, string | number> = {};

  // Walk the JPEG segment list looking for an APP1 (0xff 0xe1) Exif segment.
  let o = 0;
  while (o + 4 <= buf.byteLength) {
    if (d.getUint8(o) !== 0xff || d.getUint8(o + 1) === 0xff) {
      o++;
      // Skip a potential 0xff padding byte so we still land on a marker.
      if (d.getUint8(o) === 0xff && o + 1 < buf.byteLength) o++;
      continue;
    }
    const marker = d.getUint8(o + 1);
    if (marker === 0xd8 || marker === 0xd9) {
      // SOI / EOI — not a length-carrying segment.
      o += 2;
      continue;
    }
    if (marker === 0xda) break; // start of scan — no more metadata segments
    const segLen = d.getUint16(o + 2);
    if (segLen < 2) break;
    if (marker === 0xe1) {
      // Check the Exif header: "Exif\0\0".
      let isExif = true;
      const exifSig = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
      for (let i = 0; i < exifSig.length; i++) {
        if (buf.byteLength <= o + 4 + i || d.getUint8(o + 4 + i) !== exifSig[i]) {
          isExif = false;
          break;
        }
      }
      if (isExif) {
        const t = o + 10; // start of TIFF header inside the APP1 payload
        if (t + 8 > buf.byteLength) break;
        const endian = d.getUint8(t);
        const le = endian === 0x49; // 'I' → little-endian
        const r: ValueReader = {
          u8: (a) => d.getUint8(a),
          u16: (a) => d.getUint16(a, le),
          u32: (a) => d.getUint32(a, le),
        };
        if (r.u16(t + 2) !== 42) break; // not a TIFF header
        const ifd0Offset = r.u32(t + 4);
        const ifd0 = t + ifd0Offset;
        if (!Number.isFinite(ifd0) || ifd0 < 0 || ifd0 + 2 > buf.byteLength) break;

        const entries = r.u16(ifd0);
        let p = ifd0 + 2;
        for (let i = 0; i < entries && p + 12 <= buf.byteLength; i++) {
          const tag = r.u16(p);
          const type = r.u16(p + 2);
          const count = r.u32(p + 4);
          const def = TIFF_TAGS[tag];
          if (def && (def[1] === type || (def[1] === 3 && type === 3) || (def[1] === 2 && type === 2) || (def[1] === 5 && (type === 5 || type === 10)))) {
            out[def[0]] = readIfdValue(buf, r, p + 8, type, count);
          }
          p += 12;
        }

        // Follow the "next IFD" offset pointer to the Exif IFD.
        const next = r.u32(ifd0 + 2 + entries * 12);
        if (next && t + next + 2 <= buf.byteLength) {
          const exif = t + next;
          const n2 = r.u16(exif);
          let q = exif + 2;
          for (let i = 0; i < n2 && q + 12 <= buf.byteLength; i++) {
            const eifd = r.u16(q);
            if (eifd === 0x9003) {
              out.DateTimeOriginal = readIfdValue(buf, r, q + 8, r.u16(q + 2), r.u32(q + 4));
            } else if (eifd === 0x8827) {
              out.ISO = readIfdValue(buf, r, q + 8, r.u16(q + 2), r.u32(q + 4));
            } else if (eifd === 0x920a) {
              out.FocalLength = readIfdValue(buf, r, q + 8, r.u16(q + 2), r.u32(q + 4));
            } else if (eifd === 0xa405) {
              out.LensModel = readIfdValue(buf, r, q + 8, r.u16(q + 2), r.u32(q + 4));
            }
            q += 12;
          }
        }
      }
    }
    o += 2 + segLen;
  }
  return out;
}

/** Parse selected PNG chunk metadata (pHYs, tEXt, iTXt, tIME). */
export function decodePngChunks(buf: ArrayBuffer): Record<string, string | number> {
  const d = new Uint8Array(buf);
  const out: Record<string, string | number> = {};
  if (d.length < 24 || d[0] !== 137 || d[1] !== 80 || d[2] !== 78 || d[3] !== 71) return out;

  const u32 = (o: number): number =>
    ((d[o]! << 24) >>> 0) | ((d[o + 1]! << 16) >>> 0) | ((d[o + 2]! << 8) >>> 0) | d[o + 3]!;

  let o = 8;
  while (o + 8 <= d.length) {
    const len = u32(o);
    const type = String.fromCharCode(d[o + 4]!, d[o + 5]!, d[o + 6]!, d[o + 7]!);
    const start = o + 8;
    const dataEnd = start + len;
    if (!Number.isSafeInteger(dataEnd) || dataEnd > d.length) break; // truncated chunk — stop safely

    if (type === 'pHYs' && len >= 8) {
      const x = u32(start);
      const y = u32(start + 4);
      out['Pixel density'] = `${x}×${y} ppu`;
    } else if (type === 'tEXt') {
      let nul = -1;
      for (let i = start; i < dataEnd; i++) {
        if (d[i] === 0) { nul = i; break; }
      }
      if (nul !== -1) {
        const key = new TextDecoder().decode(d.slice(start, nul));
        const value = new TextDecoder().decode(d.slice(nul + 1, dataEnd));
        out[key] = value;
      }
    } else if (type === 'iTXt') {
      let nul = -1;
      for (let i = start; i < dataEnd; i++) {
        if (d[i] === 0) { nul = i; break; }
      }
      if (nul !== -1) {
        const key = new TextDecoder().decode(d.slice(start, nul));
        out[key] = `iTXt: ${len} bytes`;
      }
    } else if (type === 'tIME' && len >= 7) {
      const year = d[start]! + 2000;
      const month = String(d[start + 1]!).padStart(2, '0');
      const day = String(d[start + 2]!).padStart(2, '0');
      const hour = String(d[start + 3]!).padStart(2, '0');
      const minute = String(d[start + 4]!).padStart(2, '0');
      const second = String(d[start + 5]!).padStart(2, '0');
      out.Modified = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    o = dataEnd + 4; // skip CRC
    if (type === 'IEND') break;
  }
  return out;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  checkFiles(input.files);
  const f = input.files[0]!;
  checkAbort(input.signal);
  input.onProgress?.(0, 'Reading metadata');
  const buf = await f.arrayBuffer();

  const rows: [string, string][] = [
    ['Filename', f.name],
    ['MIME type', f.type],
    ['File size', `${f.size} bytes`],
  ];

  try {
    const b = await createImageBitmap(f);
    rows.push(['Pixel dimensions', `${b.width} × ${b.height}`]);
    b.close();
  } catch {
    throw new ToolError(
      'That file could not be decoded as an image.',
      'Check that it is a valid PNG, JPEG, WebP, GIF or BMP file.',
    );
  }

  if (f.type === 'image/jpeg') {
    const ex = readExif(buf);
    for (const [k, v] of Object.entries(ex)) rows.push([k, String(v)]);
  } else if (f.type === 'image/png') {
    const png = decodePngChunks(buf);
    for (const [k, v] of Object.entries(png)) rows.push([k, String(v)]);
  }

  input.onProgress?.(1, 'Done');
  return {
    outputs: [],
    report: { output: JSON.stringify({ headers: ['Tag', 'Value'], rows }), render: 'table' },
    stats: { tags: rows.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
