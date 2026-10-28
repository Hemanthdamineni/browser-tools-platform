/**
 * File encryption core — AES-256-GCM with PBKDF2-SHA256 (600,000 iterations).
 *
 * Container format: "FEenc1." + base64(JSON header) + "." + base64 body.
 * The body is a sequence of independently authenticated chunks, each encrypted
 * with its own random 12-byte IV, so large files never need to sit in memory
 * as a single AES-GCM message.
 */

export const PREFIX = 'FEenc1.';
export const ITERATIONS = 600_000;
export const SALT_LEN = 16;
export const IV_LEN = 12;
export const TAG_LEN = 16;
/** Default plaintext chunk size: 1 MiB. */
export const CHUNK_SIZE = 1 << 20;

export const CORRUPT = 'Wrong password or corrupted file.';

export interface ContainerHeader {
  format: 'FEenc1';
  chunkSize: number;
  salt: string; // base64
  /** Number of chunks in the body. */
  chunks: number;
  /** Original filename, if the user opted to remember it. */
  name?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBufferLike> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Split a byte length into chunk sizes (last chunk may be short). */
export function chunkPlan(total: number, chunkSize = CHUNK_SIZE): number[] {
  if (total === 0) return [0];
  const full = Math.floor(total / chunkSize);
  const rem = total % chunkSize;
  const plan: number[] = new Array(rem ? full + 1 : full).fill(chunkSize);
  if (rem) plan[plan.length - 1] = rem;
  return plan;
}

/** Header string ("FEenc1.<b64 json>.") that precedes the body. */
export function encodeHeader(header: ContainerHeader): string {
  return `${PREFIX}${bytesToBase64(new TextEncoder().encode(JSON.stringify(header)))}.`;
}

export function decodeHeader(container: string): ContainerHeader {
  if (!container.startsWith(PREFIX)) {
    throw new Error('Not a FEenc1 container.');
  }
  const rest = container.slice(PREFIX.length);
  const dot = rest.indexOf('.');
  if (dot === -1) throw new Error('Malformed container header.');
  let header: ContainerHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(base64ToBytes(rest.slice(0, dot))));
  } catch {
    throw new Error('Malformed container header.');
  }
  if (
    header?.format !== 'FEenc1' ||
    typeof header.chunkSize !== 'number' ||
    typeof header.chunks !== 'number'
  ) {
    throw new Error('Unknown container format.');
  }
  return header;
}

/** Encrypt one plaintext chunk; returns IV || ciphertext||tag. */
export async function encryptChunk(key: CryptoKey, plaintext: BufferSource): Promise<Uint8Array<ArrayBufferLike>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  const out = new Uint8Array(IV_LEN + ct.length);
  out.set(iv, 0);
  out.set(ct, IV_LEN);
  return out;
}

/** Decrypt one chunk (IV || ciphertext||tag). Throws on auth failure. */
export async function decryptChunk(key: CryptoKey, chunk: Uint8Array<ArrayBufferLike>): Promise<Uint8Array<ArrayBufferLike>> {
  if (chunk.length < IV_LEN + TAG_LEN) throw new Error('Chunk too short.');
  const iv = chunk.slice(0, IV_LEN);
  const data = chunk.slice(IV_LEN);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data));
  } catch {
    throw new Error(CORRUPT);
  }
}

export interface EncryptResult {
  container: Blob;
  stats: Record<string, string | number>;
}

export async function encryptFile(
  file: File,
  password: string,
  opts: { rememberName?: boolean; chunkSize?: number; signal?: AbortSignal } = {},
): Promise<EncryptResult> {
  const chunkSize = opts.chunkSize ?? CHUNK_SIZE;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await deriveKey(password, salt);
  const plan = chunkPlan(file.size, chunkSize);
  const header: ContainerHeader = {
    format: 'FEenc1',
    chunkSize,
    salt: bytesToBase64(salt),
    chunks: plan.length,
    ...(opts.rememberName && file.name ? { name: file.name } : {}),
  };
  const head = encodeHeader(header);
  const bodyParts: string[] = [];
  let offset = 0;
  for (let i = 0; i < plan.length; i++) {
    opts.signal?.throwIfAborted();
    const size = plan[i]!;
    const plain = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
    bodyParts.push(bytesToBase64(await encryptChunk(key, plain)));
    offset += size;
  }
  const container = new Blob([head, bodyParts.join('.')], { type: 'application/octet-stream' });
  return {
    container,
    stats: {
      kdf: 'PBKDF2-SHA256',
      iterations: ITERATIONS,
      cipher: 'AES-256-GCM',
      chunkSize,
      chunks: plan.length,
      sizeBytes: file.size,
    },
  };
}

export interface DecryptResult {
  file: Blob;
  filename: string;
  stats: Record<string, string | number>;
}

export async function decryptFile(
  container: File,
  password: string,
  opts: { signal?: AbortSignal } = {},
): Promise<DecryptResult> {
  const text = await container.text();
  if (!text.startsWith(PREFIX)) throw new Error(CORRUPT);
  const dot = text.indexOf('.', PREFIX.length);
  if (dot === -1) throw new Error(CORRUPT);
  let header: ContainerHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(base64ToBytes(text.slice(PREFIX.length, dot))));
  } catch {
    throw new Error(CORRUPT);
  }
  if (
    header?.format !== 'FEenc1' ||
    typeof header.chunkSize !== 'number' ||
    typeof header.chunks !== 'number'
  ) {
    throw new Error(CORRUPT);
  }
  const body = text.slice(dot + 1);
  const key = await deriveKey(password, base64ToBytes(header.salt) as BufferSource);
  const b64Chunks = body.split('.').filter((s) => s.length > 0);
  if (b64Chunks.length !== header.chunks) throw new Error(CORRUPT);
  const parts: Uint8Array[] = [];
  for (const b64 of b64Chunks) {
    opts.signal?.throwIfAborted();
    let chunk: Uint8Array;
    try {
      chunk = base64ToBytes(b64);
    } catch {
      throw new Error(CORRUPT);
    }
    parts.push(await decryptChunk(key, chunk as Uint8Array<ArrayBuffer>));
  }
  const name = header.name || container.name.replace(/\.feenc$/, '') || 'decrypted-file';
  return {
    file: new Blob(parts as BlobPart[], { type: 'application/octet-stream' }),
    filename: name,
    stats: {
      kdf: 'PBKDF2-SHA256',
      iterations: ITERATIONS,
      cipher: 'AES-256-GCM',
      chunks: b64Chunks.length,
      sizeBytes: parts.reduce((n, p) => n + p.byteLength, 0),
    },
  };
}
