import { describe, expect, it } from 'vitest';
import tool from './ieee754-inspector.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
  warnings?: string[];
};
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const table = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const r = await run(text, options);
  return { r, parsed: JSON.parse(r.output) as Table };
};

const HEX = 5;
const BINARY = 6;
const BYTES = 7;
const CLASS = 8;
const VALUE = 9;

describe('ieee754-inspector', () => {
  it('encodes 1.0 in both formats', async () => {
    const { parsed } = await table('1.0');
    expect(parsed.headers).toHaveLength(10);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.[0]).toBe('float64');
    expect(parsed.rows[0]?.[HEX]).toBe('0x3FF0000000000000');
    expect(parsed.rows[1]?.[HEX]).toBe('0x3F800000');
    expect(parsed.rows[0]?.[CLASS]).toBe('Normal');
  });

  it('reports the sign, exponent and unbiased exponent of 1.0', async () => {
    const { parsed } = await table('1.0');
    expect(parsed.rows[0]?.[1]).toBe('0 (+)');
    expect(parsed.rows[0]?.[2]).toBe('01111111111');
    expect(parsed.rows[0]?.[3]).toBe('0');
    expect(parsed.rows[0]?.[4]).toBe('0000000000000');
  });

  it('shows the canonical 0.1 bit patterns and flags rounding', async () => {
    const { r, parsed } = await table('0.1');
    expect(parsed.rows[0]?.[HEX]).toBe('0x3FB999999999999A');
    expect(parsed.rows[1]?.[HEX]).toBe('0x3DCCCCCD');
    expect(parsed.rows[1]?.[VALUE]).toBe('0.10000000149011612');
    expect(r.warnings?.join(' ')).toMatch(/not exactly representable/i);
    expect(r.stats?.precisionLosses).toBe(1);
  });

  it('encodes a negative value with the sign bit set', async () => {
    const { parsed } = await table('-2.5');
    expect(parsed.rows[0]?.[HEX]).toBe('0xC004000000000000');
    expect(parsed.rows[0]?.[1]).toBe('1 (-)');
  });

  it('distinguishes negative zero from zero', async () => {
    const { parsed } = await table('-0');
    expect(parsed.rows[0]?.[HEX]).toBe('0x8000000000000000');
    expect(parsed.rows[0]?.[CLASS]).toBe('Negative zero');
  });

  it('recognizes infinity and NaN', async () => {
    const inf = await table('Infinity');
    expect(inf.parsed.rows[0]?.[HEX]).toBe('0x7FF0000000000000');
    expect(inf.parsed.rows[0]?.[CLASS]).toBe('Infinity');
    const nan = await table('nan');
    expect(nan.parsed.rows[0]?.[2]).toBe('11111111111');
    expect(nan.parsed.rows[0]?.[CLASS]).toBe('NaN');
    expect(nan.r.warnings?.join(' ')).toMatch(/many bit patterns/i);
  });

  it('identifies the smallest subnormal', async () => {
    const { r, parsed } = await table('5e-324');
    expect(parsed.rows[0]?.[HEX]).toBe('0x0000000000000001');
    expect(parsed.rows[0]?.[CLASS]).toBe('Subnormal');
    expect(r.notes?.join(' ')).toMatch(/subnormal/i);
  });

  it('handles the largest finite values', async () => {
    const big = await table('1.7976931348623157e308', { precision: 'float64' });
    expect(big.parsed.rows[0]?.[HEX]).toBe('0x7FEFFFFFFFFFFFFF');
    const small = await table('3.4028234663852886e38', { precision: 'float32' });
    expect(small.parsed.rows[0]?.[HEX]).toBe('0x7F7FFFFF');
  });

  it('decodes a hex bit pattern back to a number', async () => {
    const { parsed } = await table('0x3FF0000000000000');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.[0]).toBe('float64');
    expect(parsed.rows[0]?.[VALUE]).toBe('1');
  });

  it('decodes a 32-character binary pattern as float32', async () => {
    const { parsed } = await table('00111111100000000000000000000000');
    expect(parsed.rows[0]?.[0]).toBe('float32');
    expect(parsed.rows[0]?.[HEX]).toBe('0x3F800000');
    expect(parsed.rows[0]?.[VALUE]).toBe('1');
  });

  it('renders little- and big-endian bytes', async () => {
    const le = await table('1.0', { precision: 'float64' });
    expect(le.parsed.rows[0]?.[BYTES]).toBe('00 00 00 00 00 00 F0 3F');
    const be = await table('1.0', { precision: 'float64', byteOrder: 'big' });
    expect(be.parsed.rows[0]?.[BYTES]).toBe('3F F0 00 00 00 00 00 00');
  });

  it('groups the binary form into bytes, or leaves it continuous', async () => {
    const grouped = await table('1.0', { precision: 'float64' });
    expect(grouped.parsed.rows[0]?.[BINARY]?.startsWith('00111111 11110000')).toBe(true);
    const plain = await table('1.0', { precision: 'float64', groupBits: false });
    expect(plain.parsed.rows[0]?.[BINARY]).toHaveLength(64);
    expect(plain.parsed.rows[0]?.[BINARY]).not.toContain(' ');
  });

  it('warns when a value overflows to infinity or underflows to zero', async () => {
    const over = await table('1e400');
    expect(over.r.warnings?.join(' ')).toMatch(/too large/i);
    const under = await table('1e-400');
    expect(under.r.warnings?.join(' ')).toMatch(/too small/i);
  });

  it('honours an explicit input mode', async () => {
    const bits = await table('0x3F800000', { inputMode: 'bits' });
    expect(bits.parsed.rows[0]?.[0]).toBe('float32');
    expect(bits.parsed.rows[0]?.[VALUE]).toBe('1');
    // Forcing decimal treats it as a JS numeric literal: the integer 1065353216.
    const asNumber = await table('0x3F800000', { inputMode: 'decimal', precision: 'float64' });
    expect(asNumber.parsed.rows[0]?.[VALUE]).toBe('1065353216');
  });

  it('limits decimal input to the chosen precision', async () => {
    const { parsed } = await table('1.0', { precision: 'float32' });
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.[0]).toBe('float32');
  });

  it('inspects several numbers on separate lines', async () => {
    const { r, parsed } = await table('1.0\n2.0');
    expect(parsed.rows).toHaveLength(4);
    expect(r.stats?.inputs).toBe(2);
    expect(r.stats?.rows).toBe(4);
  });

  it('supports a plain-text lines format', async () => {
    const r = await run('1.0', { precision: 'float64', format: 'lines' });
    expect(r.render).toBe('code');
    expect(r.output).toContain('0x3FF0000000000000');
    expect(r.output).toContain('mantissa=0000000000000');
  });

  it('rejects unreadable input', async () => {
    await expect(run('hello there')).rejects.toThrow(/could not read/i);
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/paste a number/i);
  });
});
