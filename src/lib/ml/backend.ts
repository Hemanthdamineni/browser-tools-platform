/**
 * WebGPU feature detection and backend selection for the ML loader.
 *
 * Selection is a pure function of `(preference, webgpuAvailable)` so it can be
 * exhaustively unit-tested; the two `navigator.gpu` probes are thin, guarded
 * wrappers around it. SSR-safe: every global access is checked.
 */
import type { MlBackend, MlBackendPreference } from './types';
import { capabilities } from '../capabilities';

/** Minimal shape of `navigator.gpu` we rely on. */
export interface GpuLike {
  requestAdapter?: (options?: unknown) => Promise<unknown | null>;
}

function gpu(): GpuLike | undefined {
  if (!capabilities.isBrowser) return undefined;
  const nav = navigator as Navigator & { gpu?: GpuLike };
  return nav.gpu;
}

/**
 * Fast, synchronous presence check: does this browser expose the WebGPU API?
 * Mirrors transformers.js's own `'gpu' in navigator` test. A `true` here does
 * not guarantee an adapter is obtainable — use `webGpuAvailable()` for that.
 */
export function detectWebGpu(): boolean {
  return !!gpu();
}

/**
 * Whether WebGPU is actually usable: the API is present *and* an adapter can be
 * acquired. Any error (no adapter, insecure context, blocked by policy) is
 * treated as "unavailable" so the caller falls back to WASM.
 */
export async function webGpuAvailable(): Promise<boolean> {
  const api = gpu();
  if (!api) return false;
  if (typeof api.requestAdapter !== 'function') return true; // present but opaque
  try {
    const adapter = await api.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

export interface BackendDecision {
  /** The backend that will actually be used. */
  backend: MlBackend;
  /**
   * True only when a specific `'webgpu'` backend was requested but WASM had to
   * be used instead. `'auto'` silently preferring WASM is not a "fallback".
   */
  fellBack: boolean;
  /** Human-readable rationale, handy for logging / diagnostics. */
  reason: string;
}

/**
 * Decide which backend to use.
 *
 * - `'wasm'`  → always WASM.
 * - `'webgpu'`→ WebGPU if available, otherwise WASM with `fellBack: true`.
 * - `'auto'`  → WebGPU if available, otherwise WASM (not a fallback).
 */
export function resolveBackend(
  preference: MlBackendPreference,
  webgpuAvailable: boolean,
): BackendDecision {
  if (preference === 'wasm') {
    return { backend: 'wasm', fellBack: false, reason: 'WASM requested' };
  }
  if (preference === 'webgpu') {
    return webgpuAvailable
      ? { backend: 'webgpu', fellBack: false, reason: 'WebGPU requested and available' }
      : { backend: 'wasm', fellBack: true, reason: 'WebGPU requested but unavailable; using WASM' };
  }
  return webgpuAvailable
    ? { backend: 'webgpu', fellBack: false, reason: 'WebGPU available (auto)' }
    : { backend: 'wasm', fellBack: false, reason: 'WebGPU unavailable (auto); using WASM' };
}

/** Default model dtype for a backend: half precision on GPU, 8-bit quantised on CPU. */
export function defaultDtype(backend: MlBackend): 'fp16' | 'q8' {
  return backend === 'webgpu' ? 'fp16' : 'q8';
}

/** The dtype value actually passed to the runtime (a string, or a per-file map). */
export type Dtype = string | Record<string, string>;

/** Resolve the effective dtype: an explicit value wins over the backend default. */
export function resolveDtype(dtype: Dtype | undefined, backend: MlBackend): Dtype {
  return dtype ?? defaultDtype(backend);
}
