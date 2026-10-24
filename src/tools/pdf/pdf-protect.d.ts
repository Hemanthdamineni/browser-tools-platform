/**
 * Minimal type surface for `@jspawn/qpdf-wasm` (Apache-2.0).
 *
 * The package ships plain JavaScript — the Emscripten glue plus a 1.3 MB
 * `qpdf.wasm` — so only the part `pdf-protect` uses is declared: the module
 * factory, its options, and the two in-memory-file-system calls the engine
 * makes. The shapes are written in terms of the core's own interfaces so that
 * the declaration and `pdf-protect.core.ts` cannot drift apart.
 *
 * The tool imports `qpdf.js` (the package's `main`, CommonJS) rather than the
 * `qpdf.mjs` wrapper: the wrapper resolves its factory from a `globalThis`
 * object that Rollup's CommonJS interop rewrites, so it cannot be used from a
 * bundled app. See `pdf-protect.qpdf.ts`.
 */
declare module '@jspawn/qpdf-wasm/qpdf.js' {
  import type { QpdfModule } from './pdf-protect.core';

  /**
   * The options this build understands. There is deliberately no `print` /
   * `printErr` here: the glue binds `console.log` / `console.warn` instead, so
   * `withStderrCapture` redirects qpdf's messages during initialisation.
   */
  export interface QpdfInitOptions {
    /** Do not run `main` at startup; the CLI is driven through `callMain`. */
    noInitialRun: boolean;
    /** Resolve `qpdf.wasm` (the built asset URL of this site). */
    locateFile: (file: string) => string;
  }

  const init: (options: QpdfInitOptions) => Promise<QpdfModule>;
  export default init;
}
