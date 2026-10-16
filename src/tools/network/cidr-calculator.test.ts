import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './cidr-calculator.tool';

type Result = { output: string; stats?: Record<string, string | number> };
const run = (text: string) => tool.run({ text, options: {} }) as Result;
const rows = (result: Result) => new Map(JSON.parse(result.output).rows as [string, string][]);

describe('cidr-calculator', () => {
  it('calculates IPv4 /24 network, masks, broadcast and host count', () => {
    const result = run('192.168.1.37/24');
    const values = rows(result);
    expect(values.get('Network')).toBe('192.168.1.0/24');
    expect(values.get('First address')).toBe('192.168.1.0');
    expect(values.get('Last address')).toBe('192.168.1.255');
    expect(values.get('Address count')).toBe('256');
    expect(values.get('Netmask')).toBe('255.255.255.0');
    expect(values.get('Wildcard mask')).toBe('0.0.0.255');
    expect(values.get('Usable hosts (conventional)')).toBe('254');
  });

  it('handles IPv4 /0, /31, and /32 boundaries', () => {
    expect(rows(run('10.1.2.3/0')).get('Address count')).toBe('4294967296');
    expect(rows(run('10.0.0.1/31')).get('Usable hosts (conventional)')).toBe('0');
    expect(rows(run('10.0.0.1/31')).get('Last address')).toBe('10.0.0.1');
    expect(rows(run('10.0.0.1/32')).get('Usable hosts (conventional)')).toBe('1');
  });

  it('calculates and compresses IPv6 ranges exactly', () => {
    const result = run('2001:db8:abcd:12::1/64');
    const values = rows(result);
    expect(values.get('Network')).toBe('2001:db8:abcd:12::/64');
    expect(values.get('Last address')).toBe('2001:db8:abcd:12:ffff:ffff:ffff:ffff');
    expect(values.get('Address count')).toBe('18446744073709551616');
    expect(values.get('Broadcast')).toBe('Not applicable to IPv6');
  });

  it('supports single IPv6 and IPv4-embedded IPv6 addresses', () => {
    expect(rows(run('fe80::1/128')).get('Address count')).toBe('1');
    expect(rows(run('::ffff:192.0.2.1/128')).get('First address')).toBe('::ffff:c000:201');
  });

  it('rejects invalid octets, IPv6 groups, and prefixes', () => {
    expect(() => run('192.168.1.256/24')).toThrow(ToolError);
    expect(() => run('2001::db8::1/64')).toThrow(ToolError);
    expect(() => run('2001:db8::1/129')).toThrow(ToolError);
    expect(() => run('10.0.0.1/24.5')).toThrow(ToolError);
    expect(() => run('192.168.1.1')).toThrow(/prefix/i);
  });

  it('rejects scoped IPv6 addresses and empty input stays empty', () => {
    expect(() => run('fe80::1%eth0/64')).toThrow(/zone identifiers/i);
    expect(run('').output).toBe('');
  });
});
