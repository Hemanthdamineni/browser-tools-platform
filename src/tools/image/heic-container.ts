/**
 * Pure ISO-BMFF / HEIF container inspection.
 *
 * HEIC files are ISO base media files: a tree of boxes, the first of which is
 * usually `ftyp` ("file type"). The major and compatible brands inside that
 * box say what the file actually holds — `heic` for HEVC-coded HEIF, `avif`
 * for AV1, `mif1` for a generic HEIF container.
 *
 * Nothing in this module touches the DOM, `fetch` or the WebAssembly decoder,
 * so it can be unit-tested on its own and reused by the decoder.
 */

/** Brands that identify a HEIC image (HEVC coded). */
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);
/** Brands that identify a generic HEIF container (HEVC, AV1, JPEG …). */
const HEIF_BRANDS = new Set(['mif1', 'msf1']);
/** Brands that identify an AVIF image — a different format, not HEIC. */
const AVIF_BRANDS = new Set(['avif', 'avis']);

/** Largest HEIC we are willing to decode in one go (bytes). */
export const MAX_HEIC_BYTES = 64 * 1024 * 1024;

/** What a file's ISO-BMFF `ftyp` box says it is. */
export type HeifContainer = 'heic' | 'heif' | 'avif' | 'unknown';

export interface FtypBox {
  /** The major brand, e.g. `heic`. */
  majorBrand: string;
  /** Every compatible brand listed in the box. */
  compatibleBrands: string[];
}

interface BoxHeader {
  /** The four-character box type, e.g. `ftyp`. */
  type: string;
  /** Total length of the box in bytes, header included. */
  size: number;
}

/** Read a big-endian uint32, tolerating short buffers. */
function readUint32(bytes: Uint8Array, offset: number): number {
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  const b2 = bytes[offset + 2] ?? 0;
  const b3 = bytes[offset + 3] ?? 0;
  return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
}

/** Read a 4-character box type / brand. */
function readType(bytes: Uint8Array, offset: number): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += String.fromCharCode(bytes[offset + i] ?? 0);
  return out;
}

/**
 * Read the box header at `offset`.
 *
 * A size of `1` means the real 64-bit length follows the type; a size of `0`
 * means the box runs to the end of the file. Returns `null` when the buffer
 * ends early or the length is nonsense.
 */
function readBoxHeader(bytes: Uint8Array, offset: number): BoxHeader | null {
  if (offset + 8 > bytes.length) return null;
  const type = readType(bytes, offset + 4);
  let size = readUint32(bytes, offset);

  if (size === 1) {
    if (offset + 16 > bytes.length) return null;
    const high = readUint32(bytes, offset + 8);
    const low = readUint32(bytes, offset + 12);
    size = high * 0x1_0000_0000 + low;
    if (!Number.isSafeInteger(size)) return null;
  } else if (size === 0) {
    size = bytes.length - offset;
  }

  if (size < 8) return null;
  return { type, size };
}

/**
 * Find and parse the `ftyp` box of an ISO-BMFF file (HEIF, HEIC, AVIF …).
 *
 * The box is normally first, but a few muxers put another box in front of
 * it, so the first few boxes are scanned. Returns `null` when the file has no
 * `ftyp` box at all — i.e. it is not a HEIF-family file.
 */
export function readFtypBox(bytes: Uint8Array): FtypBox | null {
  let offset = 0;
  for (let box = 0; box < 16; box++) {
    const header = readBoxHeader(bytes, offset);
    if (!header) return null;
    if (header.type === 'ftyp') {
      // size(4) + type(4) + major_brand(4) + minor_version(4) = 16 bytes.
      if (offset + 12 > bytes.length) return null;
      const majorBrand = readType(bytes, offset + 8);
      const compatibleBrands: string[] = [];
      const end = Math.min(bytes.length, offset + header.size);
      for (let p = offset + 16; p + 4 <= end; p += 4) {
        const brand = readType(bytes, p);
        // Trailing padding is written as NUL bytes, not as a brand.
        if (!brand.includes('\0')) compatibleBrands.push(brand);
      }
      return { majorBrand, compatibleBrands };
    }
    offset += header.size;
  }
  return null;
}

/** Work out which HEIF-family format a file is, from its `ftyp` box. */
export function detectContainer(bytes: Uint8Array): HeifContainer {
  const ftyp = readFtypBox(bytes);
  if (!ftyp) return 'unknown';
  const brands = [ftyp.majorBrand, ...ftyp.compatibleBrands];
  if (brands.some((brand) => HEIC_BRANDS.has(brand))) return 'heic';
  if (brands.some((brand) => AVIF_BRANDS.has(brand))) return 'avif';
  if (brands.some((brand) => HEIF_BRANDS.has(brand))) return 'heif';
  return 'unknown';
}
