import { describe, expect, it } from 'vitest';
import tool from './json-to-swift.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-swift', () => {
  it('maps scalars to Swift types', async () => {
    const r = await run('{"id":1,"name":"Ada","active":true,"score":9.5}');
    expect(r.output).toContain('struct Root: Codable {');
    expect(r.output).toContain('let id: Int');
    expect(r.output).toContain('let name: String');
    expect(r.output).toContain('let active: Bool');
    expect(r.output).toContain('let score: Double');
  });

  it('camelCases snake_case keys and maps them in CodingKeys', async () => {
    const r = await run('{"user_name":"Ada","is_active":true}');
    expect(r.output).toContain('let userName: String');
    expect(r.output).toContain('let isActive: Bool');
    expect(r.output).toContain('case userName = "user_name"');
    expect(r.output).toContain('case isActive = "is_active"');
  });

  it('omits matching keys from CodingKeys and honors the toggle', async () => {
    const r = await run('{"id":1}');
    expect(r.output).not.toContain('CodingKeys');
    const off = await run('{"user_name":"Ada"}', { codingKeys: false });
    expect(off.output).not.toContain('CodingKeys');
  });

  it('uses var when propertyStyle is var', async () => {
    const r = await run('{"a":1}', { propertyStyle: 'var' });
    expect(r.output).toContain('var a: Int');
  });

  it('nests objects into child structs', async () => {
    const r = await run('{"address":{"city":"London","zip":"SW1"}}');
    expect(r.output).toContain('struct RootAddress: Codable {');
    expect(r.output).toContain('let address: RootAddress');
    expect(r.output).toContain('let city: String');
  });

  it('maps arrays to Swift arrays', async () => {
    const r = await run('{"tags":["a"],"ids":[1],"flags":[true],"vehicles":[{"id":1}]}');
    expect(r.output).toContain('let tags: [String]');
    expect(r.output).toContain('let ids: [Int]');
    expect(r.output).toContain('let flags: [Bool]');
    expect(r.output).toContain('let vehicles: [RootVehicles]');
    expect(r.output).toContain('struct RootVehicles: Codable {');
  });

  it('falls back to String? and [String] for null, empty and mixed arrays', async () => {
    const r = await run('{"maybe":null,"empty":[],"mixed":[1,"x"]}');
    expect(r.output).toContain('let maybe: String?');
    expect(r.output).toContain('let empty: [String]');
    expect(r.output).toContain('let mixed: [String]');
  });

  it('handles array root with usage comment and identity keys', async () => {
    const r = await run('[{"id":1,"name":"Ada"}]', { rootName: 'User' });
    expect(r.output).toContain('struct User: Codable {');
    expect(r.output).toContain('decode([User].self, from: data)');
  });

  it('rejects blank, invalid, empty array and primitive roots', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a json/i);
    await expect(run('{bad}')).rejects.toThrow(/invalid json/i);
    await expect(run('[]')).rejects.toThrow(/non-empty JSON object or array/i);
    await expect(run('42')).rejects.toThrow(/object or array/i);
  });

  it('reports struct and field counts', async () => {
    const r = await run('{"a":1,"b":{"c":"x"}}');
    expect(r.stats?.structs).toBe(2);
    expect(r.stats?.fields).toBe(3);
  });
});
