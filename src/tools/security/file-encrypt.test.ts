import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './file-encrypt.tool';

type Opts = Record<string, string | number | boolean>;

interface Result {
  outputs: { filename: string; blob: Blob }[];
  stats?: Record<string, string | number>;
  notes?: string[];
  warnings?: string[];
}

const PW = 'correct horse battery staple';
const CHUNK = 64 * 1024;
const HEADER = 40;

function file(bytes: Uint8Array<ArrayBuffer>, name = 'report.pdf'): File {
  return new File([bytes], name, { type: 'application/octet-stream' });
}

/** Deterministic, non-repeating bytes so a wrong chunk order shows up. */
function pattern(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (i * 31 + 7) & 0xff;
  return out;
}

const run = (files: File[], options: Opts = {}) => tool.run({ files, options }) as Promise<Result>;

const bytesOf = async (result: Result): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await result.outputs[0]!.blob.arrayBuffer());

async function encrypt(
  bytes: Uint8Array<ArrayBuffer>,
  name = 'report.pdf',
  password = PW,
): Promise<Uint8Array<ArrayBuffer>> {
  return bytesOf(await run([file(bytes, name)], { mode: 'encrypt', password }));
}

describe('file-encrypt', () => {
  it('round-trips a multi-chunk file', async () => {
    const plain = pattern(200_000); // 3 full chunks + a 3392-byte tail
    const enc = await run([file(plain)], { mode: 'encrypt', password: PW });
    expect(enc.stats?.chunks).toBe(4);

    const cipher = await bytesOf(enc);
    const dec = await run([file(cipher, 'report.pdf.tbenc')], { mode: 'decrypt', password: PW });
    expect(dec.outputs[0]!.filename).toBe('report.pdf');
    expect(await bytesOf(dec)).toEqual(plain);
  });

  it('writes a versioned header with the shared KDF parameters', async () => {
    const cipher = await encrypt(pattern(10), 'a.bin');
    const view = new DataView(cipher.buffer, cipher.byteOffset, cipher.byteLength);

    expect(String.fromCharCode(...cipher.slice(0, 6))).toBe('TBFENC');
    expect(cipher[6]).toBe(1); // format version
    expect(cipher[7]).toBe(1); // KDF id = PBKDF2-SHA256
    expect(view.getUint32(8)).toBe(600_000); // iterations, same as text-encrypt
    expect(view.getUint32(12)).toBe(CHUNK); // chunk size
    expect(cipher[40]).toBe(1); // the single record is the final one
    // header (40) + record header (5) + ciphertext (10) + tag (16)
    expect(cipher.byteLength).toBe(HEADER + 5 + 10 + 16);
  });

  it('round-trips an empty file', async () => {
    const enc = await run([file(new Uint8Array(0), 'empty.bin')], {
      mode: 'encrypt',
      password: PW,
    });
    expect(enc.stats?.chunks).toBe(1);

    const cipher = await bytesOf(enc);
    expect(cipher.byteLength).toBe(HEADER + 5 + 16);

    const dec = await run([file(cipher, 'empty.bin.tbenc')], { mode: 'decrypt', password: PW });
    expect((await bytesOf(dec)).byteLength).toBe(0);
  });

  it('produces different ciphertext for the same input and password', async () => {
    const a = await encrypt(pattern(500));
    const b = await encrypt(pattern(500));
    expect(a).not.toEqual(b);
    // salt (16..32) and nonce prefix (32..40) are random per file
    expect(a.slice(16, 40)).not.toEqual(b.slice(16, 40));
  });

  it('rejects a wrong password with one generic message', async () => {
    const cipher = await encrypt(pattern(5_000));
    await expect(
      run([file(cipher, 'x.tbenc')], { mode: 'decrypt', password: 'not the password' }),
    ).rejects.toThrow(/wrong password or corrupted file/i);
  });

  it('rejects a tampered ciphertext byte (GCM authentication failure)', async () => {
    const cipher = await encrypt(pattern(5_000));
    cipher[HEADER + 5 + 3]! ^= 0xff; // first record's ciphertext
    await expect(run([file(cipher, 'x.tbenc')], { mode: 'decrypt', password: PW })).rejects.toThrow(
      /wrong password or corrupted file/i,
    );
  });

  it('rejects a file truncated mid-record', async () => {
    const cipher = await encrypt(pattern(150_000));
    const cut = cipher.slice(0, cipher.length - 8);
    await expect(run([file(cut, 'x.tbenc')], { mode: 'decrypt', password: PW })).rejects.toThrow(
      /corrupted file/i,
    );
  });

  it('rejects a file whose final record was dropped', async () => {
    const cipher = await encrypt(pattern(150_000));
    const firstRecord = HEADER + 5 + CHUNK + 16; // header + first (non-final) record
    const withoutFinal = cipher.slice(0, firstRecord);
    await expect(
      run([file(withoutFinal, 'x.tbenc')], { mode: 'decrypt', password: PW }),
    ).rejects.toThrow(/no final chunk marker/i);
  });

  it('rejects trailing data appended after the final record', async () => {
    const cipher = await encrypt(pattern(100));
    const padded = new Uint8Array(cipher.length + 4);
    padded.set(cipher);
    await expect(run([file(padded, 'x.tbenc')], { mode: 'decrypt', password: PW })).rejects.toThrow(
      /data after the final chunk/i,
    );
  });

  it('rejects a file shorter than the header', async () => {
    await expect(
      run([file(pattern(10), 'short.tbenc')], { mode: 'decrypt', password: PW }),
    ).rejects.toBeInstanceOf(ToolError);
  });

  it('rejects an empty file on decrypt', async () => {
    await expect(
      run([file(new Uint8Array(0), 'empty.tbenc')], { mode: 'decrypt', password: PW }),
    ).rejects.toBeInstanceOf(ToolError);
  });

  it('rejects a file that is not a .tbenc container', async () => {
    await expect(
      run([file(pattern(200), 'notes.txt')], { mode: 'decrypt', password: PW }),
    ).rejects.toThrow(/not an encrypted file/i);
  });

  it('rejects a file with an unsupported format version', async () => {
    const cipher = await encrypt(pattern(100));
    cipher[6] = 2;
    await expect(run([file(cipher, 'x.tbenc')], { mode: 'decrypt', password: PW })).rejects.toThrow(
      /unsupported format version/i,
    );
  });

  it('names the output .tbenc and restores the original name on decrypt', async () => {
    const enc = await run([file(pattern(100), 'notes.txt')], { mode: 'encrypt', password: PW });
    expect(enc.outputs[0]!.filename).toBe('notes.txt.tbenc');

    const cipher = await bytesOf(enc);
    const back = await run([file(cipher, 'notes.txt.tbenc')], { mode: 'decrypt', password: PW });
    expect(back.outputs[0]!.filename).toBe('notes.txt');

    const renamed = await run([file(cipher, 'mystery.bin')], { mode: 'decrypt', password: PW });
    expect(renamed.outputs[0]!.filename).toBe('mystery.bin');
  });

  it('requires a password and a file', async () => {
    await expect(run([file(pattern(10))], { mode: 'encrypt' })).rejects.toThrow(
      /enter a password/i,
    );
    await expect(run([file(pattern(10))], { mode: 'encrypt', password: '' })).rejects.toThrow(
      /enter a password/i,
    );
    await expect(run([], { mode: 'encrypt', password: PW })).rejects.toThrow(/choose a file/i);
  });

  it('reports progress and KDF stats', async () => {
    const seen: number[] = [];
    const result = (await tool.run({
      files: [file(pattern(100))],
      options: { mode: 'encrypt', password: PW },
      onProgress: (fraction) => seen.push(fraction),
    })) as Result;

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(1);
    expect(result.stats?.algorithm).toBe('AES-256-GCM');
    expect(result.stats?.kdf).toBe('PBKDF2-SHA256 x600,000');
  });
});