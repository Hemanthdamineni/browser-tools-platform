import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-encrypt.meta';

const PREFIX = 'TBenc1.';
const ITERATIONS = 600_000;
const SALT_LEN = 16;
const IV_LEN = 12;
/** AES-GCM authentication tag length in bytes. */
const TAG_LEN = 16;

const CORRUPT = 'Wrong password or corrupted data.';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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

async function encrypt(text: string, password: string): Promise<TextRunResult> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)),
  );

  const packed = new Uint8Array(SALT_LEN + IV_LEN + sealed.length);
  packed.set(salt, 0);
  packed.set(iv, SALT_LEN);
  packed.set(sealed, SALT_LEN + IV_LEN);

  return {
    output: PREFIX + bytesToBase64(packed),
    render: 'code',
    stats: {
      'cipher bytes': sealed.length,
      iterations: ITERATIONS,
      kdf: 'PBKDF2-SHA256',
    },
    notes: ['Keep the passphrase safe — it cannot be recovered and there is no backup.'],
  };
}

async function decrypt(token: string, password: string): Promise<TextRunResult> {
  const trimmed = token.trim();
  if (!trimmed.startsWith(PREFIX)) throw new ToolError(CORRUPT);

  let packed: Uint8Array;
  try {
    packed = base64ToBytes(trimmed.slice(PREFIX.length));
  } catch {
    throw new ToolError(CORRUPT);
  }
  if (packed.length < SALT_LEN + IV_LEN + TAG_LEN) throw new ToolError(CORRUPT);

  const salt = packed.slice(0, SALT_LEN);
  const iv = packed.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const sealed = packed.slice(SALT_LEN + IV_LEN);

  try {
    const key = await deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed);
    const output = new TextDecoder().decode(plain);
    return { output, render: 'code', stats: { 'output chars': output.length } };
  } catch {
    throw new ToolError(CORRUPT);
  }
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const password = String(o.password ?? '');
  if (!password) {
    throw new ToolError(
      'A password is required.',
      'Enter the same passphrase for encrypt and decrypt.',
    );
  }

  return o.mode === 'decrypt' ? decrypt(input.text, password) : encrypt(input.text, password);
}

const tool: TextToolModule = { meta, run };
export default tool;
