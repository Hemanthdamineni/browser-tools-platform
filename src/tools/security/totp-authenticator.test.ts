import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool, { totp, b32decode } from './totp-authenticator.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) => (await tool.run({ text, options })) as Result;

describe('totp-authenticator', () => {
  it('matches the RFC 6238 SHA1 vector for counter 1', async () => {
    // base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ == ASCII "12345678901234567890"
    const secret = b32decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ') as Uint8Array;
    // RFC 6238 Appendix B: T=59s with a 30s step => counter 1
    expect(await totp(secret, 1, 8)).toBe('94287082');
    expect(await totp(secret, 1, 6)).toBe('287082');
  });

  it('produces stable 6-digit codes in codes mode', async () => {
    const result = await run('JBSWY3DPEHPK3PXP');
    expect(result.stats?.valid).toBe('yes');
    const out = JSON.parse(result.output) as { rows: string[][] };
    expect(out.rows.length).toBe(3);
    expect(out.rows[0]?.[0]).toBe('Current');
    expect(out.rows[0]?.[1]).toMatch(/^\d{6}$/);
  });

  it('verifies the current code as valid', async () => {
    const codes = JSON.parse((await run('JBSWY3DPEHPK3PXP')).output) as { rows: string[][] };
    const current = codes.rows[0]?.[1] as string;
    const result = await run(`JBSWY3DPEHPK3PXP ${current}`, { mode: 'verify' });
    expect(result.stats?.valid).toBe('yes');
  });

  it('rejects a bad secret and a non-numeric verify code', async () => {
    await expect(run('NOT@BASE32')).rejects.toThrow(ToolError);
    await expect(run('JBSWY3DPEHPK3PXP abc', { mode: 'verify' })).rejects.toThrow(ToolError);
  });

  it('handles blank input', async () => {
    const result = await run('');
    expect(result.notes?.[0]).toContain('JBSWY3DPEHPK3PXP');
  });
});
