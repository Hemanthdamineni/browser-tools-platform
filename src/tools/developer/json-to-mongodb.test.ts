import { describe, expect, it } from 'vitest';
import tool from './json-to-mongodb.tool';

type Result = {
  output: string;
  render?: string;
  language?: string;
  stats?: Record<string, number>;
  notes?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-mongodb', () => {
  it('wraps an array in insertMany with the collection name', async () => {
    const r = await run('[{"name":"Ada"},{"name":"Lin"}]', { collection: 'users' });
    expect(r.output).toContain('db.users.insertMany');
    expect(r.output).toContain('db.users');
    expect(r.output).toContain('insertMany');
  });

  it('emits compact single-line format', async () => {
    const r = await run('[{"a":1},{"b":2}]', { collection: 'c', format: 'compact' });
    const line = r.output.trim();
    expect(line).not.toContain('\n');
    expect(line.startsWith('db.c.insertMany([')).toBe(true);
    expect(line.endsWith(']);')).toBe(true);
  });

  it('handles a single object and nulls/booleans', async () => {
    const r = await run('{"ok":true,"v":null,"n":3}', { collection: 't', format: 'compact' });
    expect(r.output).toContain('"ok":true');
    expect(r.output).toContain('"v":null');
    expect(r.output).toContain('"n":3');
  });

  it('preserves strings with quotes and nested arrays/objects', async () => {
    const r = await run('{"s":"he said \\"hi\\"","arr":[1,2],"o":{"x":1}}', {
      collection: 't',
      format: 'compact',
    });
    expect(r.output).toContain('"s":"he said \\"hi\\""');
    expect(r.output).toContain('"arr":[1,2]');
    expect(r.output).toContain('"o":{"x":1}');
  });

  it('emits raw documents when not wrapped (compact)', async () => {
    const r = await run('[{"a":1}]', { wrapped: false, format: 'compact' });
    expect(r.output).not.toContain('insertMany');
    expect(r.output.trim()).toBe('{"a":1}');
  });

  it('pretty format indents nested objects', async () => {
    const r = await run('[{"a":{"b":2}}]', { collection: 'c', wrapped: false });
    expect(r.output).toContain('"a": {');
    expect(r.output).toContain('"b": 2');
    expect(r.output).toMatch(/^\{\n/);
  });

  it('rejects invalid input and bad collection names', async () => {
    await expect(run('not json', {})).rejects.toThrow(/invalid json/i);
    await expect(run('[]', {})).rejects.toThrow(/no documents/i);
    await expect(run('[1,2]', {})).rejects.toThrow(/document must be a JSON object/i);
    await expect(run('[{"a":1}]', { collection: 'bad name!' })).rejects.toThrow(/identifier/i);
    await expect(run('[{"n":1e400}]', {})).rejects.toThrow(/non-finite/i);
  });
});
