/**
 * On-device ML runtime foundation (`src/lib/ml`).
 *
 * A shared, reusable loader for transformers.js / onnxruntime-web models:
 * WebGPU with a WASM fallback, Cache Storage caching with corrupt-entry
 * recovery, byte-level download progress, `AbortSignal` cancellation, and a
 * deny-by-default licence allow-list for model weights.
 *
 * Importing this barrel is cheap: the heavy runtime is pulled in by a dynamic
 * `import()` inside `loadModel()`, never at module scope. A tool's `.meta.ts`
 * may therefore import these types freely.
 *
 * See `docs/ML-RUNTIME.md` for the full contract and edge cases.
 */

export * from './types';
export * from './urls';
export * from './licenses';
export * from './backend';
export * from './progress';
export * from './cache';
export * from './fetch';
export * from './body';
export * from './loader';
