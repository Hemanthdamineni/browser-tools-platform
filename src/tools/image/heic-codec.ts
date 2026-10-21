/**
 * HEIC/HEIF decoding, powered by `libheif` compiled to WebAssembly.
 *
 * The decoder is far too big for the main bundle, so it is loaded on demand:
 *
 *   - the ~90 kB Emscripten glue is pulled in with a dynamic `import()` the
 *     first time a file is decoded, and
 *   - the ~1.4 MB WASM binary is fetched from this origin
 *     (`public/vendor/libheif/libheif.wasm`, copied from `node_modules`).
 *
 * Nothing is ever requested from a third party, and the decoder only ever
 * sees the bytes of the file the visitor picked.
 *
 * The pure parts (ISO-BMFF `ftyp` parsing, container detection) live here so
 * they can be unit-tested without a browser or the WASM binary.
 */
import { ToolError } from '@/lib/types';

/** Brands that identify a HEIC image (HEVC coded). */
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);
/** Brands that identify a generic HEIF container (HEVC, AV1, JPEG …). */
const HEIF_BRANDS = new Set(['mif1', 'msf1']);
/** Brands that identify an AVIF image — a different format, not HEIC. */
const AVIF_BRANDS = new Set(['avif', 'avis']);

/** Largest HEIC we are willing to decode in one go (bytes). */
export const MAX_HEIC_BYTES = 64 * 1024 * 1024;

/**
 * Same-origin URL of the WASM binary. `BASE_URL` always ends in a slash, so
 * this keeps working when the site is deployed under a sub-path.
 */
export const HEIC_WASM_URL = `${import.meta.env.BASE_URL}vendor/libheif/libheif.wasm`;

/** What a file's ISO-BMFF `ftyp` box says it is. */
export type HeifContainer = 'heic' | 'heif' | 'avif' | 'unknown';

export interface FtypBox {
  /** The major brand, e.g. `heic`. */
  majorBrand: string;
  /** Every compatible brand listed in the box. */
  compatibleBrands: string[];
}

/** Read a big-endian uint32, tolerating short buffers. */
function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

/** Read a 4-character box type / brand. */
function readType(bytes: Uint8Array, offset: number): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += String.fromCharCode(bytes[offset + i] ?? 0);
  return out;
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
  for (let box = 0; box < 8; box++) {
    if (offset + 8 > bytes.length) return null;
    const size = readUint32(bytes, offset);
    const type = readType(bytes, offset + 4);
    if (type === 'ftyp') {
      const majorBrand = readType(bytes, offset + 8);
      const compatibleBrands: string[] = [];
      // A size of 0 means "until the end of the file".
      const end = Math.min(bytes.length, offset + (size > 0 ? size : bytes.length - offset));
      for (let p = offset + 16; p + 4 <= end; p += 4) {
        const brand = readType(bytes, p);
        // Trailing padding is written as NUL bytes, not as a brand.
        if (!brand.includes('\0')) compatibleBrands.push(brand);
      }
      return { majorBrand, compatibleBrands };
    }
    // size === 1 means a 64-bit size follows; we do not support those.
    if (size < 8) return null;
    offset += size;
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

/* -------------------------------------------------------------------------- */
/*  The decoder itself                                                         */
/* -------------------------------------------------------------------------- */

/** One image inside a HEIF container. */
interface HeifImageHandle {
  get_width(): number;
  get_height(): number;
  has_alpha_channel(): boolean;
  display(
    target: { data: Uint8ClampedArray; width: number; height: number },
    done: (result: unknown) => void,
  ): void;
}

interface HeifDecoderInstance {
  decode(bytes: Uint8Array): HeifImageHandle[];
}

interface HeifModule {
  HeifDecoder: new () => HeifDecoderInstance;
}

/** The Emscripten factory: `factory({ wasmBinary })` returns the module. */
type HeifFactory = (options?: { wasmBinary?: ArrayBuffer }) => HeifModule;

/** A decoded HEIC image, ready to be drawn onto a canvas. */
export interface DecodedHeic {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8ClampedArray;
  /** True when the source carried an alpha channel. */
  hasAlpha: boolean;
}

let modulePromise: Promise<HeifModule> | null = null;

/** Fetch the WASM binary from this origin. */
async function fetchWasmBinary(): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(HEIC_WASM_URL);
  } catch {
    throw new ToolError(
      'The HEIC decoder could not be downloaded.',
      'Check your connection and try again — everything else runs offline.',
    );
  }
  if (!response.ok) {
    throw new ToolError(
      'The HEIC decoder could not be downloaded.',
      `Expected it at ${HEIC_WASM_URL} (HTTP ${response.status}).`,
    );
  }
  return response.arrayBuffer();
}

/**
 * Load (and cache) the libheif module.
 *
 * The glue code is a dynamic import, so it lands in its own chunk and is
 * never part of the site's main bundle; the WASM binary is a separate asset
 * fetched from this origin.
 */
export function loadHeifModule(): Promise<HeifModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const [glue, wasmBinary] = await Promise.all([
        import('libheif-js/libheif-wasm/libheif.js'),
        fetchWasmBinary(),
      ]);
      const factory = (glue as { default: unknown }).default as unknown as HeifFactory | undefined;
      if (typeof factory !== 'function') {
        throw new ToolError('The HEIC decoder could not be loaded.', 'Try reloading the page.');
      }
      return factory({ wasmBinary });
    })().catch((err: unknown) => {
      // Let a later run try again instead of caching the failure forever.
      modulePromise = null;
      throw err;
    });
  }
  return modulePromise;
}

/** Message used for every "this file cannot be decoded" case. */
const UNDECODABLE = 'That HEIC file could not be decoded.';
const UNDECODABLE_HINT =
  'It may be corrupt, truncated, or use an HEVC profile this decoder does not support.';

/**
 * Decode a HEIC/HEIF file into RGBA pixels.
 *
 * Throws a `ToolError` for anything the visitor can act on: a file that is
 * not HEIF at all, an AVIF file, or bytes libheif refuses to decode.
 */
export async function decodeHeic(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<DecodedHeic> {
  const container = detectContainer(bytes);
  if (container === 'avif') {
    throw new ToolError(
      'That file is an AVIF image, not a HEIC image.',
      'Use the Image Converter for AVIF files — every modern browser reads them directly.',
    );
  }
  if (container === 'unknown') {
    throw new ToolError(
      'That file is not a HEIC or HEIF image.',
      'HEIC files start with an "ftyp" box. Check that you picked the original photo, not a renamed JPEG.',
    );
  }

  const libheif = await loadHeifModule();
  signal?.throwIfAborted?.();

  const decoder = new libheif.HeifDecoder();
  let images: HeifImageHandle[] = [];
  try {
    images = decoder.decode(bytes);
  } catch {
    throw new ToolError(UNDECODABLE, UNDECODABLE_HINT);
  }

  const image = images[0];
  if (!image) throw new ToolError(UNDECODABLE, UNDECODABLE_HINT);

  const width = image.get_width();
  const height = image.get_height();
  if (!(width > 0) || !(height > 0)) {
    throw new ToolError(UNDECODABLE, UNDECODABLE_HINT);
  }

  const target = { data: new Uint8ClampedArray(width * height * 4), width, height };
  const decoded = await new Promise<boolean>((resolve) => {
    try {
      image.display(target, (result) => resolve(Boolean(result)));
    } catch {
      resolve(false);
    }
  });
  if (!decoded) throw new ToolError(UNDECODABLE, UNDECODABLE_HINT);

  return { width, height, data: target.data, hasAlpha: image.has_alpha_channel() };
}
