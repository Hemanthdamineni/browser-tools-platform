import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './jwt-sign.meta';

/** JWT `alg` → Web Crypto hash name. Only the HMAC (HS*) family is supported. */
const ALGS: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

const encoder = new TextEncoder();

function bytesToB64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8ToB64url(text: string): string {
  return bytesToB64url(encoder.encode(text));
}

function b64urlToBytes(segment: string): Uint8Array {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = b64.length % 4;
  if (remainder === 1) {
    throw new ToolError(
      'A token segment is not valid base64url.',
      'Check that the whole token was pasted.',
    );
  }
  const padded = remainder ? b64 + '='.repeat(4 - remainder) : b64;
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new ToolError(
      'A token segment is not valid base64url.',
      'Check that the whole token was pasted.',
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlToJson(segment: string, label: string): unknown {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(b64urlToBytes(segment));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ToolError(
      `The token ${label} is not valid JSON.`,
      'This does not look like a well-formed JWT.',
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Constant-time-ish compare so verification does not leak the signature by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(alg: string, secret: string, data: string): Promise<Uint8Array> {
  const hash = ALGS[alg];
  if (!hash) {
    throw new ToolError(
      `Unsupported algorithm "${alg}".`,
      'Only HMAC tokens (HS256, HS384, HS512) can be signed or verified here.',
    );
  }
  if (!crypto?.subtle) {
    throw new ToolError('Web Crypto is not available in this browser.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

function formatUtc(seconds: number): string | null {
  const ms = seconds * 1000;
  // Date supports ±8.64e15 ms; anything outside would throw a RangeError.
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return null;
  return new Date(ms).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

async function sign(
  input: TextRunInput,
  o: Record<string, string | number | boolean>,
): Promise<TextRunResult> {
  const raw = input.text.trim();
  if (!raw) return { output: '' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolError(
      'The payload is not valid JSON.',
      'Enter the claims as a JSON object, e.g. {"sub":"123"}.',
    );
  }
  const claims = asRecord(parsed);
  if (!claims) {
    throw new ToolError(
      'The JWT payload must be a JSON object of claims.',
      'Arrays and bare values are not valid JWT payloads.',
    );
  }

  const secret = String(o.secret ?? '');
  if (!secret) {
    throw new ToolError(
      'Enter the signing secret.',
      'The secret is the HMAC key used to sign the token.',
    );
  }

  const alg = String(o.algorithm);
  if (!ALGS[alg]) {
    throw new ToolError(`Unsupported algorithm "${alg}".`, 'Choose HS256, HS384 or HS512.');
  }

  const now = Math.floor(Date.now() / 1000);
  const body: Record<string, unknown> = { ...claims };
  if (o.addIat) body.iat = now;

  const minutes = Number(o.expiresIn);
  if (Number.isFinite(minutes) && minutes > 0) {
    const base = typeof body.iat === 'number' ? body.iat : now;
    const exp = Math.floor(base + minutes * 60);
    if (!Number.isSafeInteger(exp) || exp <= 0) {
      throw new ToolError('The expiry is out of range.', 'Use a smaller number of minutes.');
    }
    body.exp = exp;
  }

  const header: Record<string, unknown> = { alg };
  if (o.typ) header.typ = 'JWT';

  const headerB64 = utf8ToB64url(JSON.stringify(header));
  const payloadB64 = utf8ToB64url(JSON.stringify(body));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = bytesToB64url(await hmac(alg, secret, signingInput));
  const token = `${signingInput}.${signature}`;

  const stats: Record<string, string | number> = {
    algorithm: alg,
    'header bytes': encoder.encode(JSON.stringify(header)).length,
    'payload bytes': encoder.encode(JSON.stringify(body)).length,
    'token chars': token.length,
  };

  return { output: token, render: 'code', language: 'jwt', filename: 'token.jwt', stats };
}

async function verify(
  input: TextRunInput,
  o: Record<string, string | number | boolean>,
): Promise<TextRunResult> {
  const token = input.text.trim();
  if (!token) return { output: '' };

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new ToolError(
      'A JWT has three dot-separated parts: header.payload.signature.',
      `Found ${parts.length} part${parts.length === 1 ? '' : 's'}.`,
    );
  }
  const [headerB64, payloadB64, signature] = parts as [string, string, string];

  const header = asRecord(b64urlToJson(headerB64, 'header'));
  if (!header) {
    throw new ToolError('The token header is not a JSON object.', 'This does not look like a JWT.');
  }

  const alg = typeof header.alg === 'string' ? header.alg : '';
  if (!ALGS[alg]) {
    throw new ToolError(
      `Cannot verify a token signed with "${alg || 'an unknown algorithm'}".`,
      'Only HMAC tokens (HS256, HS384, HS512) can be verified here.',
    );
  }

  const secret = String(o.secret ?? '');
  if (!secret) {
    throw new ToolError(
      'Enter the signing secret to verify the signature.',
      'The same secret the issuer used is required.',
    );
  }

  const expected = bytesToB64url(await hmac(alg, secret, `${headerB64}.${payloadB64}`));
  const valid = safeEqual(expected, signature.replace(/=+$/, ''));

  const notes: string[] = [];
  const warnings: string[] = [];
  const claims = asRecord(b64urlToJson(payloadB64, 'payload'));
  const now = Math.floor(Date.now() / 1000);

  if (claims) {
    if (typeof claims.exp === 'number') {
      const label = formatUtc(claims.exp);
      if (label) {
        const expired = claims.exp < now;
        const line = `exp ${label}${expired ? ' — expired' : ' — still valid'}`;
        if (expired) warnings.push(line);
        else notes.push(line);
      }
    }
    if (typeof claims.nbf === 'number' && claims.nbf > now) {
      const label = formatUtc(claims.nbf);
      if (label) warnings.push(`nbf ${label} — not valid before this time`);
    }
  }
  if (Array.isArray(header.crit) && header.crit.length > 0) {
    warnings.push(
      `The header uses a "crit" extension (${header.crit.join(', ')}); only accept this token if your verifier understands those parameters.`,
    );
  }

  notes.push(
    valid
      ? 'Signature matches. The token was signed with the secret you supplied and has not been altered.'
      : 'Signature does not match this secret. The token may have been tampered with or signed with a different secret.',
  );

  return {
    output: valid ? 'Signature VALID' : 'Signature INVALID',
    render: 'text',
    notes,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { algorithm: alg, signature: valid ? 'valid' : 'invalid' },
  };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  return String(o.mode) === 'verify' ? verify(input, o) : sign(input, o);
}

const tool: TextToolModule = { meta, run };
export default tool;
