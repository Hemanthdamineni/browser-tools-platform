import { describe, expect, it } from 'vitest';
import tool from './keypair-generator.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
type Table = { headers: string[]; rows: [string, string][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result) => JSON.parse(r.output) as Table;
const row = (r: Result, key: string) => table(r).rows.find((x) => x[0] === key)?.[1];
const bodyOf = (pemText: string) =>
  Buffer.from(
    pemText
      .replace(/-----BEGIN [^-]+-----/, '')
      .replace(/-----END [^-]+-----/, '')
      .replace(/\s+/g, ''),
    'base64',
  );

describe('keypair-generator', () => {
  it('generates an RSA-2048 pair with wrapped PEM output', async () => {
    const result = await run('ping', { algorithm: 'rsa-2048' });
    const priv = row(result, 'Private key (PKCS#8)') ?? '';
    const pub = row(result, 'Public key (SPKI)') ?? '';
    expect(priv.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
    expect(priv.endsWith('-----END PRIVATE KEY-----')).toBe(true);
    expect(pub.startsWith('-----BEGIN PUBLIC KEY-----')).toBe(true);
    for (const line of priv.split('\n')) {
      if (!line.startsWith('-----')) expect(line.length).toBeLessThanOrEqual(64);
    }
    expect(row(result, 'Key size')).toBe('2048 bits');
    expect(row(result, 'Algorithm')).toMatch(/RSA-2048/);
  });

  it('reports a SHA-256 SPKI fingerprint that matches the exported key', async () => {
    const result = await run('', { algorithm: 'ecdsa-p256' });
    const pub = row(result, 'Public key (SPKI)') ?? '';
    const fp = (row(result, 'Public key fingerprint (SHA-256)') ?? '').replace(/:/g, '');
    const digest = Buffer.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bodyOf(pub))),
    ).toString('hex');
    expect(fp).toBe(digest);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cross-verifies the signature with the PEM public key', async () => {
    const result = await run('hello world', { algorithm: 'ecdsa-p256' });
    const pub = row(result, 'Public key (SPKI)') ?? '';
    const sig = row(result, 'Signature (base64)') ?? '';
    expect(row(result, 'Signature check')).toMatch(/^Valid/);
    const pubKey = await crypto.subtle.importKey(
      'spki',
      bodyOf(pub),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const data = new TextEncoder().encode('hello world');
    expect(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        pubKey,
        Buffer.from(sig, 'base64'),
        data,
      ),
    ).toBe(true);
    expect(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        pubKey,
        Buffer.from(sig, 'base64'),
        new TextEncoder().encode('tampered'),
      ),
    ).toBe(false);
  });

  it('generates an Ed25519 pair and verifies its signature', async () => {
    const result = await run('ed', { algorithm: 'ed25519' });
    expect(row(result, 'Key size')).toBe('256 bits');
    expect(row(result, 'Algorithm')).toBe('Ed25519');
    expect(row(result, 'Signature check')).toMatch(/^Valid/);
    expect(row(result, 'Signature (base64)')?.length).toBeGreaterThan(20);
  });

  it('verifies an RSA signature with the re-imported SPKI public key', async () => {
    const result = await run('sign me', { algorithm: 'rsa-2048' });
    const pub = row(result, 'Public key (SPKI)') ?? '';
    const sig = row(result, 'Signature (base64)') ?? '';
    expect(row(result, 'Signature check')).toMatch(/^Valid/);
    const pubKey = await crypto.subtle.importKey(
      'spki',
      bodyOf(pub),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const data = new TextEncoder().encode('sign me');
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      pubKey,
      Buffer.from(sig, 'base64'),
      data,
    );
    expect(ok).toBe(true);
  });

  it('produces distinct keys on each run', async () => {
    const a = await run('', { algorithm: 'ed25519' });
    const b = await run('', { algorithm: 'ed25519' });
    expect(row(a, 'Public key (SPKI)')).not.toBe(row(b, 'Public key (SPKI)'));
  });

  it('skips signing when there is no message', async () => {
    const result = await run('   ', { algorithm: 'ecdsa-p384' });
    expect(table(result).rows.find((x) => x[0] === 'Signature (base64)')).toBeUndefined();
    expect(result.notes?.join(' ')).toMatch(/add text to the input box/i);
  });

  it('skips signing when disabled by options', async () => {
    const result = await run('message', { algorithm: 'ecdsa-p256', sign: false });
    expect(table(result).rows.find((x) => x[0] === 'Signature (base64)')).toBeUndefined();
    expect(result.notes?.join(' ')).toMatch(/signing is disabled/i);
  });

  it('reports stats', async () => {
    const result = await run('', { algorithm: 'ecdsa-p256' });
    expect(result.stats?.algorithm).toBe('ecdsa-p256');
    expect(result.stats?.bits).toBe(256);
    expect(Number(result.stats?.publicBytes)).toBeGreaterThan(50);
    expect(Number(result.stats?.privateBytes)).toBeGreaterThan(50);
  });
});
