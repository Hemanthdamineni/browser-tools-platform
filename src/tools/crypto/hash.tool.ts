import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './hash.meta';

const SUBTLE: Record<string, string> = {
  'sha-1': 'SHA-1',
  'sha-256': 'SHA-256',
  'sha-384': 'SHA-384',
  'sha-512': 'SHA-512',
};

function rotl(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

/** MD5 (RFC 1321) over raw bytes, returning the 16-byte digest. */
export function md5(input: Uint8Array): Uint8Array {
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;

  const total = (input.length + 1 + 8 + 63) & ~63;
  const msg = new Uint8Array(total);
  msg.set(input);
  msg[input.length] = 0x80;
  const dv = new DataView(msg.buffer);
  const bits = input.length * 8;
  dv.setUint32(total - 8, bits >>> 0, true);
  dv.setUint32(total - 4, Math.floor(bits / 4294967296) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + K[i]! + M[g]!) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl(f, S[i]!)) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, a0, true);
  odv.setUint32(4, b0, true);
  odv.setUint32(8, c0, true);
  odv.setUint32(12, d0, true);
  return out;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i]!.toString(16).padStart(2, '0');
  return s;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

async function shaDigest(name: string, data: BufferSource): Promise<Uint8Array> {
  if (!crypto?.subtle) throw new ToolError('Web Crypto is not available in this environment.');
  const buf = await crypto.subtle.digest(name, data);
  return new Uint8Array(buf);
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const algorithm = String(o.algorithm);
  const subtleName = SUBTLE[algorithm];
  if (algorithm !== 'md5' && !subtleName) {
    throw new ToolError(
      `Unknown algorithm "${algorithm}".`,
      'Use md5, sha-1, sha-256, sha-384 or sha-512.',
    );
  }

  const data = new TextEncoder().encode(input.text);
  const bytes = algorithm === 'md5' ? md5(data) : await shaDigest(subtleName!, data);

  const encoding = String(o.output);
  let out: string;
  if (encoding === 'base64') {
    out = toBase64(bytes);
  } else if (encoding === 'base64url') {
    out = toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } else {
    out = toHex(bytes);
    if (o.uppercase) out = out.toUpperCase();
  }

  const label = algorithm === 'md5' ? 'MD5' : SUBTLE[algorithm]!;
  return {
    output: out,
    render: 'code',
    stats: {
      algorithm: label,
      'bytes hashed': data.length,
      bits: bytes.length * 8,
    },
    warnings:
      algorithm === 'md5' || algorithm === 'sha-1'
        ? [`${label} is not collision-resistant — do not rely on it for security.`]
        : undefined,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
