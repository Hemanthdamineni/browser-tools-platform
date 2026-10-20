import { describe, expect, it } from 'vitest';
import tool from './json-flatten.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const nested =
  '{ "server": { "host": "localhost", "ports": { "http": 8080, "tls": 8443 } }, "users": [ { "name": "ada" } ] }';

describe('json-flatten', () => {
  it('flattens nested objects and arrays to dotted keys', async () => {
    const r = await run(nested);
    const out = JSON.parse(r.output) as Record<string, unknown>;
    expect(out['server.host']).toBe('localhost');
    expect(out['server.ports.http']).toBe(8080);
    expect(out['server.ports.tls']).toBe(8443);
    expect(out['users.0.name']).toBe('ada');
    expect(r.stats?.leaves).toBe(4);
  });

  it('keeps JSON types (numbers, booleans, null)', async () => {
    const r = await run('{ "a": { "n": 1, "b": true, "z": null } }');
    const out = JSON.parse(r.output) as Record<string, unknown>;
    expect(out['a.n']).toBe(1);
    expect(out['a.b']).toBe(true);
    expect(out['a.z']).toBeNull();
  });

  it('supports bracketed array paths', async () => {
    const r = await run(nested, { arrayStyle: 'bracket' });
    const out = JSON.parse(r.output) as Record<string, unknown>;
    expect(out['users[0].name']).toBe('ada');
  });

  it('unflattens back to nested JSON including arrays', async () => {
    const flat = '{ "server.host": "localhost", "users.0.name": "ada", "users.0.role": "admin" }';
    const r = await run(flat, { mode: 'unflatten' });
    const out = JSON.parse(r.output) as Record<string, unknown>;
    expect((out.server as Record<string, unknown>).host).toBe('localhost');
    expect(Array.isArray(out.users)).toBe(true);
    expect((out.users as Array<Record<string, unknown>>)[0]!.name).toBe('ada');
    expect((out.users as Array<Record<string, unknown>>)[0]!.role).toBe('admin');
  });

  it('round-trips flatten then unflatten to the original structure', async () => {
    const original = { server: { host: 'localhost' }, users: [{ name: 'ada', flags: [1, 0, 1] }] };
    const flat = await run(JSON.stringify(original));
    const rebuilt = await run(flat.output, { mode: 'unflatten' });
    expect(JSON.parse(rebuilt.output)).toEqual(original);
  });

  it('honours bracket style on unflatten explicit arrays', async () => {
    const r = await run('{ "users[0]": "a", "users[1]": "b" }', { mode: 'unflatten' });
    const out = JSON.parse(r.output) as Record<string, unknown>;
    expect(Array.isArray(out.users)).toBe(true);
    expect(out.users).toEqual(['a', 'b']);
  });

  it('sorts flattened keys when asked', async () => {
    const r = await run('{ "b": { "z": 1 }, "a": 2 }', { sorted: true });
    const lines = r.output.split('\n');
    const a = lines.findIndex((l) => l.includes('"a"'));
    const b = lines.findIndex((l) => l.includes('"b.z"'));
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
  });

  it('detects value/container conflicts', async () => {
    let caught: unknown;
    try {
      await run('{ "a": 1, "a.b": 2 }', { mode: 'unflatten' });
    } catch (e) {
      caught = e;
    }
    expect(String((caught as Error).message)).toMatch(/both a value and an object/);
  });

  it('rejects invalid JSON and non-object input', async () => {
    await expect(run('{ nope')).rejects.toThrow(/not valid JSON/i);
    await expect(run('42')).rejects.toThrow(/object or array/i);
    await expect(run('   ')).rejects.toThrow(/Paste a JSON/i);
  });

  it('preserves empty containers', async () => {
    const r = await run('{ "a": {}, "b": [] }');
    const out = JSON.parse(r.output) as Record<string, unknown>;
    expect(out.a).toEqual({});
    expect(out.b).toEqual([]);
  });
});
