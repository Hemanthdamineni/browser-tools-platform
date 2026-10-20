import { describe, expect, it } from 'vitest';
import tool from './ipv4-to-int.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('ipv4-to-int', () => {
  it('converts a dotted IPv4 to its unsigned integer', async () => {
    const r = await run('192.168.1.1');
    expect(r.output).toContain('3232235777');
    expect(r.output).toContain('192.168.1.1');
    expect(r.stats?.integer).toBe(3232235777);
  });

  it('converts an integer back to IPv4', async () => {
    const r = await run('3232235777');
    expect(r.output).toContain('192.168.1.1');
  });

  it('handles small and zero values', async () => {
    expect((await run('0.0.0.0')).output).toContain('0');
    expect((await run('0')).output).toContain('0.0.0.0');
  });

  it('supports showBoth=false', async () => {
    const r = await run('1.2.3.4', { showBoth: false });
    expect(r.output.trim()).not.toContain('\n');
    expect(r.output.trim()).toBe('16909060');
  });

  it('rejects out-of-range integers', async () => {
    await expect(run('4294967296')).rejects.toThrow(/too large/i);
    await expect(run('   ')).rejects.toThrow(/enter an ipv4/i);
  });

  it('rejects malformed IPs and garbage', async () => {
    await expect(run('256.1.1.1')).rejects.toThrow(/not a valid/i);
    await expect(run('1.2.3')).rejects.toThrow(/not a valid/i);
    await expect(run('1.2.3.4.5')).rejects.toThrow(/not a valid/i);
    await expect(run('abc')).rejects.toThrow(/not a valid/i);
  });
});
