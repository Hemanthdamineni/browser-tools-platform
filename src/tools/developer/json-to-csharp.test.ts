import { describe, expect, it } from 'vitest';
import tool from './json-to-csharp.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-csharp', () => {
  it('maps scalar types to C# properties', async () => {
    const r = await run('{"id":1,"name":"Ada","active":true,"score":9.5}');
    expect(r.output).toContain('public int ID { get; set; }');
    expect(r.output).toContain('public string Name { get; set; }');
    expect(r.output).toContain('public bool Active { get; set; }');
    expect(r.output).toContain('public double Score { get; set; }');
  });

  it('prefixes acronyms as uppercase', async () => {
    const r = await run('{"id":1,"url":"x","api_key":"k"}');
    expect(r.output).toContain('public int ID { get; set; }');
    expect(r.output).toContain('public string URL { get; set; }');
    expect(r.output).toContain('public string APIKey { get; set; }');
  });

  it('brands keywords with @', async () => {
    const r = await run('{"class":"A","namespace":"B","object":"C"}');
    expect(r.output).toContain('public string @Class { get; set; }');
    expect(r.output).toContain('public string @Namespace { get; set; }');
    expect(r.output).toContain('public string @Object { get; set; }');
  });

  it('nests objects into classes', async () => {
    const r = await run('{"address":{"city":"London","zip":"SW1"}}');
    expect(r.output).toContain('public class Root\n{');
    expect(r.output).toContain('public RootAddress Address { get; set; }');
    expect(r.output).toContain('public class RootAddress\n{');
    expect(r.output).toContain('public string City { get; set; }');
  });

  it('maps arrays to List types', async () => {
    const r = await run('{"tags":["a","b"],"ids":[1,2],"flags":[true]}');
    expect(r.output).toContain('public List<string> Tags { get; set; }');
    expect(r.output).toContain('public List<int> Ids { get; set; }');
    expect(r.output).toContain('public List<bool> Flags { get; set; }');
  });

  it('uses List<object> for empty and mixed arrays and object? for null', async () => {
    const r = await run('{"empty":[],"mixed":[1,"x"],"maybe":null}');
    expect(r.output).toContain('public List<object> Empty { get; set; }');
    expect(r.output).toContain('public List<object> Mixed { get; set; }');
    expect(r.output).toContain('public object? Maybe { get; set; }');
  });

  it('emits attributes only when enabled', async () => {
    const on = await run('{"user_name":"Ada"}');
    expect(on.output).toContain('[JsonPropertyName("user_name")]');
    expect(on.output).toContain('using System.Text.Json.Serialization;');
    const off = await run('{"user_name":"Ada"}', { attributes: false });
    expect(off.output).not.toContain('JsonPropertyName');
    expect(off.output).not.toContain('System.Text.Json.Serialization');
  });

  it('supports array roots and root name override', async () => {
    const r = await run('[{"id":1}]', { rootName: 'User' });
    expect(r.output).toContain('public class User\n{');
    expect(r.output).toContain('List<User>>(json)');
  });

  it('escapes weird keys in attributes and names', async () => {
    const r = await run('{"weird key":"x"}');
    expect(r.output).toContain('[JsonPropertyName("weird key")]');
    expect(r.output).toContain('public string WeirdKey { get; set; }');
  });

  it('rejects blank, invalid JSON, empty arrays and primitive roots', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a json/i);
    await expect(run('{bad}')).rejects.toThrow(/invalid json/i);
    await expect(run('[]')).rejects.toThrow(/empty/i);
    await expect(run('42')).rejects.toThrow(/object or array/i);
  });

  it('reports types and properties counts', async () => {
    const r = await run('{"a":1,"b":{"c":"x"}}');
    expect(r.stats?.types).toBe(2);
    expect(r.stats?.properties).toBe(3);
  });
});
