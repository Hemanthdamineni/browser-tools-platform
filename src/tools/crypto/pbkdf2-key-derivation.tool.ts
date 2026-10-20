import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pbkdf2-key-derivation.meta';

type Row = [string, string];

const HASH: Record<string, string> = {
  'sha-1': 'SHA-1',
  'sha-256': 'SHA-256',
  'sha-512': 'SHA-512',
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAX_ITERATIONS = 5_000_000;
const MAX_LENGTH = 1024;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 63];
  }
  return out;
}

function fromBase64(value: string, what: string): Uint8Array {
  const clean = value.replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    if (ch === '=') break;
    const v = B64.indexOf(ch);
    if (v === -1) {
      throw new ToolError(
        `The ${what} is not valid base64.`,
        'Switch the encoding selector to UTF-8 text or hex, or paste a clean base64 value.',
      );
    }
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function fromHex(value: string, what: string): Uint8Array {
  const clean = value.replace(/[\s:-]/g, '');
  if (!clean) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]+$/.test(clean)) {
    throw new ToolError(
      `The ${what} is not valid hex.`,
      'Hex accepts 0-9 and a-f only (spaces, colons and dashes are ignored).',
    );
  }
  if (clean.length % 2 !== 0) {
    throw new ToolError(
      `The ${what} has an odd number of hex digits.`,
      'Hex bytes need two digits each, for example 1a2b3c.',
    );
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function parseSalt(value: string, encoding: string): Uint8Array {
  if (encoding === 'hex') return fromHex(value, 'salt');
  if (encoding === 'base64') return fromBase64(value, 'salt');
  return new TextEncoder().encode(value);
}

/** Auto-detects hex (with optional separators) and falls back to base64. */
function parseExpected(value: string): Uint8Array {
  const compact = value.replace(/\s+/g, '');
  if (!compact) return new Uint8Array(0);
  const hexish = value.replace(/[\s:-]/g, '');
  if (hexish.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hexish)) return fromHex(hexish, 'expected key');
  return fromBase64(compact, 'expected key');
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const headers: string[] = ['Property', 'Value'];

  const passphrase = input.text ?? '';
  if (passphrase.trim() === '') {
    return {
      output: JSON.stringify({ headers, rows: [['Status', 'Waiting for a passphrase']] as Row[] }),
      render: 'table',
      notes: ['Type the passphrase to derive from in the input box, then choose the salt and iterations.'],
    };
  }

  const algorithm = String(o.hash);
  const hash = HASH[algorithm];
  if (!hash) {
    throw new ToolError(`Unknown PRF hash "${algorithm}".`, 'Use sha-1, sha-256 or sha-512.');
  }
  if (!crypto?.subtle) throw new ToolError('Web Crypto is not available in this environment.');

  const rawIterations = Number(o.iterations);
  if (!Number.isInteger(rawIterations) || rawIterations < 1) {
    throw new ToolError(
      'Iterations must be a whole number of at least 1.',
      'Use the OWASP recommendation, for example 600000.',
    );
  }
  if (rawIterations > MAX_ITERATIONS) {
    throw new ToolError(
      `More than ${MAX_ITERATIONS.toLocaleString('en-US')} iterations is refused to keep the page responsive.`,
      'Lower the count — 600000 is the OWASP recommendation for PBKDF2-HMAC-SHA256.',
    );
  }
  const iterations = rawIterations;

  const rawLength = Number(o.length);
  if (!Number.isInteger(rawLength) || rawLength < 1) {
    throw new ToolError('Key length must be a whole number of at least 1 byte.', 'Try 16, 24 or 32 bytes.');
  }
  if (rawLength > MAX_LENGTH) {
    throw new ToolError(
      `Key length is capped at ${MAX_LENGTH} bytes.`,
      'Output longer than the hash size costs extra PBKDF2 rounds; 32 bytes is typical.',
    );
  }
  const length = rawLength;

  const saltEncoding = String(o.saltEncoding);
  const salt = parseSalt(String(o.salt ?? ''), saltEncoding);
  if (salt.length === 0) {
    throw new ToolError(
      'A salt is required.',
      'Use at least 8 random bytes. The salt is stored next to the hash, so it does not need to be secret.',
    );
  }

  const passphraseBytes = new TextEncoder().encode(passphrase);
  const keyMaterial = await crypto.subtle.importKey('raw', passphraseBytes, { name: 'PBKDF2' }, false, [
    'deriveBits',
  ]);

  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash },
    keyMaterial,
    length * 8,
  );
  const derived = new Uint8Array(bits);
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;

  const rows: Row[] = [
    ['Algorithm', `PBKDF2-HMAC-${hash}`],
    ['Iterations', iterations.toLocaleString('en-US')],
    ['Salt', `${salt.length} byte${salt.length === 1 ? '' : 's'} (${saltEncoding})`],
    ['Salt (hex)', toHex(salt)],
    ['Passphrase length', `${passphraseBytes.length} bytes`],
    ['Derived key length', `${length} bytes (${length * 8} bits)`],
    ['Derived key (hex)', toHex(derived)],
    ['Derived key (base64)', toBase64(derived)],
    ['Elapsed', `${elapsed < 10 ? elapsed.toFixed(1) : Math.round(elapsed)} ms`],
  ];

  const notes: string[] = [];
  const expectedRaw = String(o.expected ?? '').trim();
  if (expectedRaw) {
    const expected = parseExpected(expectedRaw);
    if (expected.length === 0) {
      notes.push('The expected key is empty, so there is nothing to verify against.');
    } else if (expected.length !== derived.length) {
      rows.push(['Verification', `Mismatch (expected ${expected.length} bytes, derived ${length})`]);
      notes.push('The expected value has a different length than the derived key, so it cannot match.');
    } else if (constantTimeEqual(expected, derived)) {
      rows.push(['Verification', 'Match']);
      notes.push('Verification: Match — the derived bytes equal the expected key.');
    } else {
      rows.push(['Verification', 'Mismatch']);
      notes.push('Verification: Mismatch — same length, different bytes. Re-check the salt, iteration count and PRF hash.');
    }
  }

  const minIterations = algorithm === 'sha-512' ? 210000 : algorithm === 'sha-256' ? 600000 : 1300000;
  if (iterations < minIterations) {
    notes.push(
      `OWASP recommends at least ${minIterations.toLocaleString('en-US')} iterations for PBKDF2-HMAC-${hash}; ${iterations.toLocaleString('en-US')} is below that.`,
    );
  }
  if (salt.length < 8) {
    notes.push('Salts shorter than 8 bytes are weak — use at least 8 random bytes (16 is better).');
  }
  if (passphraseBytes.length < 8) {
    notes.push('A short passphrase is the weakest link: PBKDF2 stretches work but cannot add entropy that is not there.');
  }
  notes.push('Store the salt, iteration count and PRF hash alongside the derived key so the derivation can be repeated.');

  return {
    output: JSON.stringify({ headers, rows }),
    render: 'table',
    stats: {
      algorithm: `PBKDF2-HMAC-${hash}`,
      iterations,
      bytes: derived.length,
      timeMs: Math.round(elapsed * 10) / 10,
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
