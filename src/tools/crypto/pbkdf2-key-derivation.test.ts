import { describe, expect, it } from 'vitest';
import tool from './pbkdf2-key-derivation.tool';

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
const get = async (
  text: string,
  key: string,
  options: Record<string, string | number | boolean> = {},
) => table(await run(text, options)).rows.find((row) => row[0] === key)?.[1];

const sha1 = { hash: 'sha-1', salt: 'salt', length: 20 };

describe('pbkdf2-key-derivation', () => {
  it('prompts for a passphrase when the input is blank', async () => {
    const result = await run('   ');
    expect(result.render).toBe('table');
    expect(table(result).rows.find((r) => r[0] === 'Status')?.[1]).toBe('Waiting for a passphrase');
    expect(result.notes?.join(' ')).toMatch(/passphrase/i);
  });

  it('matches RFC 6070 vector 1 (c=1, dkLen=20)', async () => {
    const key = await get('password', 'Derived key (hex)', { ...sha1, iterations: 1 });
    expect(key).toBe('0c60c80f961f0e71f3a9b524af6012062fe037a6');
  });

  it('matches RFC 6070 vector 2 (c=2, dkLen=20)', async () => {
    const key = await get('password', 'Derived key (hex)', { ...sha1, iterations: 2 });
    expect(key).toBe('ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957');
  });

  it('matches RFC 6070 vector 3 (c=4096, dkLen=20)', async () => {
    const key = await get('password', 'Derived key (hex)', { ...sha1, iterations: 4096 });
    expect(key).toBe('4b007901b765489abead49d926f721d065a429c1');
  });

  it('matches RFC 6070 vector 4 (25-byte multi-block output)', async () => {
    const key = await get('passwordPASSWORDpassword', 'Derived key (hex)', {
      hash: 'sha-1',
      salt: 'saltSALTsaltSALTsaltSALTsaltSALTsalt',
      iterations: 4096,
      length: 25,
    });
    expect(key).toBe('3d2eec4fe41c849b80c8d83662c0e44a8b291a964cf2f07038');
  });

  it('matches the PBKDF2-HMAC-SHA256 reference vector (64 bytes)', async () => {
    const key = await get('passwd', 'Derived key (hex)', {
      hash: 'sha-256',
      salt: 'salt',
      iterations: 1,
      length: 64,
    });
    expect(key).toBe(
      '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783',
    );
  });

  it('encodes the derived key as base64', async () => {
    const result = await run('password', { ...sha1, iterations: 1, output: 'base64' });
    const b64 = table(result).rows.find((r) => r[0] === 'Derived key (base64)')?.[1];
    expect(b64).toBe('DGDID5YfDnHzqbUkr2ASBi/gN6Y=');
    expect(result.stats?.bytes).toBe(20);
  });

  it('accepts a hex salt that decodes to the same bytes', async () => {
    const key = await get('password', 'Derived key (hex)', {
      ...sha1,
      iterations: 1,
      salt: '73616c74',
      saltEncoding: 'hex',
    });
    expect(key).toBe('0c60c80f961f0e71f3a9b524af6012062fe037a6');
  });

  it('verifies a matching expected key in constant time', async () => {
    const result = await run('password', {
      ...sha1,
      iterations: 1,
      expected: '0C:60:C8:0F:96:1F:0E:71:F3:A9:B5:24:AF:60:12:06:2F:E0:37:A6',
    });
    const rows = table(result).rows;
    expect(rows.find((r) => r[0] === 'Verification')?.[1]).toBe('Match');
    expect(result.notes?.join(' ')).toMatch(/match/i);
  });

  it('reports a mismatch for a wrong expected key', async () => {
    const result = await run('password', {
      ...sha1,
      iterations: 1,
      expected: '00'.repeat(20),
    });
    const rows = table(result).rows;
    expect(rows.find((r) => r[0] === 'Verification')?.[1]).toBe('Mismatch');
    expect(result.notes?.join(' ')).toMatch(/mismatch/i);
  });

  it('flags a length difference between expected and derived key', async () => {
    const result = await run('password', { ...sha1, iterations: 1, expected: 'aabb' });
    const verdict = table(result).rows.find((r) => r[0] === 'Verification')?.[1];
    expect(verdict).toMatch(/length|Mismatch/);
    expect(result.notes?.join(' ')).toMatch(/different length/i);
  });

  it('derives 1-byte keys and reports stats', async () => {
    const result = await run('pw', { hash: 'sha-256', salt: 's', iterations: 1000, length: 1 });
    const hex = table(result).rows.find((r) => r[0] === 'Derived key (hex)')?.[1] ?? '';
    expect(hex).toHaveLength(2);
    expect(result.stats?.iterations).toBe(1000);
    expect(result.stats?.algorithm).toBe('PBKDF2-HMAC-SHA-256');
    expect(Number(result.stats?.timeMs)).toBeGreaterThanOrEqual(0);
  });

  it('warns when the iteration count is below the OWASP baseline', async () => {
    const result = await run('password', { ...sha1, iterations: 1000 });
    expect(result.notes?.join(' ')).toMatch(/OWASP recommends at least 1,300,000/i);
  });

  it('warns about short salts and short passphrases', async () => {
    const result = await run('pw', { hash: 'sha-256', salt: 'abc', iterations: 1000 });
    const joined = result.notes?.join(' ') ?? '';
    expect(joined).toMatch(/shorter than 8 bytes/i);
    expect(joined).toMatch(/short passphrase/i);
  });

  it('runs the recommended defaults without extra options', async () => {
    const result = await run('correct horse battery staple');
    const rows = table(result).rows;
    expect(rows.find((r) => r[0] === 'Algorithm')?.[1]).toBe('PBKDF2-HMAC-SHA-256');
    expect(rows.find((r) => r[0] === 'Iterations')?.[1]).toBe('600,000');
    expect(rows.find((r) => r[0] === 'Derived key length')?.[1]).toBe('32 bytes (256 bits)');
  });

  it('rejects an empty salt', async () => {
    await expect(run('password', { salt: '', iterations: 1 })).rejects.toThrow(/salt is required/i);
  });

  it('rejects iterations above the safety cap', async () => {
    await expect(run('password', { iterations: 5000001, salt: 'salt' })).rejects.toThrow(
      /responsive/i,
    );
  });

  it('rejects a non-integer iteration count', async () => {
    await expect(run('password', { iterations: 0, salt: 'salt' })).rejects.toThrow(/whole number/i);
  });

  it('rejects an oversized key length', async () => {
    await expect(run('password', { length: 2048, salt: 'salt', iterations: 1 })).rejects.toThrow(
      /capped/i,
    );
  });

  it('rejects an odd-length hex salt', async () => {
    await expect(
      run('password', { salt: 'abc', saltEncoding: 'hex', iterations: 1 }),
    ).rejects.toThrow(/odd number of hex digits/i);
  });

  it('rejects a salt with characters outside the base64 alphabet', async () => {
    await expect(
      run('password', { salt: 'not*base64', saltEncoding: 'base64', iterations: 1 }),
    ).rejects.toThrow(/not valid base64/i);
  });
});
