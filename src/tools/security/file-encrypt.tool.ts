import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import { meta } from './file-encrypt.meta';

/*
 * .tbenc file layout (documented in the tool's article and mirrored here).
 *
 *   Header (40 bytes)
 *     0  .. 5   ASCII magic "TBFENC"
 *     6         format version = 1
 *     7         KDF id = 1 (PBKDF2-SHA256, 600_000 iterations — same as text-encrypt)
 *     8  .. 11  iteration count, UInt32BE (must equal ITERATIONS for v1)
 *     12 .. 15  chunk size, UInt32BE (64 KiB)
 *     16 .. 31  salt (16 bytes)
 *     32 .. 39  nonce prefix (8 bytes)
 *
 *   Records, each:
 *     0         flag byte: bit0 = 1 if this is the final chunk
 *     1  .. 4   payload length, UInt32BE (ciphertext incl. 16-byte tag)
 *     5  ..     ciphertext + tag
 *
 *   Every chunk is AES-256-GCM. Its IV is noncePrefix || UInt32BE(counter),
 *   the counter starting at 1 for the first chunk (and used once for an empty
 *   file). The GCM nonce limit (2^32 − 2 chunks ≈ 256 TiB at 64 KiB) never
 *   binds in practice. additionalData covers the 40-byte header, the 4-byte
 *   counter and the final-flag byte, so tampering with the header or cutting
 *   the file short fails authentication.
 *
 *   The salt and nonce prefix are random per file, so encrypting the same
 *   input twice yields different output.
 */

const MAGIC = [0x54, 0x42, 0x46, 0x45, 0x4e, 0x43]; // "TBFENC"
const VERSION = 1;
const KDF_ID = 1;
const ITERATIONS = 600_000; // matches src/tools/security/text-encrypt.tool.ts
const SALT_LEN = 16;
const NONCE_LEN = 8;
const HEADER_LEN = 40;
const CHUNK = 64 * 1024;
const MAX_CHUNK = 16 * 1024 * 1024;
const TAG_LEN = 16;
const COUNTER_LEN = 4;

const CORRUPT = 'Wrong password or corrupted file.';
const HEADER_MISSING =
  'This file does not start with the .tbenc magic bytes, so it is not an encrypted file.';
const HEADER_BAD_KDF =
  'This file was encrypted with a different key derivation and cannot be read by this tool.';
const HEADER_BAD_VERSION =
  'This file uses an unsupported format version and cannot be read by this tool.';
const HEADER_BAD_CHUNK =
  'This file declares a chunk size outside the supported range and cannot be read.';

/* -------------------------------------------------------------------------- */
/*  Header helpers                                                            */
/* -------------------------------------------------------------------------- */

function writeU32(out: Uint8Array, offset: number, value: number): void {
  out[offset] = (value >>> 24) & 0xff;
  out[offset + 1] = (value >>> 16) & 0xff;
  out[offset + 2] = (value >>> 8) & 0xff;
  out[offset + 3] = value & 0xff;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

function buildHeader(
  salt: Uint8Array<ArrayBuffer>,
  nonce: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  const h = new Uint8Array(HEADER_LEN);
  h.set(MAGIC, 0);
  h[6] = VERSION;
  h[7] = KDF_ID;
  writeU32(h, 8, ITERATIONS);
  writeU32(h, 12, CHUNK);
  h.set(salt, 16);
  h.set(nonce, 32);
  return h;
}

interface ParsedHeader {
  header: Uint8Array<ArrayBuffer>;
  chunkSize: number;
  salt: Uint8Array<ArrayBuffer>;
  noncePrefix: Uint8Array<ArrayBuffer>;
}

function parseHeader(bytes: Uint8Array): ParsedHeader {
  if (bytes.byteLength < HEADER_LEN)
    throw new ToolError(CORRUPT, 'Check that the file was not truncated.');
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new ToolError(HEADER_MISSING);
  }
  const version = bytes[6]!;
  const kdfId = bytes[7]!;
  const iterations = readU32(bytes, 8);
  const chunkSize = readU32(bytes, 12);
  if (version !== VERSION) throw new ToolError(HEADER_BAD_VERSION);
  if (kdfId !== KDF_ID || iterations !== ITERATIONS) throw new ToolError(HEADER_BAD_KDF);
  if (chunkSize < 1 || chunkSize > MAX_CHUNK) throw new ToolError(HEADER_BAD_CHUNK);
  const salt = bytes.slice(16, 32);
  const noncePrefix = bytes.slice(32, 40);
  return { header: bytes.slice(0, HEADER_LEN), chunkSize, salt, noncePrefix };
}

/* -------------------------------------------------------------------------- */
/*  Key derivation — matches text-encrypt exactly                             */
/* -------------------------------------------------------------------------- */

async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
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

function nonceFor(prefix: Uint8Array<ArrayBuffer>, counter: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(NONCE_LEN + COUNTER_LEN);
  out.set(prefix, 0);
  writeU32(out, NONCE_LEN, counter);
  return out;
}

function aadFor(
  header: Uint8Array<ArrayBuffer>,
  counter: number,
  finalFlag: number,
): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(header.byteLength + COUNTER_LEN + 1);
  out.set(header, 0);
  writeU32(out, header.byteLength, counter);
  out[header.byteLength + COUNTER_LEN] = finalFlag;
  return out;
}

function concat(parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Encrypt                                                                   */
/* -------------------------------------------------------------------------- */

async function encryptFile(
  file: File,
  password: string,
  input: FileRunInput,
): Promise<FileRunResult> {
  input.onProgress?.(0.02, 'Deriving key from password');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const noncePrefix = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const key = await deriveKey(password, salt);
  const header = buildHeader(salt, noncePrefix);

  input.onProgress?.(0.08, 'Encrypting');
  const parts: Uint8Array<ArrayBuffer>[] = [header];
  const total = file.size;
  let offset = 0;
  let counter = 1;
  while (offset < total) {
    if (input.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const end = Math.min(offset + CHUNK, total);
    const piece = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    const isFinal = end === total;
    const iv = nonceFor(noncePrefix, counter);
    const aad = aadFor(header, counter, isFinal ? 1 : 0);
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, piece),
    );
    const rec = new Uint8Array(1 + COUNTER_LEN + ct.byteLength);
    rec[0] = isFinal ? 1 : 0;
    writeU32(rec, 1, ct.byteLength);
    rec.set(ct, 1 + COUNTER_LEN);
    parts.push(rec);
    offset = end;
    counter += 1;
    input.onProgress?.(0.08 + (offset / total) * 0.84, 'Encrypting');
  }
  // An empty file still needs one final (empty) record so that a zero-byte
  // input round-trips to a well-formed .tbenc file.
  if (total === 0) {
    const iv = nonceFor(noncePrefix, counter);
    const aad = aadFor(header, counter, 1);
    const ct = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad },
        key,
        new Uint8Array(0),
      ),
    );
    const rec = new Uint8Array(1 + COUNTER_LEN + ct.byteLength);
    rec[0] = 1;
    writeU32(rec, 1, ct.byteLength);
    rec.set(ct, 1 + COUNTER_LEN);
    parts.push(rec);
  }

  const blob = new Blob(parts, { type: 'application/octet-stream' });
  input.onProgress?.(1, 'Done');
  const chunks = Math.max(1, Math.ceil(total / CHUNK));
  return {
    outputs: [{ filename: `${file.name}.tbenc`, blob }],
    notes: [
      'The original file is untouched; you get a new encrypted copy. Delete the original once ' +
        'you are sure you can open the copy.',
      'There is no recovery: if you lose the password, the file cannot be decrypted.',
    ],
    stats: {
      algorithm: 'AES-256-GCM',
      kdf: `PBKDF2-SHA256 x${ITERATIONS.toLocaleString('en-US')}`,
      chunks,
      'input size': formatBytes(file.size),
      'output size': formatBytes(blob.size),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Decrypt                                                                   */
/* -------------------------------------------------------------------------- */

async function decryptFile(
  file: File,
  password: string,
  input: FileRunInput,
): Promise<FileRunResult> {
  input.onProgress?.(0.02, 'Reading header');
  if (!file.size) throw new ToolError(CORRUPT, 'The file is empty and cannot be decrypted.');
  const head = new Uint8Array(await file.slice(0, HEADER_LEN).arrayBuffer());
  const { header, chunkSize, salt, noncePrefix } = parseHeader(head);

  input.onProgress?.(0.06, 'Deriving key from password');
  const key = await deriveKey(password, salt);

  input.onProgress?.(0.1, 'Decrypting');
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let offset = HEADER_LEN;
  let counter = 1;
  let seenFinal = false;
  while (offset < file.size) {
    if (input.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    const recHead = new Uint8Array(
      await file.slice(offset, offset + 1 + COUNTER_LEN).arrayBuffer(),
    );
    if (recHead.byteLength < 1 + COUNTER_LEN)
      throw new ToolError(CORRUPT, 'The file ends in the middle of a record header.');
    const flag = recHead[0]!;
    if (flag & 0xfe) throw new ToolError(CORRUPT, 'The record flag byte is invalid.');
    const isFinal = (flag & 1) === 1;
    const len = readU32(recHead, 1);
    if (len < TAG_LEN || len > chunkSize + TAG_LEN)
      throw new ToolError(
        CORRUPT,
        'The chunk length is inconsistent with the declared chunk size.',
      );
    const bodyStart = offset + 1 + COUNTER_LEN;
    const bodyEnd = bodyStart + len;
    if (bodyEnd > file.size)
      throw new ToolError(CORRUPT, 'The file ends in the middle of a chunk.');
    const body = new Uint8Array(await file.slice(bodyStart, bodyEnd).arrayBuffer());
    const iv = nonceFor(noncePrefix, counter);
    const aad = aadFor(header, counter, isFinal ? 1 : 0);
    let plain: ArrayBuffer;
    try {
      plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, body);
    } catch {
      throw new ToolError(
        CORRUPT,
        'The password may be wrong, or the file may have been changed since it was encrypted.',
      );
    }
    parts.push(new Uint8Array(plain));
    offset = bodyEnd;
    if (isFinal) {
      seenFinal = true;
      if (offset !== file.size)
        throw new ToolError(CORRUPT, 'There is data after the final chunk.');
      break;
    }
    counter += 1;
    input.onProgress?.(0.1 + (offset / file.size) * 0.85, 'Decrypting');
  }
  if (!seenFinal) throw new ToolError(CORRUPT, 'The file has no final chunk marker.');

  const out = concat(parts);
  const blob = new Blob([out], { type: 'application/octet-stream' });
  input.onProgress?.(1, 'Done');
  return {
    outputs: [
      {
        filename: /\.tbenc$/i.test(file.name)
          ? file.name.slice(0, -'.tbenc'.length)
          : file.name,
        blob,
      },
    ],
    notes: [
      'Verify the decrypted file opens correctly before deleting the encrypted copy.',
      'The plaintext is rebuilt chunk by chunk — nothing is written to disk until you save ' +
        'the result.',
    ],
    stats: {
      algorithm: 'AES-256-GCM',
      kdf: `PBKDF2-SHA256 x${ITERATIONS.toLocaleString('en-US')}`,
      'input size': formatBytes(file.size),
      'output size': formatBytes(out.byteLength),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Entry                                                                     */
/* -------------------------------------------------------------------------- */

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files?.length) throw new ToolError('Choose a file to encrypt or decrypt.');
  const file = input.files[0]!;
  const mode = String(o.mode ?? 'encrypt');
  const password = String(o.password ?? '');
  if (!password)
    throw new ToolError(
      'Enter a password.',
      'The same passphrase encrypts and decrypts; it is never stored.',
    );
  if (!crypto?.subtle)
    throw new ToolError(
      'Web Crypto is not available in this browser.',
      'Try a recent Chrome, Edge, Firefox or Safari.',
    );

  if (mode === 'encrypt') return encryptFile(file, password, input);
  if (mode === 'decrypt') return decryptFile(file, password, input);
  throw new ToolError(`Unknown mode "${mode}".`);
}

const tool: FileToolModule = { meta, run };
export default tool;