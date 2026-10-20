import { describe, expect, it } from 'vitest';
import tool from './ip-address-inspector.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
type Table = { headers: string[]; rows: [string, string][] };

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const table = (text: string, options: Record<string, string | number | boolean> = {}) =>
  JSON.parse(run(text, options).output) as Table;
const get = (text: string, key: string, options: Record<string, string | number | boolean> = {}) =>
  table(text, options).rows.find((r) => r[0] === key)?.[1];

describe('ip-address-inspector', () => {
  it('reports instructions for blank input', () => {
    const result = run('  ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/paste an ipv4 or ipv6/i);
  });

  it('inspects a private IPv4 address', () => {
    expect(get('192.168.1.42', 'Version')).toBe('IPv4');
    expect(get('192.168.1.42', 'Classification')).toContain('private (RFC 1918)');
    expect(get('192.168.1.42', 'Decimal octets')).toBe('192.168.1.42');
    expect(get('192.168.1.42', 'Hexadecimal octets')).toBeUndefined();
    expect(get('192.168.1.42', 'Hex octets')).toBe('c0.a8.01.2a');
    expect(get('192.168.1.42', 'Binary octets')).toBe('11000000.10101000.00000001.00101010');
    expect(get('192.168.1.42', 'IPv6-mapped form')).toBe('::ffff:192.168.1.42');
    expect(run('192.168.1.42').stats?.scope).toBe('non-public');
  });

  it('classifies public, loopback, link-local and multicast IPv4', () => {
    expect(get('8.8.8.8', 'Classification')).toBe('global unicast (public)');
    expect(get('127.0.0.1', 'Classification')).toContain('loopback');
    expect(get('169.254.10.1', 'Classification')).toContain('link-local');
    expect(get('224.0.0.251', 'Classification')).toContain('multicast');
    expect(get('255.255.255.255', 'Classification')).toContain('limited broadcast');
    expect(run('8.8.8.8').stats?.scope).toBe('public');
  });

  it('parses an IPv4 address with a port', () => {
    expect(get('10.0.0.5:8080', 'Port')).toBe('8080');
    expect(get('10.0.0.5:8080', 'Classification')).toContain('private');
    expect(run('10.0.0.5:8080').stats?.port).toBe(8080);
  });

  it('inspects IPv6 loopback, link-local with zone, and documentation ranges', () => {
    expect(get('::1', 'Classification')).toContain('loopback');
    expect(get('fe80::a1b2:c3d4%eth0', 'Classification')).toContain('link-local');
    expect(get('fe80::a1b2:c3d4%eth0', 'Zone')).toBe('eth0');
    expect(get('2001:db8::1', 'Classification')).toContain('documentation');
    expect(get('fd00::1', 'Classification')).toContain('unique local');
    expect(get('ff02::1', 'Classification')).toContain('multicast');
    expect(run('fe80::1').stats?.scope).toBe('non-public');
  });

  it('expands and compresses IPv6 forms', () => {
    expect(get('2001:db8::1', 'Expanded')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(get('2001:0db8:0000:0000:0000:0000:0000:0001', 'Compressed')).toBe('2001:db8::1');
    expect(get('::1', 'Compressed')).toBe('::1');
    expect(get('2001:db8::1', '16-bit groups')).toBe('2001 db8 0 0 0 0 0 1');
  });

  it('detects IPv4-mapped IPv6 and reports the embedded address', () => {
    expect(get('::ffff:192.168.1.42', 'Embedded IPv4')).toBe('192.168.1.42');
    expect(get('::ffff:192.168.1.42', 'Classification')).toContain('IPv4-mapped');
    expect(run('::ffff:192.168.1.42').notes?.join(' ')).toMatch(/embeds an IPv4/i);
  });

  it('honours the showBinary option', () => {
    const t = table('192.168.1.42', { showBinary: false });
    expect(t.rows.find((r) => r[0] === 'Binary octets')).toBeUndefined();
  });

  it('rejects malformed input', () => {
    expect(() => run('999.1.1.1')).toThrow(/out of range/i);
    expect(() => run('1.2.3')).toThrow(/not a valid IPv4/i);
    expect(() => run('1.2.3.4:70000')).toThrow(/out of range/i);
    expect(() => run('2001:db8:::1')).toThrow(/not a valid IPv6/i);
    expect(() => run('[2001:db8::1')).toThrow(/missing/i);
    expect(() => run('not-an-ip')).toThrow(/not a valid IPv4/i);
  });
});
