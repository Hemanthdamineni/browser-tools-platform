import { describe, expect, it } from 'vitest';
import tool from './cbor-decoder.tool';

type Result = {
  outputs: unknown[];
  report?: { output: string; render?: string; language?: string };
  notes?: string[];
  warnings?: string[];
  stats?: Record<string, string | number>;
};
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ files: [], text, options })) as Result;

/** Decoded text for a hex payload. */
const decode = async (hex: string, options: Record<string, string | number | boolean> = {}) => {
  const r = await run(hex, options);
  return { r, text: (r.report?.output ?? '').trim() };
};

/** Decoded value as strict JSON, for outputs that do not need the lossless markers. */
const json = async (hex: string, options: Record<string, string | number | boolean> = {}) => {
  const { r } = await decode(hex, options);
  return JSON.parse((r.report?.output ?? 'null') as string) as unknown;
};

const table = async (hex: string, options: Record<string, string | number | boolean> = {}) => {
  const r = await run(hex, { ...options, format: 'table' });
  return JSON.parse(r.report?.output ?? '{}') as Table;
};

/** Independent base64 encoding, so the base64 input path is not tested against itself. */
const base64Of = (hex: string): string =>
  btoa(
    (hex.match(/../gu) ?? [])
      .map((pair) => String.fromCharCode(Number.parseInt(pair, 16)))
      .join(''),
  );

describe('cbor-decoder', () => {
  it('decodes unsigned integers of every width', async () => {
    expect((await decode('00')).text).toBe('0');
    expect((await decode('17')).text).toBe('23');
    expect((await decode('1818')).text).toBe('24');
    expect((await decode('1903e8')).text).toBe('1000');
    expect((await decode('1a000f4240')).text).toBe('1000000');
    expect((await decode('1b000000e8d4a51000')).text).toBe('1000000000000');
  });

  it('decodes negative integers', async () => {
    expect((await decode('20')).text).toBe('-1');
    expect((await decode('29')).text).toBe('-10');
    expect((await decode('3863')).text).toBe('-100');
  });

  it('decodes integers beyond the safe range without precision loss', async () => {
    expect((await decode('1bffffffffffffffff')).text).toBe('18446744073709551615');
    expect((await decode('3bffffffffffffffff')).text).toBe('-18446744073709551616');
  });

  it('decodes half precision floats', async () => {
    expect((await decode('f90000')).text).toBe('0');
    expect((await decode('f93c00')).text).toBe('1');
    expect((await decode('f97c00')).text).toBe('Infinity');
    expect((await decode('f97e00')).text).toBe('NaN');
    expect((await decode('f98000')).text).toBe('-0');
  });

  it('decodes single and double precision floats', async () => {
    expect((await decode('fa47c35000')).text).toBe('100000');
    expect((await decode('fb3ff199999999999a')).text).toBe('1.1');
    expect((await decode('fb8000000000000000')).text).toBe('-0');
  });

  it('decodes the simple values', async () => {
    expect((await decode('f4')).text).toBe('false');
    expect((await decode('f5')).text).toBe('true');
    expect((await decode('f6')).text).toBe('null');
    expect((await decode('f7')).text).toBe('$undefined');
  });

  it('decodes byte strings using the marker convention', async () => {
    expect(await json('40')).toEqual({ $bytes: '' });
    expect(await json('4401020304')).toEqual({ $bytes: '01020304' });
  });

  it('decodes text strings including multi-byte UTF-8', async () => {
    expect((await decode('60')).text).toBe('""');
    expect((await decode('6161')).text).toBe('"a"');
    expect((await decode('6449455446')).text).toBe('"IETF"');
    expect((await decode('62c3bc')).text).toBe('"ü"');
    expect((await decode('63e6b0b4')).text).toBe('"水"');
  });

  it('decodes arrays and maps', async () => {
    expect(await json('80')).toEqual([]);
    expect(await json('83010203')).toEqual([1, 2, 3]);
    expect(await json('a0')).toEqual({});
    expect(await json('a26161016162820203')).toEqual({ a: 1, b: [2, 3] });
  });

  it('decodes indefinite-length strings, arrays and maps', async () => {
    expect(await json('5f42010243030405ff')).toEqual({ $bytes: '0102030405' });
    expect((await decode('7f657374726561646d696e67ff')).text).toBe('"streaming"');
    expect(await json('9f018202039f0405ffff')).toEqual([1, [2, 3], [4, 5]]);
    expect(await json('bf61610161629f0203ffff')).toEqual({ a: 1, b: [2, 3] });
  });

  it('interprets tags 0 and 1 as dates', async () => {
    expect((await decode('c074323031332d30332d32315432303a30343a30305a')).text).toBe(
      '"2013-03-21T20:04:00.000Z"',
    );
    expect((await decode('c11a514b67b0')).text).toBe('"2013-03-21T20:04:00.000Z"');
  });

  it('interprets bignum tags 2 and 3', async () => {
    expect(await json('c249010000000000000000')).toEqual({ $bignum: '18446744073709551616' });
    expect(await json('c349010000000000000000')).toEqual({ $bignum: '-18446744073709551617' });
  });

  it('decodes tag 24 as embedded CBOR', async () => {
    const { r, text } = await decode('d818456449455446');
    expect(text).toBe('"IETF"');
    expect(r.notes?.join(' ')).toMatch(/embedded cbor/i);
  });

  it('keeps unknown tags visible', async () => {
    expect(await json('d818456449455446', { interpretTags: false })).toEqual({
      $tag: 24,
      value: { $bytes: '6449455446' },
    });
    const { r } = await decode('c11a514b67b0', { interpretTags: false });
    expect(JSON.parse(r.report?.output ?? 'null')).toEqual({ $tag: 1, value: 1363896240 });
  });

  it('decodes a CBOR sequence of several top-level items', async () => {
    const { r, text } = await decode('0102');
    expect(text.split('\n')).toEqual(['1', '2']);
    expect(r.stats?.topLevel).toBe(2);
    expect(r.notes?.join(' ')).toMatch(/cbor sequence/i);
  });

  it('renders a structure outline table', async () => {
    const report = await table('a26161016162820203');
    expect(report.headers).toEqual(['Path', 'Type', 'Value']);
    const map = new Map(report.rows.map((row) => [row[0], row[1]]));
    expect(map.get('$')).toBe('map(2)');
    expect(map.get('$.a')).toBe('uint');
    expect(map.get('$.b')).toBe('array(2)');
    expect(map.get('$.b[1]')).toBe('uint');
    expect(report.rows.map((row) => row[0])).not.toContain('$<key 0>');
  });

  it('reports byte, item and depth statistics', async () => {
    const { r } = await decode('83010203');
    expect(r.stats?.bytes).toBe(4);
    expect(r.stats?.items).toBe(4);
    expect(r.stats?.depth).toBe(2);
  });

  it('accepts base64 input when asked and by detection', async () => {
    const encoded = base64Of('83010203');
    expect(await json(encoded, { inputFormat: 'base64' })).toEqual([1, 2, 3]);
    expect(await json(encoded)).toEqual([1, 2, 3]);
  });

  it('reads the same bytes from a File', async () => {
    const file = new File(
      [new Uint8Array([0xa2, 0x61, 0x61, 0x01, 0x61, 0x62, 0x82, 0x02, 0x03])],
      'x.cbor',
    );
    const r = (await tool.run({ files: [file], options: {} })) as Result;
    expect(JSON.parse(r.report?.output ?? 'null')).toEqual({ a: 1, b: [2, 3] });
    expect(r.report?.render).toBe('code');
  });

  it('tolerates whitespace, 0x prefixes and commas in hex input', async () => {
    expect(await json('0x83, 01 02\n03')).toEqual([1, 2, 3]);
  });

  it('rejects malformed input with a byte offset', async () => {
    await expect(run('18')).rejects.toThrow(/unexpected end of input/i);
    await expect(run('1c')).rejects.toThrow(/reserved additional information/i);
    await expect(run('ff')).rejects.toThrow(/unexpected break/i);
    await expect(run('9f01')).rejects.toThrow(/unterminated indefinite-length array/i);
    await expect(run('8301')).rejects.toThrow(/unexpected end of input/i);
  });

  it('rejects empty and non-hex input', async () => {
    await expect(run('')).rejects.toThrow(/choose a cbor file or paste/i);
    await expect(run('abc', { inputFormat: 'hex' })).rejects.toThrow(/odd number of digits/i);
    await expect(run('!!!!', { inputFormat: 'hex' })).rejects.toThrow(/no hexadecimal digits/i);
  });
});
