/**
 * The only part of `pdf-unlock` that is allowed to load the decryption engine.
 *
 * qpdf is ~1.3 MB of WebAssembly, so it is pulled in with a dynamic `import()`
 * on first use — the glue becomes its own chunk inside the tool worker and the
 * `.wasm` binary is fetched from this origin when a run actually starts. Neither
 * is part of the main bundle or of any other tool's chunk.
 *
 * Why this build: the newer `qpdf-wasm` (0.1.0) is compiled with pthreads and
 * pre-spawns one worker per core, which needs `SharedArrayBuffer` and therefore
 * a cross-origin-isolated page; a plain static site cannot provide that, and the
 * module fails with "SharedArrayBuffer transfer requires self.crossOriginIsolated".
 * `@jspawn/qpdf-wasm` is the same qpdf CLI built single-threaded, so it runs in
 * an ordinary worker with no extra headers and no extra threads.
 *
 * The module instance is cached for the lifetime of the worker: the second run
 * in a session skips the download and the compile.
 */
import wasmUrl from '@jspawn/qpdf-wasm/qpdf.wasm?url';
import {
  createQpdfEngine,
  withStderrCapture,
  type QpdfEngine,
  type QpdfLog,
} from './pdf-unlock.core';

let pending: Promise<QpdfEngine> | undefined;

export function loadQpdfEngine(): Promise<QpdfEngine> {
  // A failed load must not be cached: a transient fetch failure would otherwise
  // break the tool for the rest of the worker's life, with no way to retry.
  pending ??= (async () => {
    const log: QpdfLog = { stderr: [] };
    // Deliberately a dynamic import, not a static one: the glue is ~53 KB of
    // minified Emscripten runtime that must land in its own worker chunk, with
    // 1.3 MB of wasm behind it, only for the run that needs it. A static import
    // would pull both into the tool chunk the moment its page loads.
    //
    // The package's ESM wrapper (`qpdf.mjs`) is not usable from a bundled app:
    // it picks its factory up from a `globalThis.exports` object that the
    // browser-only entry writes, and Rollup's CommonJS interop rewrites that
    // assignment, so the wrapper ends up calling an undefined `createModule`.
    // The CommonJS entry (`qpdf.js`, the package's `main`) exports the factory
    // itself, which a bundler hands over as the default export.
    const module = await withStderrCapture(log, async () => {
      const { default: init } = await import('@jspawn/qpdf-wasm/qpdf.js');
      return init({
        noInitialRun: true,
        locateFile: (file) => (file === 'qpdf.wasm' ? wasmUrl : file),
      });
    });
    return createQpdfEngine(module, log);
  })().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
