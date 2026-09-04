import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './uuid-namespace.meta';

const NAMESPACES: Record<string, string> = {
  dns: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  url: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  oid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  x500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

function bytesToUuid(b: Uint8Array): string {
  const s = Array.from(b.subarray(0, 16), hex2).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/* --------------------------------- MD5 ----------------------------------- */
/* Pure-JS MD5 (RFC 1321). Operates on bytes, returns a 16-byte digest.     */

function rotl32(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = (() => {
  const k = new Uint32Array(64);
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  return k;
})();

function md5(bytes: Uint8Array): Uint8Array {
  const bitLen = bytes.length * 8;
  const paddedLen = (((bytes.length + 8) >>> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
  dv.setUint32(paddedLen - 4, Math.floor(bitLen / 4294967296) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let off = 0; off < paddedLen; off += 64) {
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
      f = (f + a + MD5_K[i]! + dv.getUint32(off + g * 4, true)) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl32(f, MD5_S[i]!)) >>> 0;
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

/* ----------------------------------------------------------------------- */

function resolveNamespace(namespace: string, custom: string): string {
  if (namespace === 'custom') {
    const value = custom.trim();
    if (!value) {
      throw new ToolError(
        'Enter a custom namespace UUID.',
        'e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      );
    }
    if (!UUID_RE.test(value)) {
      throw new ToolError(
        'The custom namespace is not a valid UUID.',
        'Expected 8-4-4-4-12 hexadecimal, like 6ba7b810-9dad-11d1-80b4-00c04fd430c8.',
      );
    }
    return value.toLowerCase();
  }
  return NAMESPACES[namespace] ?? NAMESPACES.dns!;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const version = String(o.version) === 'v3' ? 3 : 5;
  const namespaceUuid = resolveNamespace(String(o.namespace), String(o.customNamespace ?? ''));

  const nsBytes = uuidToBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(input.text);
  const data = new Uint8Array(nsBytes.length + nameBytes.length);
  data.set(nsBytes, 0);
  data.set(nameBytes, nsBytes.length);

  let hash: Uint8Array;
  if (version === 5) {
    hash = new Uint8Array(await crypto.subtle.digest('SHA-1', data));
  } else {
    hash = md5(data);
  }

  const out = hash.slice(0, 16);
  out[6] = (out[6]! & 0x0f) | (version << 4);
  out[8] = (out[8]! & 0x3f) | 0x80;

  const uuid = bytesToUuid(out);

  return {
    output: uuid,
    render: 'code',
    language: 'text',
    stats: {
      version: `v${version}`,
      algorithm: version === 5 ? 'SHA-1' : 'MD5',
      namespace: namespaceUuid,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
