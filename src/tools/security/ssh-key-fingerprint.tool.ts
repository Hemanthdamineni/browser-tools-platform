import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './ssh-key-fingerprint.meta';

type Row = [string, string];
type ParsedKey = { type: string; bits: number | null; comment: string; blob: Uint8Array; b64: string };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(s: string): Uint8Array {
  const clean = s.replace(/\s+/g, '');
  if (!clean || clean.length % 4 === 1) throw new ToolError('Unrecognized base64 key data.');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    if (ch === '=') break;
    const v = B64.indexOf(ch);
    if (v === -1) throw new ToolError('The key contains characters outside the base64 alphabet.');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function base64Encode(bytes: Uint8Array, pad = false): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? (pad ? '=' : '') : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? (pad ? '=' : '') : B64[c & 63];
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function hexBytesToColon(s: string): string {
  return s.replace(/(..)(?=.)/g, '$1:');
}

// ── MD5 (WebCrypto has no MD5; hand-rolled) ─────────────────────────────────

const MD5_S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
const MD5_K: number[] = [];
for (let i = 0; i < 64; i++) MD5_K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);

function md5(input: Uint8Array): string {
  const len = input.length;
  const bitLenLo = ((len * 8) % 4294967296) >>> 0;
  const bitLenHi = Math.floor((len * 8) / 4294967296) >>> 0;
  const paddedLen = (((len + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLen);
  msg.set(input);
  msg[len] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(paddedLen - 8, bitLenLo, true);
  view.setUint32(paddedLen - 4, bitLenHi, true);
  let A0 = 0x67452301, B0 = 0xefcdab89, C0 = 0x98badcfe, D0 = 0x10325476;
  const work = new DataView(msg.buffer);
  for (let off = 0; off < paddedLen; off += 64) {
    let A = A0, B = B0, C = C0, D = D0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + MD5_K[i]! + work.getUint32(off + g * 4, true)) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + (((F << MD5_S[i]!) | (F >>> (32 - MD5_S[i]!))))) >>> 0;
    }
    A0 = (A0 + A) >>> 0;
    B0 = (B0 + B) >>> 0;
    C0 = (C0 + C) >>> 0;
    D0 = (D0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  new DataView(out.buffer).setUint32(0, A0, true);
  new DataView(out.buffer).setUint32(4, B0, true);
  new DataView(out.buffer).setUint32(8, C0, true);
  new DataView(out.buffer).setUint32(12, D0, true);
  return toHex(out);
}

// ── OpenSSH blob parsing ──────────────────────────────────────────────────────

function readU32(b: Uint8Array, off: number): number {
  if (off + 4 > b.length) throw new ToolError('Malformed SSH key blob.');
  return ((b[off]! << 24) | (b[off + 1]! << 16) | (b[off + 2]! << 8) | b[off + 3]!) >>> 0;
}

function readString(b: Uint8Array, off: number): { value: Uint8Array; next: number } {
  const len = readU32(b, off);
  const start = off + 4;
  if (len + start > b.length) throw new ToolError('Malformed SSH key blob.');
  return { value: b.subarray(start, start + len), next: start + len };
}

function parseBlob(blob: Uint8Array): { type: string; bits: number | null } {
  const typeStr = readString(blob, 0).value;
  const type = new TextDecoder().decode(typeStr);
  let cursor = 4 + typeStr.length;
  let bits: number | null = null;
  try {
    if (type === 'ssh-rsa') {
      const e = readString(blob, cursor);
      cursor = e.next;
      const n = readString(blob, cursor);
      bits = bigIntBits(n.value);
    } else if (type === 'ssh-ed25519') {
      bits = 256;
    } else if (type === 'ssh-dss') {
      const p = readString(blob, cursor);
      bits = bigIntBits(p.value);
    } else if (type.startsWith('ecdsa-sha2-')) {
      const curve = readString(blob, cursor).value;
      const name = new TextDecoder().decode(curve);
      cursor += 4 + curve.length;
      readString(blob, cursor); // elliptic point
      bits = name.includes('384') ? 384 : name.includes('521') ? 521 : 256;
    } else if (type.startsWith('sk-ecdsa-sha2-')) {
      readString(blob, cursor); // application
      cursor += 4;
      const curve = readString(blob, cursor).value;
      readString(blob, cursor); // elliptic point
      bits = new TextDecoder().decode(curve).includes('384') ? 384 : 256;
    }
  } catch {
    /* parse issues are ignored for bit size; type is authoritative */
  }
  return { type, bits };
}

function bigIntBits(bytes: Uint8Array): number {
  let start = 0;
  while (start < bytes.length && bytes[start] === 0) start++;
  const remaining = bytes.length - start;
  if (remaining === 0) return 0;
  let lead = 0;
  let x = bytes[start]!;
  while (x < 128) { x <<= 1; lead++; }
  return remaining * 8 - lead;
}

function extractKey(raw: string): ParsedKey {
  const text = raw.trim();
  if (!text) throw new ToolError('Enter an SSH public key.');
  const parts = text.split(/\s+/);
  const looks = parts.some((w) => /^(ssh|ecdsa-sha2|sk-)/.test(w));
  const first = parts[0] ?? '';
  if (looks && /^(ssh|ecdsa-sha2|sk-)/.test(first)) {
    const b64 = parts[1];
    if (!b64) throw new ToolError('Expected a base64 blob after the key type.');
    const blob = base64Decode(b64);
    const { type, bits } = parseBlob(blob);
    return { type, bits, comment: parts.slice(2).join(' '), blob, b64 };
  }
  // Treat the whole trimmed input as a base64 blob (e.g. a raw key segment).
  const blob = base64Decode(text);
  const { type, bits } = parseBlob(blob);
  return { type, bits, comment: '', blob, b64: base64Encode(blob) };
}

function run(input: TextRunInput): Promise<TextRunResult> | TextRunResult {
  const raw = input.text.trim();
  if (!raw) {
    return { output: JSON.stringify({ headers: ['Property', 'Value'], rows: [] as Row[] }), render: 'table', notes: ['Paste an SSH public key (ssh-rsa/ssh-ed25519… plus the base64 blob and optional comment) to compute its fingerprint.'] };
  }
  const parsed = extractKey(raw);
  return Promise.resolve().then(async () => {
    const blobBytes = new Uint8Array(parsed.blob);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', blobBytes));
    const sha256Hex = toHex(digest);
    const sha256b64 = base64Encode(digest);
    const md5val = md5(parsed.blob);
    const rows: Row[] = [
      ['Key type', parsed.type],
      ['Key size', parsed.bits === null ? 'unknown' : `${parsed.bits} bits`],
      ['Comment', parsed.comment || '(none)'],
      ['SHA256 fingerprint', `SHA256:${sha256b64}`],
      ['MD5 fingerprint', `MD5:${hexBytesToColon(md5val)}`],
    ];
    return {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
      render: 'table',
      stats: { bits: parsed.bits ?? 0, sha256: sha256Hex.slice(0, 12), md5: md5val.slice(0, 12) },
      notes: [`The ${parsed.blob.length}-byte key blob is fingerprinted as SHA256:${sha256b64.slice(0, 31)}…`],
    };
  });
}

const tool: TextToolModule = { meta, run };
export default tool;
