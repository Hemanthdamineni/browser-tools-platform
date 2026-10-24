/**
 * Minimal type surface for `@jitsi/rnnoise-wasm` (Apache-2.0).
 *
 * The package ships plain Emscripten glue (`dist/rnnoise.js`), a separate
 * `dist/rnnoise.wasm` binary and a sync loader with the wasm inlined as base64.
 * Only the part `noise-reduction` uses is declared: the async module factory,
 * the four exported entry points and the two heap views.
 *
 * The `.wasm` is pulled in with Vite's `?url` suffix, so the binary is emitted
 * as an asset of this site and fetched from this origin by the glue — see
 * `noise-reduction-panel.ts`.
 */
declare module '@jitsi/rnnoise-wasm/dist/rnnoise.js' {
  /** The Emscripten module instance, as far as this tool can observe it. */
  export interface RNNoiseModule {
    /** Allocate `size` bytes on the module heap; returns a byte offset. */
    _malloc(size: number): number;
    /** Release a pointer returned by `_malloc`. */
    _free(ptr: number): void;
    /**
     * Create a denoiser state. `model` is 0 for the default (bundled) model.
     * Returns a pointer, or 0 when allocation failed.
     */
    _rnnoise_create(model: number): number;
    /** Initialise an existing state with a model (unused here; kept for completeness). */
    _rnnoise_init(state: number, model: number): void;
    /**
     * Denoise one 480-sample frame.
     * `input` and `output` are pointers to 480 `float` values. Returns the
     * voice-activity probability (0 = noise, 1 = speech) for the frame.
     */
    _rnnoise_process_frame(state: number, output: number, input: number): number;
    /** Destroy a state created with `_rnnoise_create`. */
    _rnnoise_destroy(state: number): void;
    /** Byte view of the module heap (offsets are byte addresses). */
    HEAPU8: Uint8Array;
    /** Float32 view of the module heap (element index = byte offset / 4). */
    HEAPF32: Float32Array;
  }

  export interface RNNoiseInitOptions {
    /** Resolve a module file name (here `rnnoise.wasm`) to a fetchable URL. */
    locateFile: (file: string) => string;
  }

  /** The async (wasm fetched at runtime) module factory. */
  const createRNNWasmModule: (options: RNNoiseInitOptions) => Promise<RNNoiseModule>;
  export default createRNNWasmModule;
}

/**
 * The `rnnoise.wasm` binary imported with Vite's `?url` suffix: the bundler
 * emits it as an asset of this site and hands back the URL to fetch it from.
 */
declare module '@jitsi/rnnoise-wasm/dist/rnnoise.wasm?url' {
  const url: string;
  export default url;
}
