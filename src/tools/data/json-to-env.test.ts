import { describe, expect, it } from 'vitest';
import tool from './json-to-env.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-env', () => {
  it('flattens a nested config with double-underscore keys', async () => {
    const r = await run('{ "server": { "host": "localhost", "port": 8080 } }');
    const lines = r.output.trim().split('\n');
    expect(lines).toContain('SERVER__HOST=localhost');
    expect(lines).toContain('SERVER__PORT=8080');
    expect(r.stats?.variables).toBe(2);
  });

  it('keeps arrays as JSON, flattens objects, empties null', async () => {
    const r = await run('{ "tags": ["a", "b"], "empty": null, "opts": { "x": 1 } }');
    const lines = r.output.trim().split('\n');
    expect(lines).toContain('TAGS=["a","b"]');
    expect(lines).toContain('EMPTY=');
    expect(lines).toContain('OPTS__X=1');
  });

  it('quotes only the strings that need it', async () => {
    const r = await run('{ "title": "A Site", "plain": "abc", "note": "line\\nbreak" }');
    const lines = r.output.trim().split('\n');
    expect(lines).toContain('TITLE="A Site"');
    expect(lines).toContain('PLAIN=abc');
    expect(lines).toContain('NOTE="line\\nbreak"');
  });

  it('supports dot and single-underscore separators and case preservation', async () => {
    const dot = await run('{ "server": { "host": "x" } }', { separator: '.', uppercase: false });
    expect(dot.output).toContain('server.host=x');
    const single = await run('{ "server": { "host": "x" } }', { separator: '_' });
    expect(single.output).toContain('SERVER_HOST=x');
  });

  it('flattens empty objects to an empty value', async () => {
    const r = await run('{ "a": {}, "b": { "c": 1 } }');
    const lines = r.output.trim().split('\n');
    expect(lines).toContain('A=');
    expect(lines).toContain('B__C=1');
  });

  it('rejects non-object, invalid and missing input', async () => {
    await expect(run('42')).rejects.toThrow(/object/i);
    await expect(run('{')).rejects.toThrow(/not valid JSON/i);
    await expect(run('   ')).rejects.toThrow(/Paste a JSON/i);
  });
});
