import { describe, expect, it } from 'vitest';
import tool from './json-to-zod.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-zod', () => {
  it('maps scalar types to zod primitives', async () => {
    const r = await run('{"id":1,"name":"Ada","active":true,"score":9.5}');
    expect(r.output).toContain('"id": z.number()');
    expect(r.output).toContain('"name": z.string()');
    expect(r.output).toContain('"active": z.boolean()');
    expect(r.output).toContain('"score": z.number()');
    expect(r.output).toMatch(/^import \{ z \} from 'zod';/);
  });

  it('nests objects and arrays', async () => {
    const r = await run('{"address":{"city":"London","zip":"SW1"},"roles":["admin"]}');
    expect(r.output).toContain('"address": z.object({');
    expect(r.output).toContain('"city": z.string()');
    expect(r.output).toContain('"roles": z.array(z.string())');
  });

  it('handles array root', async () => {
    const r = await run('[{"id":1},{"id":2}]');
    expect(r.output).toContain('const schema = z.array(z.object({');
    expect(r.output).toContain('"id": z.number()');
  });

  it('maps null and empty arrays', async () => {
    const r = await run('{"a":null,"tags":[]}');
    expect(r.output).toContain('"a": z.any()');
    expect(r.output).toContain('"tags": z.array(z.any())');
  });

  it('uses the variable name option', async () => {
    const r = await run('{"a":1}', { variable: 'userSchema' });
    expect(r.output).toContain('const userSchema = ');
    expect(r.output).toContain('export { userSchema };');
  });

  it('keys are quoted and escaped', async () => {
    const r = await run('{"a-b":1,"weird key":true,"":0}');
    expect(r.output).toContain('"a-b": z.number()');
    expect(r.output).toContain('"weird key": z.boolean()');
    expect(r.output).toContain('"": z.number()');
  });

  it('deeply nested arrays of objects keep nesting', async () => {
    const r = await run('{"items":[{"sku":"A1","qty":2}]}');
    expect(r.output).toContain('"items": z.array(z.object({');
    expect(r.output).toContain('"qty": z.number()');
  });

  it('rejects invalid JSON and blank input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a json/i);
    await expect(run('{bad}')).rejects.toThrow(/invalid json/i);
  });

  it('reports stats', async () => {
    const r = await run('{"a":1,"b":[{"x":"y"}]}');
    expect(r.stats?.fields).toBe(3); // a, b, and nested x
    expect(r.stats?.topLevel).toBe(1);
  });
});
