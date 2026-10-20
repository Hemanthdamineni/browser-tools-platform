import { describe, expect, it } from 'vitest';
import tool from './toml-convert.tool';

type Result = {
  output: string;
  render?: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const parse = (text: string) => JSON.parse(run(text).output) as Record<string, unknown>;

describe('toml-convert', () => {
  it('parses scalars, comments and nested tables', () => {
    const data = parse(`
# a comment
title = "TOML Example"
count = 42
pi = 3.14

[owner]
name = "Tom"
dob = 1979-05-27T07:32:00Z
`);
    expect(data.title).toBe('TOML Example');
    expect(data.count).toBe(42);
    expect(data.pi).toBe(3.14);
    expect((data.owner as Record<string, unknown>).name).toBe('Tom');
    expect((data.owner as Record<string, unknown>).dob).toBe('1979-05-27T07:32:00Z');
  });

  it('parses arrays, inline tables and dotted keys', () => {
    const data = parse(`
ports = [8000, 8001, 8002]
mixed = [ "a", 'b', 1, true ]
point = { x = 1, y = 2 }
physical.color = "orange"
physical.shape = "round"
`);
    expect(data.ports).toEqual([8000, 8001, 8002]);
    expect(data.mixed).toEqual(['a', 'b', 1, true]);
    expect(data.point).toEqual({ x: 1, y: 2 });
    expect(data.physical).toEqual({ color: 'orange', shape: 'round' });
  });

  it('parses arrays of tables with descendants', () => {
    const data = parse(`
[[products]]
name = "Hammer"
sku = 738594937

[[products]]

[[products]]
name = "Nail"
sku = 284758393

[products.dimensions]
width = 1
`);
    const products = data.products as Record<string, unknown>[];
    expect(products).toHaveLength(3);
    expect(products[0]!.name).toBe('Hammer');
    expect(products[1]).toEqual({});
    expect(products[2]!.name).toBe('Nail');
    expect(products[0]!.dimensions).toBeUndefined();
    expect(products[2]!.dimensions).toEqual({ width: 1 });
  });

  it('handles literal, multi-line and escaped strings plus number bases', () => {
    const data = parse(`
winpath = 'C:\\Users\\nodejs'
regex = '<\\i\\c*\\s*>'
multiline = """
Roses are red
Violets are blue"""
hex = 0xDEADBEEF
oct = 0o755
bin = 0b1101
neg = -17
big = 1_000_000
line = "tab\\there"
`);
    expect(data.winpath).toBe('C:\\Users\\nodejs');
    expect(data.regex).toBe('<\\i\\c*\\s*>');
    expect(String(data.multiline)).toContain('Roses are red');
    expect(data.multiline).toBe('Roses are red\nViolets are blue');
    expect(data.hex).toBe(0xdeadbeef);
    expect(data.oct).toBe(0o755);
    expect(data.bin).toBe(13);
    expect(data.neg).toBe(-17);
    expect(data.big).toBe(1000000);
    expect(data.line).toBe('tab\there');
  });

  it('serializes JSON to TOML with tables and arrays of tables', () => {
    const result = run(
      JSON.stringify({
        title: 'x',
        server: { host: 'localhost', port: 8080 },
        items: [{ name: 'a' }, { name: 'b' }],
      }),
      { mode: 'to-toml' },
    );
    expect(result.output).toContain('title = "x"');
    expect(result.output).toContain('[server]');
    expect(result.output).toContain('host = "localhost"');
    expect(result.output).toContain('[[items]]');
    expect(result.output).toContain('name = "a"');
    // Round-trip: the emitted TOML parses back to the same JSON data.
    expect(parse(result.output)).toEqual({
      title: 'x',
      server: { host: 'localhost', port: 8080 },
      items: [{ name: 'a' }, { name: 'b' }],
    });
  });

  it('round-trips TOML through JSON and back', () => {
    const source = `[a.b]\nkey = "value"\nnums = [1, 2, 3]\n`;
    const first = run(source).output;
    const back = run(first, { mode: 'to-toml' });
    const roundTripped = run(back.output).output;
    expect(JSON.parse(roundTripped)).toEqual(JSON.parse(first));
  });

  it('rejects invalid TOML and invalid JSON with a clear message', () => {
    expect(() => run('key = value')).toThrow(/must be quoted/i);
    expect(() => run('key = "unterminated')).toThrow(/unterminated/i);
    expect(() => run('a = 1\na = 2')).toThrow(/defined more than once/i);
    expect(() => run('not json', { mode: 'to-toml' })).toThrow(/invalid json/i);
    expect(() => run('[1, 2]', { mode: 'to-toml' })).toThrow(/top level/i);
  });

  it('returns guidance when the input is blank', () => {
    const result = run('   ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/paste toml/i);
  });
});
