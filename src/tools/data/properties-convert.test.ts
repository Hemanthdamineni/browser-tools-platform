import { describe, expect, it } from 'vitest';
import tool from './properties-convert.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const parsed = (r: Result): Record<string, unknown> => JSON.parse(r.output) as Record<string, unknown>;

const sample = [
  'server.port = 8080',
  'app.name = demo',
  'app.debug = true',
  '# comment line',
  '! another comment',
  'app.path = C:\\\\apps\\\\demo',
  '',
].join('\n');

describe('properties-convert (props → json)', () => {
  it('parses keys and values with = separators', async () => {
    const r = await run(sample);
    expect(parsed(r)).toEqual({
      'server.port': '8080',
      'app.name': 'demo',
      'app.debug': 'true',
      'app.path': 'C:\\apps\\demo',
    });
    expect(r.stats?.keys).toBe(4);
  });

  it('handles : separator and no separator (bare key)', async () => {
    const r = await run('alpha: 1\nbeta\n');
    const p = parsed(r);
    expect(p['alpha']).toBe('1');
    expect(p['beta']).toBe('');
  });

  it('keeps values containing = and :', async () => {
    const r = await run('url = http://x/y?q=1:2\n');
    expect(parsed(r)['url']).toBe('http://x/y?q=1:2');
  });

  it('decodes escapes and unicode', async () => {
    const r = await run('esc = line1\\nline2\ttab\\u00e9\\uXXXX\\u263A\n');
    expect(parsed(r)['esc']).toBe('line1\nline2\ttabé\\uXXXX☺');
  });

  it('joins trailing backslash continuations', async () => {
    const r = await run('long = first part \\\n  second part\nshort = end\n');
    expect(parsed(r)['long']).toBe('first part second part');
    expect(parsed(r)['short']).toBe('end');
  });

  it('last duplicate key wins', async () => {
    const r = await run('k = one\nk = two\n');
    expect(parsed(r)['k']).toBe('two');
  });
});

describe('properties-convert (json → props)', () => {
  it('flattens nested objects into dotted keys', async () => {
    const r = await run('{"app":{"name":"demo","port":8080,"ssl":false}}', { mode: 'json-to-props' });
    const lines = r.output.split('\n').filter(Boolean);
    expect(lines).toContain('app.name=demo');
    expect(lines).toContain('app.port=8080');
    expect(lines).toContain('app.ssl=false');
  });

  it('flattens arrays as numbered keys', async () => {
    const r = await run('{"tags":["a","b"]}', { mode: 'json-to-props' });
    const lines = r.output.split('\n').filter(Boolean);
    expect(lines).toContain('tags.0=a');
    expect(lines).toContain('tags.1=b');
  });

  it('escapes special characters in values', async () => {
    const r = await run('{"msg":"hi\\nworld \\\\ path"}', { mode: 'json-to-props' });
    expect(r.output).toContain('msg=hi\\nworld \\\\ path');
  });

  it('round-trips through parsing', async () => {
    const json = '{"a.b":{"c d":"x=y"},"num":12}';
    const r = await run(json, { mode: 'json-to-props' });
    const back = await run(r.output); // default props -> json
    expect(parsed(back)).toEqual({ 'a.b.c d': 'x=y', num: '12' });
  });

  it('errors on non-object JSON', async () => {
    await expect(run('42', { mode: 'json-to-props' })).rejects.toThrow(/must be an object/i);
  });
});

describe('properties-convert (errors)', () => {
  it('errors on blank input', async () => {
    await expect(run('   ')).rejects.toThrow(/properties|JSON/i);
  });

  it('errors on invalid JSON in json-to-props mode', async () => {
    await expect(run('{bad json', { mode: 'json-to-props' })).rejects.toThrow(/invalid json/i);
  });
});
