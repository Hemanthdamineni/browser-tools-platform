import { describe, expect, it } from 'vitest';
import tool from './rsa-encrypt-decrypt.tool';

type Result = { output: string; render?: string; stats?: Record<string, string | number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

// --- relocate the 0x04 OCTET STRING / 0x03 BIT STRING content of a DER blob ---
function findContent(bytes: Uint8Array, tag: number, start: number): { content: Uint8Array; end: number } {
  if (bytes[start] !== tag) throw new Error(`expected tag 0x${tag.toString(16)} at ${start}`);
  let i = start + 1;
  const first = bytes[i++]!;
  let len = first & 0x7f;
  if (first & 0x80) {
    const n = first & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = len * 256 + bytes[i++]!;
  }
  return { content: bytes.slice(i, i + len), end: i + len };
}

function unwrap(structured: Uint8Array, innerTag: number): Uint8Array {
  const seq = findContent(structured, 0x30, 0); // outer SEQUENCE
  let p = 0;
  while (p < seq.content.length) {
    const t = seq.content[p]!;
    const r = findContent(seq.content, t, p);
    if (t === innerTag) return r.content;
    p = r.end;
  }
  return new Uint8Array(0);
}

async function keyPair() {
  const subtle = globalThis.crypto.subtle;
  const pair = await subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
  return { spki, pkcs8 };
}

function pem(label: string, der: Uint8Array): string {
  const b64 = Buffer.from(der).toString('base64');
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

describe('rsa-encrypt-decrypt', () => {
  let spki: Uint8Array;
  let pkcs8: Uint8Array;
  let pubKey: string;
  let privKey: string;
  let pubPkcs1: Uint8Array;
  let privPkcs1: Uint8Array;

  it('setup: generate a fresh RSA-2048 pair and extract all four PEM forms', async () => {
    ({ spki, pkcs8 } = await keyPair());
    pubKey = pem('PUBLIC KEY', spki);
    privKey = pem('PRIVATE KEY', pkcs8);
    // RSAPublicKey is the BIT STRING content minus the leading 0x00 unused-bits byte
    const bitString = unwrap(spki, 0x03);
    pubPkcs1 = bitString.length && bitString[0] === 0 ? bitString.slice(1) : bitString;
    // RSAPrivateKey is the OCTET STRING content inside PKCS#8
    privPkcs1 = unwrap(pkcs8, 0x04).length ? unwrap(pkcs8, 0x04) : pkcs8;
    expect(pubPkcs1.length).toBeGreaterThan(100);
    expect(privPkcs1.length).toBeGreaterThan(100);
  });

  it('round-trips through SPKI/PKCS#8 PEM keys', async () => {
    const enc = await run(pubKey, { operation: 'encrypt', payload: 'attack at dawn' });
    expect(enc.output).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(enc.output.length).toBe(344); // 256-byte OAEP ciphertext in base64
    const dec = await run(privKey, { operation: 'decrypt', payload: enc.output });
    expect(dec.output).toBe('attack at dawn');
    expect(dec.render).toBe('text');
  });

  it('round-trips through PKCS#1 PEM keys (RSA PUBLIC KEY / RSA PRIVATE KEY)', async () => {
    const enc = await run(pem('RSA PUBLIC KEY', pubPkcs1), { operation: 'encrypt', payload: 'pkcs1 seal' });
    const dec = await run(pem('RSA PRIVATE KEY', privPkcs1), { operation: 'decrypt', payload: enc.output });
    expect(dec.output).toBe('pkcs1 seal');
  });

  it('supports hex ciphertext encoding end to end', async () => {
    const enc = await run(pubKey, { operation: 'encrypt', payload: 'hex-wire', format: 'hex' });
    expect(enc.output).toMatch(/^[0-9a-f]+$/);
    expect(enc.output.length).toBe(512);
    const dec = await run(privKey, { operation: 'decrypt', payload: enc.output, format: 'hex' });
    expect(dec.output).toBe('hex-wire');
  });

  it('rejects encrypting with a private key and decrypting with a public key', async () => {
    await expect(run(privKey, { operation: 'encrypt', payload: 'nope' })).rejects.toThrow(/public key/i);
    await expect(run(pubKey, { operation: 'decrypt', payload: 'AAAA' })).rejects.toThrow(/private key/i);
  });

  it('fails to decrypt with the wrong private key', async () => {
    const { pkcs8: other } = await keyPair();
    const enc = await run(pubKey, { operation: 'encrypt', payload: 'for alice only' });
    await expect(run(pem('PRIVATE KEY', other), { operation: 'decrypt', payload: enc.output })).rejects.toThrow(
      /decrypt/i,
    );
  });

  it('rejects a payload that is too large for the key', async () => {
    const big = 'x'.repeat(300);
    await expect(run(pubKey, { operation: 'encrypt', payload: big })).rejects.toThrow(/too large/i);
  });

  it('rejects missing key, missing payload and gibberish input', async () => {
    await expect(run('', { operation: 'encrypt', payload: 'a' })).rejects.toThrow(/paste the rsa key/i);
    await expect(run(pubKey, { operation: 'encrypt', payload: '   ' })).rejects.toThrow(/enter the payload/i);
    await expect(run('not a key at all', { operation: 'encrypt', payload: 'a' })).rejects.toThrow(/valid public/i);
    await expect(run(pem('PUBLIC KEY', new Uint8Array([1, 2, 3])), { operation: 'encrypt', payload: 'a' })).rejects.toThrow(
      /parseable public/i,
    );
  });

  it('supports a non-default OAEP hash when both sides agree', async () => {
    const subtle = globalThis.crypto.subtle;
    const pair = await subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-384' },
      true,
      ['encrypt', 'decrypt'],
    );
    const sp = pem('PUBLIC KEY', new Uint8Array(await subtle.exportKey('spki', pair.publicKey)));
    const pk = pem('PRIVATE KEY', new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey)));
    const enc = await run(sp, { operation: 'encrypt', payload: 'sha384', hash: 'sha-384' });
    const dec = await run(pk, { operation: 'decrypt', payload: enc.output, hash: 'sha-384' });
    expect(dec.output).toBe('sha384');
  });

  it('notes that the operation is handled locally', async () => {
    const enc = await run(pubKey, { operation: 'encrypt', payload: 'local' });
    expect(enc.render).toBe('code');
    expect(enc.notes?.join(' ')).toMatch(/locally|browser/i);
  });
});
