import { describe, expect, it } from 'vitest';
import tool from './unicode-lookup.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, number>;
  notes?: string[];
  warnings?: string[];
};
type Row = [string, string, string, string, string, string];
type Table = { headers: string[]; rows: Row[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const table = async (text: string, options: Record<string, string | number | boolean> = {}) => {
  const r = await run(text, options);
  return { r, parsed: JSON.parse(r.output) as Table };
};

const firstRow = (parsed: Table): Row => parsed.rows[0] as Row;

describe('unicode-lookup', () => {
  it('reports the code point, decimal value and plane for ASCII', async () => {
    const { parsed } = await table('A');
    const row = firstRow(parsed);
    expect(parsed.headers[1]).toBe('Code point');
    expect(row[1]).toBe('U+0041');
    expect(row[2]).toBe('65');
    expect(row[3]).toContain('Basic Multilingual Plane');
  });

  it('reports the UTF-8 byte sequence', async () => {
    const { parsed } = await table('é');
    expect(firstRow(parsed)[4]).toBe('C3 A9');
  });

  it('reports a UTF-16 surrogate pair for astral characters', async () => {
    const { parsed } = await table('👍');
    const row = firstRow(parsed);
    expect(row[1]).toBe('U+1F44D');
    expect(row[3]).toContain('Supplementary Multilingual Plane');
    expect(row[4]).toBe('F0 9F 91 8D');
    expect(row[5]).toBe('D8 3D DC 4D');
  });

  it('renders one row per character, not per code unit', async () => {
    const { parsed } = await table('a👍b');
    expect(parsed.rows).toHaveLength(3);
  });

  it('makes control characters visible', async () => {
    const { parsed } = await table('\t');
    expect(firstRow(parsed)[0]).toBe('␉');
  });

  it('truncates at maxChars and reports the remainder', async () => {
    const { r, parsed } = await table('abcdef', { maxChars: 3 });
    expect(parsed.rows).toHaveLength(3);
    expect(r.stats?.truncated).toBe(3);
    expect(r.notes?.join(' ')).toMatch(/first 3 of 6/i);
  });

  it('supports a plain-text lines format', async () => {
    const r = await run('A', { format: 'lines' });
    expect(r.render).toBe('code');
    expect(r.output).toContain('U+0041');
    expect(r.output).toContain('utf8:41');
  });

  it('rejects empty input', async () => {
    await expect(run('')).rejects.toThrow(/paste some text/i);
  });
});
