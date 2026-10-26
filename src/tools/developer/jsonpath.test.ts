import { describe, expect, it } from 'vitest';
import tool from './jsonpath.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (input: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text: input, options })) as Result;
const parsed = (r: Result): unknown => JSON.parse(r.output);

const usersJson = JSON.stringify({
  users: [
    { name: 'Alice', age: 30, tags: ['dev', 'al'] },
    { name: 'Bob', age: 44, tags: ['ops'] },
    { name: 'Carol', age: 21, tags: ['dev', 'co'] },
  ],
});

const doc = (expr: string, json: string) => `${expr}\n${json}`;

describe('jsonpath', () => {
  it('extracts a nested array via child selectors', async () => {
    const r = await run(doc('$.users[*].name', usersJson));
    expect(parsed(r)).toEqual(['Alice', 'Bob', 'Carol']);
    expect(r.stats?.matches).toBe(3);
  });

  it('supports bracket notation with quotes', async () => {
    const r = await run(doc(`$["users"][0]["name"]`, usersJson));
    expect(parsed(r)).toEqual(['Alice']);
  });

  it('supports wildcard and recursive descent', async () => {
    const r = await run(doc('$..name', usersJson));
    expect(parsed(r)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('supports array indexing and slicing', async () => {
    const r = await run(doc('$.users[:2].age', usersJson));
    expect(parsed(r)).toEqual([30, 44]);
    const r2 = await run(doc('$.users[::-1].name', usersJson));
    expect(parsed(r2)).toEqual(['Carol', 'Bob', 'Alice']);
  });

  it('filters with numeric comparison', async () => {
    const r = await run(doc('$.users[?(@.age > 25)].name', usersJson));
    expect(parsed(r)).toEqual(['Alice', 'Bob']);
  });

  it('filters with string equality and truthiness', async () => {
    const r2 = await run(doc("$.users[?(@.name == 'Alice')].age", usersJson));
    expect(parsed(r2)).toEqual([30]);
    const r3 = await run(doc('$.users[?(@.tags)].name', usersJson));
    expect(parsed(r3)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('returns empty array when no match', async () => {
    const r = await run(doc('$.users[?(@.age > 200)]', usersJson));
    expect(parsed(r)).toEqual([]);
    expect(r.stats?.matches).toBe(0);
    expect(r.notes?.join(' ')).toMatch(/No nodes/);
  });

  it('extracts a whole matched object', async () => {
    const r = await run(doc('$.users[1]', usersJson));
    expect(parsed(r)).toEqual([{ name: 'Bob', age: 44, tags: ['ops'] }]);
  });

  it('honors showPaths option', async () => {
    const r = await run(doc('$.users[0].name', usersJson), { showPaths: true });
    const out = parsed(r) as Array<{ path: string; value: unknown }>;
    expect(out).toEqual([{ path: '$.users[0].name', value: 'Alice' }]);
  });

  it('honors compact option', async () => {
    const r = await run(doc('$.users[*].name', usersJson), { compact: true });
    expect(r.output).not.toContain('\n');
  });

  it('walks keys of an object via wildcard', async () => {
    const obj = JSON.stringify({ a: 1, b: 2, c: 3 });
    const r = await run(doc('.*', obj));
    expect(parsed(r)).toEqual([1, 2, 3]);
    const r2 = await run(doc('$.*', obj));
    expect(parsed(r2)).toEqual([1, 2, 3]);
  });

  it('handles a missing field as no match gracefully', async () => {
    const r = await run(doc('$.users[0].missing_field', usersJson));
    expect(parsed(r)).toEqual([]);
  });

  it('errors on invalid input and invalid JSON', async () => {
    await expect(run('   \n')).rejects.toThrow(/expression/i);
    await expect(run('$.a\n{not json')).rejects.toThrow(/invalid json/i);
  });

  it('runs the "Extract an array of names" example without throwing', async () => {
    const r = await run(
      '$.users[*].name\n{"users":[{"name":"Ada"},{"name":"Linus"},{"name":"Grace"}]}',
    );
    expect(parsed(r)).toEqual(['Ada', 'Linus', 'Grace']);
    expect(r.output.length).toBeGreaterThan(0);
  });

  it('runs the "Filter objects where price is above a threshold" example without throwing', async () => {
    const r = await run(
      '$.products[?(@.price > 20)].name\n{"products":[{"name":"Keyboard","price":25},{"name":"Cable","price":8}]}',
    );
    expect(parsed(r)).toEqual(['Keyboard']);
    expect(r.output.length).toBeGreaterThan(0);
  });
});
