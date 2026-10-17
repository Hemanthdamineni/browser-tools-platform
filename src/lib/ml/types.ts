/**
 * Shared types for the on-device ML runtime loader (`src/lib/ml`).
 *
 * This module is intentionally free of heavy imports: nothing here (or in the
 * `ml/index` barrel) may pull `@huggingface/transformers` / `onnxruntime-web`
 * into the main bundle. The runtime is only reached through a dynamic
 * `import()` inside `loadModel()`, so a tool's lightweight `.meta.ts` can import
 * these types (type-only) for free.
 *
 * Privacy: everything runs in the visitor's tab. The only network requests the
 * loader may issue are for the tool's own static assets and model weights from
 * the configured permitted host (the Hugging Face Hub by default). No user data
 * is ever uploaded.
 */

/** Compute backend for inference. */
export type MlBackend = 'webgpu' | 'wasm';

/** `'auto'` prefers WebGPU and falls back to WASM; the others request a backend. */
export type MlBackendPreference = 'auto' | MlBackend;

/** Lifecycle phase of a model load, for progress UI. */
export type LoadPhase =
  | 'resolving' // validating the model id / licence / cache
  | 'downloading' // bytes are (or were) flowing
  | 'initializing' // building the ONNX session
  | 'ready' // pipeline is usable
  | 'error'; // load failed

/** Per-file transfer state. */
export interface FileProgress {
  /** File name within the model repo, e.g. `onnx/model.onnx`. */
  file: string;
  /** Bytes received so far (or the cached size when `cached`). */
  loaded: number;
  /** Expected byte length, or `0` when the server sent no `Content-Length`. */
  total: number;
  /** True when this file was served from Cache Storage (no network). */
  cached: boolean;
}

/**
 * Aggregate progress snapshot. Consumers render a progress bar from
 * `fraction` / `loaded` / `total` and a status line from `message`, e.g. with
 * `formatBytes` from `src/lib/format.ts`.
 */
export interface LoadProgress {
  phase: LoadPhase;
  /** Aggregate `loaded / total` in `0..1`, or `null` while the total is unknown. */
  fraction: number | null;
  /** Aggregate bytes received (cache hits count as complete). */
  loaded: number;
  /** Aggregate expected bytes (`0` while unknown). */
  total: number;
  /** Per-file detail, in the order files were first seen. */
  files: FileProgress[];
  /** Human-readable status line for the UI. */
  message: string;
  /** Non-fatal problems (e.g. the cache quota was exceeded). */
  warnings: string[];
}

/** How aggressively a cached entry is validated before it is trusted. */
export type CacheVerifyMode = 'none' | 'size' | 'digest';

/** Metadata persisted alongside a cached model file. */
export interface CachedFileMeta {
  /** The remote URL the bytes came from. */
  url: string;
  /** Exact byte length of the stored body. */
  bytes: number;
  /** Lower-case hex SHA-256 of the stored body, when known. */
  sha256?: string;
  contentType?: string;
  /** Epoch milliseconds. */
  storedAt: number;
}

/** A cache entry that failed validation and was evicted. */
export interface CorruptEntryReport {
  key: string;
  reason: string;
}

/* -------------------------------------------------------------------------- */
/*  Abort helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Create a DOM-compatible `AbortError` that `fetch` and the workbench understand. */
export function createAbortError(message = 'The operation was cancelled.'): Error {
  if (typeof DOMException === 'function') return new DOMException(message, 'AbortError');
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

/** True when `error` is an abort (either a `DOMException` or a named `Error`). */
export function isAbortError(error: unknown): boolean {
  return (
    !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError'
  );
}

/** Throw an `AbortError` when `signal` has already been aborted. */
export function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw createAbortError();
}
