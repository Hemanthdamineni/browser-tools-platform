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
 * The pure parts (ISO-BMFF `ftyp` parsing, container detection) live in
 * `./heic-container` so they can be unit-tested without a browser or the
 * WebAssembly binary.
 */
import { ToolError } from '@/lib/types';
import { detectContainer } from './heic-container';

export { detectContainer, readFtypBox, MAX_HEIC_BYTES } from './heic-container';
export type { FtypBox, HeifContainer } from './heic-container';

/**
 * Same-origin URL of the WASM binary. `BASE_URL` always ends in a slash, so
 * this keeps working when the site is deployed under a sub-path.
 */
export const HEIC_WASM_URL = `${import.meta.env.BASE_URL}vendor/libheif/libheif.wasm`;

/** One image inside a HEIF container. */
interface HeifImageHandle {
  /** The `heif_image_handle` the decoder works with. */
  handle: unknown;
}

/** One decoded plane of an image. */
interface HeifChannel {
  /** The channel id; the interleaved RGBA plane is the one we want. */
  id: unknown;
  /** Plane width in pixels. */
  width: number;
  /** Plane height in pixels. */
  height: number;
  /** Bytes per row, which can be larger than `width * 4`. */
  stride: number;
  /** The plane bytes, RGBA, `stride * height` long. */
  data: Uint8Array;
}

/** The result of `heif_js_decode_image2`. */
interface HeifDecodedImage {
  /** Set when the decode failed. */
  code?: unknown;
  image?: unknown;
  channels?: HeifChannel[];
}

interface HeifDecoderInstance {
  decode(bytes: Uint8Array): HeifImageHandle[];
}

interface HeifModule {
  HeifDecoder: new () => HeifDecoderInstance;
  /** Decode one handle into its planes, applying the container's transforms. */
  heif_js_decode_image2(
    handle: unknown,
    colorspace: unknown,
    chroma: unknown,
  ): HeifDecodedImage | Promise<HeifDecodedImage>;
  /** The enum values the module exposes at its root. */
  heif_colorspace_RGB: unknown;
  heif_chroma_interleaved_RGBA: unknown;
  heif_channel_interleaved: unknown;
  /** Free a decoded image. */
  heif_image_release(image: unknown): void;
}

/** The Emscripten factory: `factory({ wasmBinary })` returns the module. */
type HeifFactory = (options?: { wasmBinary?: ArrayBuffer }) => HeifModule;

/** A decoded HEIC image, ready to be drawn onto a canvas. */
export interface DecodedHeic {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8ClampedArray;
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
 * The Emscripten glue reads `document.currentScript.src` to work out where
 * its own assets live. Inside a bundled ES module that is `null`, so the glue
 * would throw before it ever looks at the WebAssembly binary we hand it.
 *
 * Give it the page URL instead. The binary is passed in explicitly, so the
 * path is only ever used for diagnostics. (In the Web Worker — where the
 * decoding actually happens — the glue never looks at `document` at all.)
 */
function provideCurrentScript(): void {
  if (typeof document === 'undefined' || document.currentScript) return;
  try {
    Object.defineProperty(document, 'currentScript', {
      value: { src: document.baseURI },
      configurable: true,
    });
  } catch {
    /* A frozen document is fine: the factory reports the failure below. */
  }
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
      // The glue and the binary are independent, so fetch them at the same
      // time. A failed import is turned into a friendly error below instead
      // of bubbling up as a bundler message.
      const gluePromise = import('libheif-js/libheif-wasm/libheif.js').catch(() => null);
      const wasmBinary = await fetchWasmBinary();
      const glue = await gluePromise;
      const factory = (glue as { default?: unknown } | null)?.default as HeifFactory | undefined;
      if (typeof factory !== 'function') {
        throw new ToolError('The HEIC decoder could not be loaded.', 'Try reloading the page.');
      }
      provideCurrentScript();
      try {
        return factory({ wasmBinary });
      } catch {
        throw new ToolError(
          'The HEIC decoder could not be started.',
          'Your browser may not support WebAssembly — try a recent Chrome, Edge, Firefox or Safari.',
        );
      }
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
 * Copy a decoded interleaved plane into a tightly packed RGBA buffer.
 *
 * The plane's rows can be padded (`stride` is larger than `width * 4`), so the
 * rows are copied one by one. The plane dimensions are the *decoded* ones —
 * they already have the container's rotation and crop applied, which is not
 * necessarily what the item signalled.
 */
export function packInterleaved(
  data: Uint8Array,
  width: number,
  height: number,
  stride: number,
): Uint8ClampedArray {
  const rowBytes = width * 4;
  const out = new Uint8ClampedArray(width * height * 4);
  if (stride === rowBytes) {
    out.set(data.subarray(0, out.length));
    return out;
  }
  // A malformed plane with a stride below the row size is copied as far as it
  // goes rather than throwing.
  const copyBytes = Math.min(rowBytes, stride);
  for (let row = 0; row < height; row++) {
    const from = row * stride;
    out.set(data.subarray(from, from + copyBytes), row * rowBytes);
  }
  return out;
}

/**
 * Decode a HEIC/HEIF file into RGBA pixels.
 *
 * Throws a `ToolError` for anything the visitor can act on: a file that is
 * not HEIF at all, an AVIF file, or bytes libheif refuses to decode.
 */
export async function decodeHeic(bytes: Uint8Array, signal?: AbortSignal): Promise<DecodedHeic> {
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

  let decoded: HeifDecodedImage;
  try {
    decoded = await libheif.heif_js_decode_image2(
      image.handle,
      libheif.heif_colorspace_RGB,
      libheif.heif_chroma_interleaved_RGBA,
    );
  } catch {
    throw new ToolError(UNDECODABLE, UNDECODABLE_HINT);
  }
  if (!decoded || decoded.code) throw new ToolError(UNDECODABLE, UNDECODABLE_HINT);

  const channel = (decoded.channels ?? []).find(
    (candidate) => candidate.id === libheif.heif_channel_interleaved,
  );
  if (!channel || !(channel.width > 0) || !(channel.height > 0)) {
    throw new ToolError(UNDECODABLE, UNDECODABLE_HINT);
  }

  const data = packInterleaved(channel.data, channel.width, channel.height, channel.stride);
  // The planes live in the WebAssembly heap; give them back now that the
  // pixels have been copied out.
  if (decoded.image !== undefined) {
    try {
      libheif.heif_image_release(decoded.image);
    } catch {
      /* nothing to release */
    }
  }

  return { width: channel.width, height: channel.height, data };
}
