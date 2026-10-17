import { describe, expect, it, vi } from 'vitest';
import {
  BYTES_HEADER,
  ModelCache,
  SHA256_HEADER,
  extractSha256,
  isJsonEntry,
  isQuotaExceeded,
  type ModelCacheOptions,
} from './cache';
import { FakeCache, FakeCacheStorage, bytesResponse, jsonResponse } from '../../../test/ml-fakes';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function makeCache(options: ModelCacheOptions = {}) {
  const storage = new FakeCacheStorage();
  const corrupt: { key: string; reason: string }[] = [];
  const warnings: string[] = [];
  const cache = new ModelCache({
    cacheStorage: storage,
    onCorrupt: (report) => corrupt.push(report),
    onWarning: (message) => warnings.push(message),
    ...options,
  });
  return { storage, cache, corrupt, warnings };
}

describe('ModelCache', () => {
  it('round-trips a written entry and records its byte length', async () => {
    const { cache } = makeCache();
    const key = 'https://huggingface.co/a/b/resolve/main/config.json';
    const blob = new Blob([JSON.stringify({ hidden_size: 8 })]);
    await cache.write(key, blob, {
      url: key,
      bytes: blob.size,
      contentType: 'application/json',
      storedAt: 1,
    });

    const hit = await cache.match(key);
    expect(hit).toBeDefined();
    expect(hit?.headers.get(BYTES_HEADER)).toBe(String(blob.size));
    expect(await hit?.text()).toBe('{"hidden_size":8}');
    await expect(cache.has(key)).resolves.toBe(true);
  });

  it('returns undefined for a miss', async () => {
    const { cache } = makeCache();
    await expect(
      cache.match('https://huggingface.co/a/b/resolve/main/nope'),
    ).resolves.toBeUndefined();
  });

  it('evicts an entry whose stored bytes no longer match the recording', async () => {
    const { cache, storage, corrupt } = makeCache();
    const key = 'https://huggingface.co/a/b/resolve/main/model.onnx';
    const bucket = await storage.open(ModelCache.defaultName);
    bucket.seedRaw(
      key,
      new Response('ab', {
        headers: { [BYTES_HEADER]: '999', 'content-type': 'application/octet-stream' },
      }),
    );

    await expect(cache.match(key)).resolves.toBeUndefined();
    expect(corrupt).toHaveLength(1);
    expect(corrupt[0]?.reason).toMatch(/byte length/i);
    expect(storage.bucket(ModelCache.defaultName)?.store.has(key)).toBe(false);
  });

  it('evicts a truncated JSON config file', async () => {
    const { cache, storage, corrupt } = makeCache();
    const key = 'https://huggingface.co/a/b/resolve/main/tokenizer_config.json';
    const body = '{"a":';
    const bucket = await storage.open(ModelCache.defaultName);
    bucket.seedRaw(
      key,
      new Response(body, {
        headers: {
          [BYTES_HEADER]: String(new Blob([body]).size),
          'content-type': 'application/json',
        },
      }),
    );

    await expect(cache.match(key)).resolves.toBeUndefined();
    expect(corrupt[0]?.reason).toMatch(/JSON/i);
  });

  it('evicts an entry whose digest does not match', async () => {
    const { cache, storage, corrupt } = makeCache();
    const key = 'https://huggingface.co/a/b/resolve/main/model.onnx';
    const body = 'weights';
    const bucket = await storage.open(ModelCache.defaultName);
    bucket.seedRaw(
      key,
      new Response(body, {
        headers: { [BYTES_HEADER]: String(new Blob([body]).size), [SHA256_HEADER]: 'deadbeef' },
      }),
    );

    await expect(cache.match(key)).resolves.toBeUndefined();
    expect(corrupt[0]?.reason).toMatch(/SHA-256/i);
  });

  it('accepts an entry whose digest matches', async () => {
    const { cache, storage } = makeCache();
    const key = 'https://huggingface.co/a/b/resolve/main/model.onnx';
    const body = 'weights';
    const bucket = await storage.open(ModelCache.defaultName);
    bucket.seedRaw(
      key,
      new Response(body, {
        headers: {
          [BYTES_HEADER]: String(new Blob([body]).size),
          [SHA256_HEADER]: await sha256Hex(body),
        },
      }),
    );

    await expect(cache.match(key)).resolves.toBeDefined();
  });

  it('trusts the browser entirely when verify is "none"', async () => {
    const { cache, storage, corrupt } = makeCache({ verify: 'none' });
    const key = 'https://huggingface.co/a/b/resolve/main/model.onnx';
    const bucket = await storage.open(ModelCache.defaultName);
    bucket.seedRaw(key, new Response('x', { headers: { [BYTES_HEADER]: '999' } }));

    await expect(cache.match(key)).resolves.toBeDefined();
    expect(corrupt).toHaveLength(0);
  });

  it('degrades gracefully when the storage quota is exceeded', async () => {
    class QuotaCache extends FakeCache {
      override async put(): Promise<void> {
        throw new DOMException('quota', 'QuotaExceededError');
      }
    }
    const storage = new FakeCacheStorage();
    storage.buckets.set(ModelCache.defaultName, new QuotaCache());
    const warnings: string[] = [];
    const cache = new ModelCache({ cacheStorage: storage, onWarning: (m) => warnings.push(m) });

    const stored = await cache.write(
      'https://huggingface.co/a/b/resolve/main/model.onnx',
      new Blob(['x']),
      {
        url: 'x',
        bytes: 1,
        storedAt: 1,
      },
    );
    expect(stored).toBe(false);
    expect(warnings[0]).toMatch(/quota/i);
  });

  it('lists keys and sums usage', async () => {
    const { cache } = makeCache();
    const a = 'https://huggingface.co/a/b/resolve/main/a.bin';
    const b = 'https://huggingface.co/a/b/resolve/main/b.bin';
    await cache.write(a, new Blob([new Uint8Array(10)]), { url: a, bytes: 10, storedAt: 1 });
    await cache.write(b, new Blob([new Uint8Array(5)]), { url: b, bytes: 5, storedAt: 1 });

    expect((await cache.list()).sort()).toEqual([a, b]);
    await expect(cache.usage()).resolves.toBe(15);

    await cache.delete(a);
    await expect(cache.list()).resolves.toEqual([b]);

    await cache.clear();
    await expect(cache.list()).resolves.toEqual([]);
  });

  it('implements the transformers.js custom-cache `put` contract', async () => {
    const { cache } = makeCache();
    const progress: number[] = [];
    await cache.put(
      'https://huggingface.co/a/b/resolve/main/config.json',
      jsonResponse({ ok: true }, { etag: `"${await sha256Hex('{"ok":true}')}"` }),
      (data) => progress.push(data.progress),
    );

    const hit = await cache.match('https://huggingface.co/a/b/resolve/main/config.json');
    expect(hit).toBeDefined();
    expect(progress.at(-1)).toBe(100);
    expect(hit?.headers.get(SHA256_HEADER)).toBe(await sha256Hex('{"ok":true}'));
  });

  it('is inert without Cache Storage', async () => {
    const cache = new ModelCache({ cacheStorage: null });
    await expect(cache.match('x')).resolves.toBeUndefined();
    await expect(
      cache.write('x', new Blob(['y']), { url: 'x', bytes: 1, storedAt: 1 }),
    ).resolves.toBe(false);
    await expect(cache.usage()).resolves.toBe(0);
  });

  it('reports unavailable when there is no Cache Storage', () => {
    expect(ModelCache.isAvailable(null)).toBe(false);
    expect(ModelCache.isAvailable(new FakeCacheStorage())).toBe(true);
  });
});

describe('cache helpers', () => {
  it('extracts a SHA-256 from HF LFS etags', () => {
    const hex = 'a'.repeat(64);
    expect(extractSha256(`"${hex}"`)).toBe(hex);
    expect(extractSha256(`W/"${hex.toUpperCase()}"`)).toBe(hex);
    expect(extractSha256('"not-a-sha"')).toBeUndefined();
    expect(extractSha256(null)).toBeUndefined();
  });

  it('recognises JSON entries by content type or extension', () => {
    expect(isJsonEntry('x/f.json')).toBe(true);
    expect(isJsonEntry('x/f.bin', 'application/json')).toBe(true);
    expect(isJsonEntry('x/f.onnx', 'application/octet-stream')).toBe(false);
  });

  it('recognises quota errors', () => {
    expect(isQuotaExceeded(new DOMException('q', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaExceeded({ code: 22 })).toBe(true);
    expect(isQuotaExceeded(new Error('nope'))).toBe(false);
  });

  it('builds a bytes response helper the tests rely on', async () => {
    const res = bytesResponse(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('ModelCache corruption hook', () => {
  it('does not call onCorrupt for healthy entries', async () => {
    const onCorrupt = vi.fn();
    const { cache } = makeCache({ onCorrupt });
    const key = 'https://huggingface.co/a/b/resolve/main/f.bin';
    await cache.write(key, new Blob(['hello']), { url: key, bytes: 5, storedAt: 1 });
    await cache.match(key);
    expect(onCorrupt).not.toHaveBeenCalled();
  });
});
