import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './text-encrypt.tool';

type Opts = Record<string, string | number | boolean>;
const run = (text: string, options: Opts = {}) =>
  tool.run({ text, options }) as Promise<{ output: string; stats?: Record<string, unknown> }>;

const PW = 'correct horse battery staple';

describe('text-encrypt', () => {
  it('empty input → empty output (no password needed)', async () => {
    expect((await run('')).output).toBe('');
  });

  it('encrypts to a versioned base64 token', async () => {
    const { output } = await run('hello world', { mode: 'encrypt', password: PW });
    expect(output.startsWith('TBenc1.')).toBe(true);
    const body = output.slice('TBenc1.'.length);
    expect(/^[A-Za-z0-9+/]+={0,2}$/.test(body)).toBe(true);
    // salt(16) + iv(12) + ciphertext(11) + tag(16) = 55 bytes
    expect(atob(body).length).toBe(55);
  });

  it('decrypts a fixed known-answer token to its plaintext', async () => {
    const token =
      'TBenc1.VHnONYxWKMKAx6iMPgk+f7MulPOhXvyjQA2xntSPy2wMR9QWCJah30V1C92r9vd5IGYgCseVwe2K/ODCjk+wWYHPlPDXoKfV';
    const back = await run(token, { mode: 'decrypt', password: PW });
    expect(back.output).toBe('meet me at the docks at nine');
  });

  it('round-trips through encrypt then decrypt (default mode is encrypt)', async () => {
    const secret = 'meet me at the docks — 世界 🌊';
    const token = (await run(secret, { password: PW })).output;
    const back = await run(token, { mode: 'decrypt', password: PW });
    expect(back.output).toBe(secret);
  });

  it('produces a different token each time (random salt + IV)', async () => {
    const a = (await run('same text', { mode: 'encrypt', password: PW })).output;
    const b = (await run('same text', { mode: 'encrypt', password: PW })).output;
    expect(a).not.toBe(b);
  });

  it('reports KDF stats on encrypt', async () => {
    const res = await run('x', { mode: 'encrypt', password: PW });
    expect(res.stats?.iterations).toBe(600000);
    expect(res.stats?.kdf).toBe('PBKDF2-SHA256');
  });

  it('throws ToolError when the password is missing', async () => {
    await expect(run('secret', { mode: 'encrypt' })).rejects.toBeInstanceOf(ToolError);
    await expect(run('secret', { mode: 'encrypt', password: '' })).rejects.toThrow(
      /password is required/i,
    );
  });

  it('decrypt with the wrong password throws the generic ToolError', async () => {
    const token = (await run('top secret', { mode: 'encrypt', password: PW })).output;
    await expect(run(token, { mode: 'decrypt', password: 'wrong' })).rejects.toThrow(
      /wrong password or corrupted data/i,
    );
  });

  it('decrypt of non-token / corrupted input throws ToolError', async () => {
    await expect(run('not a token at all', { mode: 'decrypt', password: PW })).rejects.toThrow(
      /wrong password or corrupted data/i,
    );
    await expect(
      run('TBenc1.!!!!not base64!!!!', { mode: 'decrypt', password: PW }),
    ).rejects.toThrow(ToolError);
    await expect(run('TBenc1.QUJD', { mode: 'decrypt', password: PW })).rejects.toThrow(ToolError);
  });

  it('decrypt of a tampered token fails authentication', async () => {
    const token = (await run('integrity matters', { mode: 'encrypt', password: PW })).output;
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A') + token.slice(-1);
    await expect(run(tampered, { mode: 'decrypt', password: PW })).rejects.toThrow(ToolError);
  });
});
