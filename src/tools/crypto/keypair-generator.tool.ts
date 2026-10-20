import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './keypair-generator.meta';

type Row = [string, string];

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

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

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function pem(label: string, der: Uint8Array): string {
  const body = toBase64(der);
  const lines: string[] = [];
  for (let i = 0; i < body.length; i += 64) lines.push(body.slice(i, i + 64));
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function fingerprintColons(sha: string): string {
  return sha.replace(/(..)(?=.)/g, '$1:');
}

const KEY_GEN: Record<
  string,
  { label: string; keySize: string; generate: () => Promise<CryptoKeyPair> }
> = {
  'rsa-2048': {
    label: 'RSA-2048 (RSASSA-PKCS1-v1_5, SHA-256)',
    keySize: '2048 bits',
    generate: () =>
      crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['sign', 'verify'],
      ),
  },
  'rsa-3072': {
    label: 'RSA-3072 (RSASSA-PKCS1-v1_5, SHA-256)',
    keySize: '3072 bits',
    generate: () =>
      crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['sign', 'verify'],
      ),
  },
  'rsa-4096': {
    label: 'RSA-4096 (RSASSA-PKCS1-v1_5, SHA-256)',
    keySize: '4096 bits',
    generate: () =>
      crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['sign', 'verify'],
      ),
  },
  'ecdsa-p256': {
    label: 'ECDSA P-256 (SHA-256)',
    keySize: '256 bits',
    generate: () => crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']),
  },
  'ecdsa-p384': {
    label: 'ECDSA P-384 (SHA-384)',
    keySize: '384 bits',
    generate: () => crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-384' }, true, ['sign', 'verify']),
  },
  ed25519: {
    label: 'Ed25519',
    keySize: '256 bits',
    generate: () => crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']),
  },
};

/** Sign/verify algorithm descriptor that matches the generated key. */
function signAlg(kind: string, algorithm: string): Algorithm | EcdsaParams {
  if (kind === 'rsa') return { name: 'RSASSA-PKCS1-v1_5' };
  if (kind === 'ecdsa') return { name: 'ECDSA', hash: algorithm === 'ecdsa-p384' ? 'SHA-384' : 'SHA-256' };
  return { name: 'Ed25519' };
}

const KIND: Record<string, 'rsa' | 'ecdsa' | 'ed25519'> = {
  'rsa-2048': 'rsa',
  'rsa-3072': 'rsa',
  'rsa-4096': 'rsa',
  'ecdsa-p256': 'ecdsa',
  'ecdsa-p384': 'ecdsa',
  ed25519: 'ed25519',
};

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!crypto?.subtle) throw new ToolError('Web Crypto is not available in this environment.');

  const algorithm = String(o.algorithm);
  const def = KEY_GEN[algorithm];
  if (!def) throw new ToolError(`Unknown algorithm "${algorithm}".`, 'Pick one of the choices in the options panel.');

  let pair: CryptoKeyPair;
  try {
    pair = await def.generate();
  } catch (err) {
    throw new ToolError(
      `${def.label} is not supported in this browser or environment.`,
      `Try another algorithm. (${err instanceof Error ? err.message : 'error'})`,
    );
  }

  const privDer = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const pubDer = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pubDer as unknown as BufferSource));
  const fingerprint = fingerprintColons(toHex(digest));

  const privPem = pem('PRIVATE KEY', privDer);
  const pubPem = pem('PUBLIC KEY', pubDer);

  const rows: Row[] = [
    ['Algorithm', def.label],
    ['Key size', def.keySize],
    ['Public key fingerprint (SHA-256)', fingerprint],
    ['Private key (PKCS#8)', privPem],
    ['Public key (SPKI)', pubPem],
  ];

  const notes: string[] = [];
  notes.push(
    `Fingerprint is the SHA-256 of the public SPKI bytes — a quick way to compare keys across systems.`,
  );
  notes.push('Keys are generated in memory and are NOT stored. Copy both PEM blocks before leaving this page.');
  if (algorithm.startsWith('rsa-')) {
    notes.push('RSA keys are generated by searching for large primes, so larger sizes take a few seconds.');
  }

  const message = input.text ?? '';
  const wantSign = o.sign !== false;
  if (message.trim() !== '' && wantSign) {
    const kind = KIND[algorithm]!;
    const data = new TextEncoder().encode(message);
    const sigBytes = new Uint8Array(await crypto.subtle.sign(signAlg(kind, algorithm), pair.privateKey, data));
    const ok = await crypto.subtle.verify(signAlg(kind, algorithm), pair.publicKey, sigBytes as unknown as BufferSource, data);
    rows.push(
      ['Signed message', `"${message.length > 60 ? message.slice(0, 60) + '\u2026' : message}" (${message.length} chars)`],
      ['Signature (base64)', toBase64(sigBytes)],
      ['Signature check', ok ? 'Valid — signature verifies against the public key' : 'Invalid'],
    );
  } else if (message.trim() !== '') {
    notes.push('Signing is disabled by the options. Re-enable "Sign the input text" to sign the message.');
  } else {
    notes.push('Add text to the input box to sign it with the private key and verify it against the public key.');
  }

  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
    render: 'table',
    stats: {
      algorithm,
      bits: algorithm.startsWith('rsa-') ? Number(algorithm.split('-')[1]) : 256,
      privateBytes: privDer.length,
      publicBytes: pubDer.length,
    },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
