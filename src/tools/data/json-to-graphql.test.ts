import { describe, expect, it } from 'vitest';
import tool from './json-to-graphql.tool';

type Result = { output: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-graphql', () => {
  it('infers scalars and names the root', async () => {
    const r = await run('{ "id": 1, "name": "Ada", "ok": true, "ratio": 1.5 }');
    expect(r.output).toContain('type Root {');
    expect(r.output).toContain('  id: Int');
    expect(r.output).toContain('  name: String');
    expect(r.output).toContain('  ok: Boolean');
    expect(r.output).toContain('  ratio: Float');
  });

  it('maps nested objects to their own types', async () => {
    const r = await run('{ "profile": { "bio": "x" } }');
    expect(r.output).toContain('profile: Profile');
    expect(r.output).toContain('type Profile {');
    expect(r.output).toContain('  bio: String');
  });

  it('maps arrays of objects to lists with singular element types', async () => {
    const r = await run('{ "users": [ { "name": "a" }, { "name": "b" } ] }');
    expect(r.output).toContain('users: [User]');
    expect(r.output).toContain('type User {');
    expect(r.output).toContain('  name: String');
  });

  it('maps scalar arrays to list types', async () => {
    const r = await run('{ "tags": ["a", "b"] }');
    expect(r.output).toContain('tags: [String]');
  });

  it('handles null as String and empty arrays as [String]', async () => {
    const r = await run('{ "maybe": null, "empty": [] }');
    expect(r.output).toContain('maybe: String');
    expect(r.output).toContain('empty: [String]');
  });

  it('adds ! for concrete values when strictNull is on', async () => {
    const r = await run('{ "id": 1, "note": null }', { strictNull: true });
    expect(r.output).toContain('id: Int!');
    expect(r.output).toContain('note: String');
  });

  it('supports custom root name and 4-space indent', async () => {
    const r = await run('{ "a": 1 }', { rootName: 'Payload', indent: '4' });
    expect(r.output).toContain('type Payload {');
    expect(r.output).toContain('    a: Int');
  });

  it('reports mixed arrays and rejects bad input', async () => {
    const r = await run('{ "mix": [1, "two", true] }');
    expect(r.output).toContain('mix: [String]');
    expect((r.notes ?? []).join(' ')).toMatch(/[Mm]ixed/);
    await expect(run('{')).rejects.toThrow(/not valid JSON/i);
    await expect(run('   ')).rejects.toThrow(/Paste a JSON/i);
  });

  it('wraps non-object root values in a single value field', async () => {
    const r = await run('"hello"');
    expect(r.output).toContain('value: String');
  });
});
