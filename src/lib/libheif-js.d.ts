/**
 * Minimal hand-written types for the parts of `libheif-js` we use.
 *
 * The package ships its Emscripten build as plain JavaScript with no `.d.ts`
 * beside the pre-bundled ES module, so TypeScript would otherwise refuse the
 * dynamic import. Only the three surfaces HEIC decoding needs are declared
 * here — keep this file in sync with `heic-to-jpg.tool.ts`.
 */
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  /** RGBA buffer that `HeifImage.display` paints into. */
  export interface HeifDisplayTarget {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  }

  /** A single still image inside a HEIF/HEIC container. */
  export interface HeifImageHandle {
    /** Width in pixels, with HEIF rotation/mirroring already applied. */
    get_width(): number;
    /** Height in pixels, with HEIF rotation/mirroring already applied. */
    get_height(): number;
    /** Whether the item carries an alpha channel. */
    has_alpha_channel(): boolean;
    /** Whether this is the container's primary image. */
    is_primary(): boolean;
    /** Release the underlying wasm handle. */
    free(): void;
    /** Decode this item as straight (non-premultiplied) RGBA. */
    display(target: HeifDisplayTarget, callback: (result: HeifDisplayTarget | null) => void): void;
  }

  export interface HeifDecoderInstance {
    /** Decode a container into its top-level images; `[]` when unreadable. */
    decode(bytes: Uint8Array): HeifImageHandle[];
  }

  export interface LibheifModule {
    HeifDecoder: new () => HeifDecoderInstance;
  }

  /** The Emscripten module factory (the bundle's default export). */
  const createLibheif: (options?: Record<string, unknown>) => Promise<LibheifModule>;
  export default createLibheif;
}
