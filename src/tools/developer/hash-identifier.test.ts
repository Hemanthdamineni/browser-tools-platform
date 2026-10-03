import { describe, it, expect } from 'vitest';
import tool from './hash-identifier.tool';

interface Res {
  output: string;
  stats?: Record<string, string | number>;
}

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Res;

const table = (r: Awaited<ReturnType<typeof run>>) =>
  JSON.parse(r.output) as { headers: string[]; rows: string[][] };
const types = (r: Awaited<ReturnType<typeof run>>) => table(r).rows.map((row) => row[0]);

describe('hash-identifier', async () => {
  it('identifies a 32-hex string as MD5, NTLM and MD4', async () => {
    const r = await run('5d41402abc4b2a76b9719d911017c592');
    expect(table(r).headers).toEqual(['Possible type', 'Confidence', 'Note']);
    expect(types(r)).toEqual(expect.arrayContaining(['MD5', 'NTLM', 'MD4']));
    expect(table(r).rows[0]).toEqual(['MD5', 'High', expect.stringContaining('32 hex')]);
    expect(r.stats!['character set']).toBe('hexadecimal');
  });

  it('identifies SHA-1 (40 hex), SHA-224 (56), SHA-256 (64), SHA-384 (96), SHA-512 (128)', async () => {
    expect(types(await run('a'.repeat(40)))).toContain('SHA-1');
    expect(types(await run('a'.repeat(56)))).toContain('SHA-224');
    expect(types(await run('a'.repeat(64)))).toContain('SHA-256');
    expect(types(await run('a'.repeat(96)))).toContain('SHA-384');
    expect(types(await run('a'.repeat(128)))).toContain('SHA-512');
  });

  it('identifies CRC32 for an 8-hex string', async () => {
    const r = await run('deadbeef');
    expect(table(r).rows[0]![0]).toBe('CRC32');
  });

  it('identifies bcrypt by its modular-crypt prefix', async () => {
    const r = await run('$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
    expect(table(r).rows[0]).toEqual(['bcrypt', 'High', expect.stringContaining('cost')]);
  });

  it('identifies Argon2 and reports the variant', async () => {
    const r = await run(
      '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG',
    );
    expect(types(r)).toContain('Argon2 (id)');
  });

  it('identifies PBKDF2 from an algo:iterations:salt:hash string', async () => {
    expect(types(await run('sha256:29000:c29tZXNhbHQ=:aGFzaHZhbHVlZGF0YQ=='))).toContain('PBKDF2');
  });

  it('identifies MD5-crypt and SHA-512-crypt from $1$ and $6$', async () => {
    expect(types(await run('$1$abcdefgh$ju6p5eqZ1w2Kc0Xk8yqQ4/'))).toContain('MD5-crypt');
    expect(types(await run('$6$rounds=5000$salt$hashhashhash'))).toContain('SHA-512-crypt');
  });

  it('identifies a MySQL 4.1 hash (leading * then 40 hex)', async () => {
    const r = await run('*2470C0C06DEE42FD1618BB99005ADCA2EC9D1E19');
    expect(table(r).rows[0]![0]).toBe('MySQL 4.1+ (mysql5)');
  });

  it('offers base64 as a low-confidence option for non-hex multiple-of-4 strings', async () => {
    const r = await run('YWJjZGVmZ2g=');
    expect(types(r)).toEqual(['base64']);
    expect(table(r).rows[0]![1]).toBe('Low');
    expect(r.stats!['character set']).toBe('base64');
  });

  it('returns an Unknown row when nothing matches', async () => {
    const r = await run('not-a-hash!!');
    expect(table(r).rows[0]![0]).toBe('Unknown');
    expect(r.stats!.matches).toBe(0);
  });

  it('returns empty output for empty or whitespace-only input', async () => {
    expect((await run('')).output).toBe('');
    expect((await run('   ')).output).toBe('');
  });

  it('throws ToolError when the input contains internal whitespace', async () => {
    await expect(run('5d41402abc4b2a76 b9719d911017c592')).rejects.toThrow(/single token/i);
    await expect(run('line1\nline2')).rejects.toThrow(/single token/i);
  });
});
