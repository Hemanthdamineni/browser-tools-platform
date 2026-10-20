import { describe, expect, it } from 'vitest';
import tool from './json-to-go-struct.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-go-struct', () => {
  it('maps scalar types and acronym field names', async () => {
    const r = await run('{"id":1,"name":"Ada","active":true,"score":9.5,"url":"x"}', {
      rootName: 'User',
    });
    expect(r.render).toBe('code');
    expect(r.output).toContain('type User struct {');
    expect(r.output).toContain('\tID int `json:"id,omitempty"`');
    expect(r.output).toContain('\tName string `json:"name,omitempty"`');
    expect(r.output).toContain('\tActive bool `json:"active,omitempty"`');
    expect(r.output).toContain('\tScore float64 `json:"score,omitempty"`');
    expect(r.output).toContain('\tURL string `json:"url,omitempty"`');
    expect(r.stats?.types).toBe(1);
    expect(r.stats?.fields).toBe(5);
  });

  it('hoists nested objects and arrays into named types', async () => {
    const r = await run(
      '{"name":"Ada","address":{"city":"London","zip":"SW1"},"skills":["go","ts"],"tags":[]}',
      {
        rootName: 'User',
      },
    );
    expect(r.output).toContain('Address UserAddress `json:"address,omitempty"`');
    expect(r.output).toContain('Skills []string `json:"skills,omitempty"`');
    expect(r.output).toContain('Tags []interface{} `json:"tags,omitempty"`');
    expect(r.output).toContain('type UserAddress struct {');
    expect(r.output).toContain('City string `json:"city,omitempty"`');
    expect(r.stats?.types).toBe(2);
  });

  it('generates a slice root from an array of objects', async () => {
    const r = await run('[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]', { rootName: 'User' });
    expect(r.output).toContain('// var data []User; json.Unmarshal(raw, &data)');
    expect(r.output).toContain('type User struct {');
    expect(r.output).toContain('ID int `json:"id,omitempty"`');
    expect(r.output).toContain('Name string `json:"name,omitempty"`');
  });

  it('handles nulls and mixed arrays as interface{}', async () => {
    const r = await run('{"a":null,"b":[1,"two"],"c":{}}', { rootName: 'Mixed' });
    expect(r.output).toContain('A interface{} `json:"a,omitempty"`');
    expect(r.output).toContain('B []interface{} `json:"b,omitempty"`');
    expect(r.output).toContain('type MixedC struct {');
    expect(r.output).toContain('\t// Empty object');
  });

  it('complex numbers, primitive arrays and keyword-safe names', async () => {
    const r = await run('{"type":"T","numbers":[1,2.5],"yes":[true],"mixed":[1,"x"]}', {
      rootName: 'Thing',
    });
    expect(r.output).toContain('Type_ string');
    expect(r.output).toContain('Numbers []float64');
    expect(r.output).toContain('Yes []bool');
    expect(r.output).toContain('Mixed []interface{}');
  });

  it('supports omitting tags and omitempty', async () => {
    const r = await run('{"id":1}', { rootName: 'User', tags: 'none', omitempty: false });
    expect(r.output).toContain('ID int');
    expect(r.output).not.toContain('`json:');
  });

  it('rejects blank input, invalid JSON and empty arrays', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a json/i);
    await expect(run('{bad json}')).rejects.toThrow(/invalid json/i);
    await expect(run('[]', { rootName: 'User' })).rejects.toThrow(/array is empty/i);
  });

  it('reports notes about generated types', async () => {
    const r = await run('{"a":1}', { rootName: 'N' });
    expect(r.notes?.join(' ')).toMatch(/1 named type/i);
  });
});
