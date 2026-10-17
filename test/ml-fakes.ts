/**
 * Shared in-memory fakes for the ML-loader tests: a Cache Storage, a fetch
 * stub, and a WebGPU navigator shim. Kept in `test/` so it is not part of the
 * shipped `src/lib/ml` surface.
 */
import type { CacheLike, CacheStorageLike } from '@/lib/ml/cache';
import type { GpuLike } from '@/lib/ml/backend';

/* -------------------------------------------------------------------------- */
/*  Cache Storage                                                             */
/* -------------------------------------------------------------------------- */

export class FakeCache implements CacheLike {
  readonly store = new Map<string, Response>();

  private toKey(request: string | Request): string {
    return typeof request === 'string' ? request : request.url;
  }

  async match(request: string | Request): Promise<Response | undefined> {
    const response = this.store.get(this.toKey(request));
    return response ? response.clone() : undefined;
  }

  async put(request: string | Request, response: Response): Promise<void> {
    this.store.set(this.toKey(request), response.clone());
  }

  async delete(request: string | Request): Promise<boolean> {
    return this.store.delete(this.toKey(request));
  }

  async keys(): Promise<Request[]> {
    return [...this.store.keys()].map((key) => new Request(key));
  }

  /** Test helper: seed a raw response, bypassing integrity metadata. */
  seedRaw(key: string, response: Response): void {
    this.store.set(key, response.clone());
  }
}

export class FakeCacheStorage implements CacheStorageLike {
  readonly buckets = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    let cache = this.buckets.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.buckets.set(name, cache);
    }
    return cache;
  }

  async delete(name: string): Promise<boolean> {
    return this.buckets.delete(name);
  }

  async has(name: string): Promise<boolean> {
    return this.buckets.has(name);
  }

  async keys(): Promise<string[]> {
    return [...this.buckets.keys()];
  }

  bucket(name: string): FakeCache | undefined {
    return this.buckets.get(name);
  }
}

/** Install a fake `globalThis.caches`; returns it plus a restore fn. */
export function installFakeCaches(): { storage: FakeCacheStorage; restore: () => void } {
  const storage = new FakeCacheStorage();
  const original = (globalThis as { caches?: unknown }).caches;
  Object.defineProperty(globalThis, 'caches', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return {
    storage,
    restore: () => {
      Object.defineProperty(globalThis, 'caches', {
        value: original,
        configurable: true,
        writable: true,
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Responses                                                                 */
/* -------------------------------------------------------------------------- */

const encoder = new TextEncoder();

export function bytesOf(text: string): Uint8Array {
  return encoder.encode(text);
}

export function jsonResponse(value: unknown, headers: Record<string, string> = {}): Response {
  const body = JSON.stringify(value);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-length': String(bytesOf(body).length),
      ...headers,
    },
  });
}

export function bytesResponse(bytes: Uint8Array, headers: Record<string, string> = {}): Response {
  const copy = bytes.slice();
  return new Response(copy, {
    status: 200,
    headers: { 'content-length': String(bytes.byteLength), ...headers },
  });
}

/* -------------------------------------------------------------------------- */
/*  fetch                                                                     */
/* -------------------------------------------------------------------------- */

export interface FakeFetch {
  calls: { url: string; init?: RequestInit }[];
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>;
  restore: () => void;
}

/** Replace `globalThis.fetch` with a recording stub. */
export function installFakeFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): FakeFetch {
  const calls: { url: string; init?: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return Promise.resolve(handler(url, init));
  }) as typeof fetch;
  return {
    calls,
    handler,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  navigator.gpu                                                             */
/* -------------------------------------------------------------------------- */

/** Run `fn` with `navigator.gpu` set (or removed). */
export async function withNavigatorGpu<T>(
  gpu: GpuLike | undefined,
  fn: () => Promise<T> | T,
): Promise<T> {
  const target = navigator as Navigator & { gpu?: GpuLike };
  const had = 'gpu' in target;
  const previous = target.gpu;
  if (gpu === undefined) {
    delete target.gpu;
  } else {
    Object.defineProperty(target, 'gpu', { value: gpu, configurable: true, writable: true });
  }
  try {
    return await fn();
  } finally {
    if (had) {
      Object.defineProperty(target, 'gpu', { value: previous, configurable: true, writable: true });
    } else {
      delete target.gpu;
    }
  }
}
