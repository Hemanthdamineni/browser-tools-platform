import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './rsa-encrypt-decrypt.meta';

// ---- minimal DER writer (only the handful of fixed wrappers RSA needs) ----

function derLength(len: number): number[] {
  if (len < 0x80) return [len];
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

function derBytes(tag: number, content: number[]): number[] {
  return [tag, ...derLength(content.length), ...content];
}

const OID_RSA = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];

function wrapPkcs1PrivateToPkcs8(pkcs1: Uint8Array): Uint8Array {
  // SEQUENCE { INTEGER 0, SEQUENCE { OID rsaEncryption, NULL }, OCTET STRING pkcs1 }
  const version = derBytes(0x02, [0x00]);
  const alg = derBytes(0x30, [...OID_RSA, 0x05, 0x00]);
  const octet = derBytes(0x04, [...pkcs1]);
  return new Uint8Array(derBytes(0x30, [...version, ...alg, ...octet]));
}

function wrapPkcs1PublicToSpki(rsaPublic: Uint8Array): Uint8Array {
  // SEQUENCE { SEQUENCE { OID rsaEncryption, NULL }, BIT STRING (unused=0, rsaPublic) }
  const alg = derBytes(0x30, [...OID_RSA, 0x05, 0x00]);
  const bitString = derBytes(0x03, [0x00, ...rsaPublic]);
  return new Uint8Array(derBytes(0x30, [...alg, ...bitString]));
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function readKeyPem(input: string): { header: string; body: string } | null {
  const m = input.match(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) return null;
  return { header: m[1]!.trim(), body: m[2]!.replace(/\s+/g, '') };
}

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new ToolError('Web Crypto API is not available in this browser.');
  return s;
};

const HASHES: Record<string, string> = {
  'sha-1': 'SHA-1',
  'sha-256': 'SHA-256',
  'sha-384': 'SHA-384',
};

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(clean))
    throw new ToolError(
      'Invalid hex ciphertext.',
      'Use pairs of hex digits, optionally with spaces.',
    );
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function importByFormat(
  der: Uint8Array,
  format: 'spki' | 'pkcs8',
  hash: string,
): Promise<CryptoKey> {
  const node = subtle();
  try {
    return await node.importKey(
      format,
      der as unknown as BufferSource,
      { name: 'RSA-OAEP', hash },
      false,
      format === 'spki' ? ['encrypt'] : ['decrypt'],
    );
  } catch {
    throw new ToolError(
      `This does not look like a parseable ${format === 'spki' ? 'public' : 'private'} RSA key.`,
      'Paste a PEM key (BEGIN PUBLIC KEY / BEGIN RSA PUBLIC KEY for encrypting, or BEGIN PRIVATE KEY / BEGIN RSA PRIVATE KEY for decrypting).',
    );
  }
}

async function prepareKey(
  input: string,
  operation: 'encrypt' | 'decrypt',
  hash: string,
): Promise<CryptoKey> {
  const pem = readKeyPem(input);
  if (pem) {
    const body = fromBase64(pem.body);
    if (operation === 'encrypt') {
      if (pem.header === 'PUBLIC KEY') return importByFormat(body, 'spki', hash);
      if (pem.header === 'RSA PUBLIC KEY')
        return importByFormat(wrapPkcs1PublicToSpki(body), 'spki', hash);
      throw new ToolError(
        'Encryption needs a public key, but a private key was provided.',
        'Use the matching PUBLIC KEY (or RSA PUBLIC KEY) for encrypting; private keys are only for decrypting.',
      );
    }
    if (pem.header === 'PRIVATE KEY') return importByFormat(body, 'pkcs8', hash);
    if (pem.header === 'RSA PRIVATE KEY')
      return importByFormat(wrapPkcs1PrivateToPkcs8(body), 'pkcs8', hash);
    throw new ToolError(
      'Decryption needs a private key, but a public key was provided.',
      'Use the matching PRIVATE KEY (or RSA PRIVATE KEY) for decrypting.',
    );
  }
  // No PEM header: treat the input as raw base64 and try the sensible formats.
  let raw: Uint8Array;
  try {
    raw = fromBase64(input);
  } catch {
    throw new ToolError(
      'No PEM block or base64 key found in the input.',
      'Paste a full PEM block such as -----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY-----.',
    );
  }
  if (operation === 'encrypt') {
    const node = subtle();
    for (const k of [raw, wrapPkcs1PublicToSpki(raw)] as Uint8Array[]) {
      try {
        return await node.importKey(
          'spki',
          k as unknown as BufferSource,
          { name: 'RSA-OAEP', hash },
          false,
          ['encrypt'],
        );
      } catch {
        /* try next */
      }
    }
  } else {
    const node = subtle();
    for (const k of [raw, wrapPkcs1PrivateToPkcs8(raw)] as Uint8Array[]) {
      try {
        return await node.importKey(
          'pkcs8',
          k as unknown as BufferSource,
          { name: 'RSA-OAEP', hash },
          false,
          ['decrypt'],
        );
      } catch {
        /* try next */
      }
    }
  }
  throw new ToolError(
    `This does not look like a valid ${operation === 'encrypt' ? 'public' : 'private'} RSA key for the ${hash.toUpperCase()} hash.`,
    'Confirm the key is RSA and — when decrypting — that the OAEP hash matches the one used to encrypt.',
  );
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const operation: 'encrypt' | 'decrypt' =
    String(o.operation) === 'decrypt' ? 'decrypt' : 'encrypt';
  const hash = HASHES[String(o.hash)] ?? 'SHA-256';
  const format: 'base64' | 'hex' = String(o.format) === 'hex' ? 'hex' : 'base64';

  const keyText = (input.text ?? '').trim();
  if (!keyText) {
    throw new ToolError(
      'Paste the RSA key to use.',
      `A ${operation === 'encrypt' ? 'public' : 'private'} key in PEM form is required.`,
    );
  }
  const payload = String(o.payload ?? '').trim();
  if (!payload) {
    throw new ToolError(
      `Enter the payload to ${operation}.`,
      operation === 'encrypt'
        ? 'The plain-text message to seal with the public key.'
        : 'The base64 or hex ciphertext produced by the sender.',
    );
  }

  const key = await prepareKey(keyText, operation, hash);
  const node = subtle();
  const notes: string[] = [];

  let output: string;
  let data: Uint8Array;

  if (operation === 'encrypt') {
    data = new TextEncoder().encode(payload);
    try {
      const cipher = await node.encrypt({ name: 'RSA-OAEP' }, key, data as unknown as BufferSource);
      const bytes = new Uint8Array(cipher);
      output = format === 'hex' ? bytesToHex(bytes) : toBase64(bytes);
      notes.push(
        `Encrypted ${data.length} bytes with RSA-OAEP/${hash} into ${bytes.length} bytes of ${format} ciphertext.`,
      );
    } catch {
      throw new ToolError(
        'Encryption failed: the message is too large for this key.',
        'A 2048-bit RSA-OAEP key holds at most 214 bytes; encrypt a smaller message, or use a larger key.',
      );
    }
  } else {
    data = format === 'hex' ? hexToBytes(payload) : fromBase64(payload);
    let plain: ArrayBuffer;
    try {
      plain = await node.decrypt({ name: 'RSA-OAEP' }, key, data as unknown as BufferSource);
    } catch {
      throw new ToolError(
        'Decryption failed.',
        'The ciphertext was not produced with this key, or the OAEP hash option does not match the one used to encrypt.',
      );
    }
    output = new TextDecoder().decode(plain);
    notes.push(`Decrypted ${data.length} bytes of ${format} ciphertext successfully.`);
  }

  notes.push(
    `${operation === 'encrypt' ? 'Public' : 'Private'} RSA key processed locally with ${hash} OAEP padding.`,
  );
  notes.push('Nothing was sent over the network; the key is handled only in your browser.');

  return {
    output,
    render: operation === 'encrypt' ? 'code' : 'text',
    stats: {
      operation,
      hash,
      payloadBytes: data.length,
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
