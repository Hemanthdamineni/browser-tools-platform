import { describe, expect, it } from 'vitest';
import tool from './bcrypt.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('bcrypt', () => {
  it('hashes a password and produces a valid $2b$ hash', async () => {
    const result = await run('test-password', { mode: 'hash', cost: 10 });
    expect(result.output).toMatch(/^\$2b\$10\$[./A-Za-z0-9]{53}$/);
    expect(result.stats?.cost).toBe(10);
  });

  it('produces different hashes for the same password (different salts)', async () => {
    const hash1 = (await run('same-password', { mode: 'hash', cost: 10 })).output;
    const hash2 = (await run('same-password', { mode: 'hash', cost: 10 })).output;
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different costs', async () => {
    const hash10 = (await run('password', { mode: 'hash', cost: 10 })).output;
    const hash12 = (await run('password', { mode: 'hash', cost: 12 })).output;
    expect(hash10).not.toBe(hash12);
    expect(hash10).toMatch(/^\$2b\$10\$/);
    expect(hash12).toMatch(/^\$2b\$12\$/);
  });

  it('verifies a correct password against its hash', async () => {
    const hashResult = await run('correct-password', { mode: 'hash', cost: 10 });
    const verifyResult = await run('correct-password', { mode: 'verify', hash: hashResult.output });
    expect(verifyResult.output).toContain('matches');
    expect(verifyResult.stats?.result).toBe('match');
  });

  it('rejects an incorrect password', async () => {
    const hashResult = await run('correct-password', { mode: 'hash', cost: 10 });
    const verifyResult = await run('wrong-password', { mode: 'verify', hash: hashResult.output });
    expect(verifyResult.output).toContain('does not match');
    expect(verifyResult.stats?.result).toBe('mismatch');
  });

  it('outputs JSON format when requested', async () => {
    const result = await run('test-password', { mode: 'hash', cost: 10, outputFormat: 'json' });
    const parsed = JSON.parse(result.output);
    expect(parsed.algorithm).toBe('bcrypt');
    expect(parsed.variant).toBe('2b');
    expect(parsed.cost).toBe(10);
    expect(parsed.hash).toMatch(/^\$2b\$10\$/);
    expect(result.render).toBe('code');
  });

  it('hashes empty string password', async () => {
    const result = await run('', { mode: 'hash', cost: 10 });
    expect(result.output).toMatch(/^\$2b\$10\$/);
  });

  it('verifies empty string password', async () => {
    const hashResult = await run('', { mode: 'hash', cost: 10 });
    const verifyResult = await run('', { mode: 'verify', hash: hashResult.output });
    expect(verifyResult.stats?.result).toBe('match');
  });
  it('throws on missing hash for verification', async () => {
    await expect(run('password', { mode: 'verify' })).rejects.toThrow(/bcrypt hash/i);
  });

  it('throws on invalid cost factor (too low)', async () => {
    await expect(run('password', { mode: 'hash', cost: 3 })).rejects.toThrow(/cost factor/i);
  });

  it('throws on invalid cost factor (too high)', async () => {
    await expect(run('password', { mode: 'hash', cost: 32 })).rejects.toThrow(/cost factor/i);
  });

  it('throws on invalid bcrypt hash format', async () => {
    await expect(run('password', { mode: 'verify', hash: 'invalid-hash' })).rejects.toThrow(/invalid bcrypt hash/i);
  });

  it('works with special characters in password', async () => {
    const specialPass = 'pässwörd!@#$%^&*()_+{}|:<>?';
    const hashResult = await run(specialPass, { mode: 'hash', cost: 10 });
    const verifyResult = await run(specialPass, { mode: 'verify', hash: hashResult.output });
    expect(verifyResult.stats?.result).toBe('match');
  });

  it('works with unicode password', async () => {
    const unicodePass = '密码парольパスワード🔐';
    const hashResult = await run(unicodePass, { mode: 'hash', cost: 10 });
    const verifyResult = await run(unicodePass, { mode: 'verify', hash: hashResult.output });
    expect(verifyResult.stats?.result).toBe('match');
  });

  it('handles empty string password', async () => {
    const hashResult = await run('', { mode: 'hash', cost: 10 });
    const verifyResult = await run('', { mode: 'verify', hash: hashResult.output });
    expect(verifyResult.stats?.result).toBe('match');
  });
});