/**
 * Read a `Response` body into a `Blob` while reporting byte progress and
 * honouring an `AbortSignal`. Shared by the model fetch and the cache writer.
 */
import { throwIfAborted } from './types';

export interface ReadBodyResult {
  blob: Blob;
  /** Byte length of the body (falls back to the bytes actually read). */
  total: number;
}

/** Content-Length header as a number, or 0 when absent/invalid. */
export function contentLength(response: Response): number {
  const raw = response.headers.get('content-length');
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Consume `response` fully. `onProgress(loaded, total)` fires after every chunk
 * (`total` is 0 when the server sent no `Content-Length`).
 */
export async function readBodyWithProgress(
  response: Response,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal | null,
): Promise<ReadBodyResult> {
  const declared = contentLength(response);
  const body = response.body as ReadableStream<Uint8Array> | null | undefined;

  if (!body || typeof body.getReader !== 'function') {
    // No streaming body available — read it in one shot.
    throwIfAborted(signal);
    const buffer = await response.arrayBuffer();
    const size = buffer.byteLength;
    onProgress?.(size, declared || size);
    return { blob: new Blob([buffer]), total: declared || size };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  try {
    for (;;) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        onProgress?.(loaded, declared);
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  return { blob: new Blob(chunks as BlobPart[]), total: declared || loaded };
}
