import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './file-encrypt.tool';
import {
  PREFIX,
  ITERATIONS,
  CHUNK_SIZE,
  chunkPlan,
  encodeHeader,
  decodeHeader,
  deriveKey,
  encryptChunk,
  decryptChunk,
  encryptFile,
  decryptFile,
} from './file-encrypt.core';

const PW = 'correct horse battery staple';

const makeFile = (bytes: Uint8Array, name = 'secret.txt') =>
  new File([bytes as BlobPart], name, { type: 'application/octet-stream' });

const makeContainer = (data: Uint8Array, name = 'secret.txt', password = PW) =>
  encryptFile(makeFile(data, name), password).then((r) => r.container);

describe('file-encrypt core', () => {
  it('chunkPlan splits sizes correctly', () => {
    expect(chunkPlan(0)).toEqual([0]);
    expect(chunkPlan(CHUNK_SIZE)).toEqual([CHUNK_SIZE]);
    expect(chunkPlan(CHUNK_SIZE + 1)).toEqual([CHUNK_SIZE, 1]);
    expect(chunkPlan(10, 4)).toEqual([4, 4, 2]);
  });

  it('header round-trips', () => {
    const header = { format: 'FEenc1' as const, chunkSize: CHUNK_SIZE, salt: 'AAAA', chunks: 3 };
    const encoded = encodeHeader(header);
    expect(encoded.startsWith(PREFIX)).toBe(true);
    expect(decodeHeader(encoded)).toEqual(header);
  });

  it('decodeHeader rejects malformed input', () => {
    expect(() => decodeHeader('nope')).toThrow();
    expect(() => decodeHeader(`${PREFIX}####.`)).toThrow();
    expect(() => decodeHeader(`${PREFIX}eyJhIjoxfQ==.`)).toThrow(); // {"a":1}
  });

  it('chunk encrypt/decrypt round-trips and embeds IV', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(PW, salt);
    const plain = new TextEncoder().encode('hello chunk');
    const sealed = await encryptChunk(key, plain);
    expect(sealed.length).toBe(12 + plain.length + 16);
    const back = await decryptChunk(key, sealed);
    expect(Array.from(back)).toEqual(Array.from(plain));
  });

  it('decryptChunk rejects tampered chunks', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(PW, salt);
    const sealed = await encryptChunk(key, new TextEncoder().encode('data'));
    sealed[sealed.length - 1]! ^= 0xff;
    await expect(decryptChunk(key, sealed)).rejects.toThrow(/wrong password or corrupted/i);
  });

  it('encryptFile produces FEenc1 container with expected stats', async () => {
    const data = crypto.getRandomValues(new Uint8Array(2048));
    const res = await encryptFile(makeFile(data), PW);
    const text = await res.container.text();
    expect(text.startsWith(PREFIX)).toBe(true);
    expect(res.stats.iterations).toBe(ITERATIONS);
    expect(res.stats.cipher).toBe('AES-256-GCM');
    expect(res.stats.chunks).toBe(1);
  });

  it('multi-chunk files encrypt and decrypt correctly', async () => {
    const data = new Uint8Array(CHUNK_SIZE + 500);
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff;
    const container = await makeContainer(data, 'big.bin');
    const asFile = new File([container], 'big.bin.feenc');
    const res = await decryptFile(asFile, PW);
    const back = new Uint8Array(await res.file.arrayBuffer());
    expect(back.length).toBe(data.length);
    expect(Array.from(back)).toEqual(Array.from(data));
    expect(res.stats.chunks).toBe(2);
  });

  it('remembers filename only when asked', async () => {
    const data = new TextEncoder().encode('tiny');
    const named = await encryptFile(makeFile(data, 'report.pdf'), PW, { rememberName: true });
    const res = await decryptFile(new File([named.container], 'report.pdf.feenc'), PW);
    expect(res.filename).toBe('report.pdf');

    const anon = await encryptFile(makeFile(data, 'report.pdf'), PW);
    const res2 = await decryptFile(new File([anon.container], 'whatever.feenc'), PW);
    expect(res2.filename).toBe('whatever');
  });
});

describe('file-encrypt tool', async () => {
  const data = new TextEncoder().encode('top secret payload');

  const encryptRun = async (file: File, options: Record<string, string> = {}) =>
    tool.run({ files: [file], options: { mode: 'encrypt', password: PW, ...options } });

  const decryptRun = async (file: File, options: Record<string, string> = {}) =>
    tool.run({ files: [file], options: { mode: 'decrypt', password: PW, ...options } });

  it('round-trips a file through encrypt then decrypt', async () => {
    const enc = await encryptRun(makeFile(data, 'note.txt'));
    const out = enc.outputs[0]!;
    expect(out.filename).toBe('note.txt.feenc');
    const blobText = await out.blob.text();
    expect(blobText.startsWith(PREFIX)).toBe(true);

    const dec = await decryptRun(new File([out.blob], 'note.txt.feenc'));
    const back = new Uint8Array(await dec.outputs[0]!.blob.arrayBuffer());
    expect(Array.from(back)).toEqual(Array.from(data));
  });

  it('reports KDF stats', async () => {
    const res = await encryptRun(makeFile(data));
    expect(res.stats?.iterations).toBe(ITERATIONS);
    expect(res.stats?.kdf).toBe('PBKDF2-SHA256');
  });

  it('throws ToolError when password is missing', async () => {
    await expect(encryptRun(makeFile(data), { password: '' })).rejects.toBeInstanceOf(ToolError);
  });

  it('throws ToolError when no file is provided', async () => {
    await expect(
      tool.run({ files: [], options: { mode: 'encrypt', password: PW } }),
    ).rejects.toBeInstanceOf(ToolError);
  });

  it('decrypt with wrong password throws ToolError', async () => {
    const enc = await encryptRun(makeFile(data));
    await expect(
      decryptRun(new File([enc.outputs[0]!.blob], 'x.feenc'), { password: 'wrong' }),
    ).rejects.toBeInstanceOf(ToolError);
  });

  it('decrypt of a non-container file throws ToolError', async () => {
    await expect(decryptRun(makeFile(data, 'plain.txt'))).rejects.toBeInstanceOf(ToolError);
  });
});
