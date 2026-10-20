import { describe, expect, it } from 'vitest';
import tool from './ipv6-expander.tool';

type Result = { output: string; filename?: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (text: string, options: Record<string, string | number | boolean> = {}) => tool.run({ text, options }) as Result;

describe('ipv6-expander', () => {
  it('expands :: shorthand to full form', () => {
    const result = run('2001:db8::1');
    expect(result.output).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(result.filename).toBe('ipv6-expanded.txt');
  });

  it('expands an IPv4-mapped address', () => {
    const result = run('::ffff:192.0.2.128');
    expect(result.output).toBe('0000:0000:0000:0000:0000:ffff:c000:0280');
  });

  it('flags double :: and invalid hextets', () => {
    const a = run('2001::1::2');
    expect(a.stats?.valid).toBe('no');
    const b = run('gggg:1:2:3:4:5:6:7');
    expect(b.stats?.valid).toBe('no');
    expect(b.notes?.join(' ')).toContain('hextet');
  });

  it('compresses a zero run', () => {
    const result = run('2001:0db8:0000:0000:0000:0000:0000:0001', { mode: 'compress' });
    expect(result.output).toBe('2001:db8::1');
    expect(result.filename).toBe('ipv6-compressed.txt');
  });

  it('validates a plain address', () => {
    const result = run('2001:db8::1', { mode: 'validate' });
    expect(result.stats?.valid).toBe('yes');
  });

  it('handles bulk and blank input', () => {
    const bulk = run('2001:db8::1 fe80::1');
    expect(bulk.stats?.addresses).toBe(2);
    expect(run('').notes?.[0]).toContain('Paste');
  });
});
