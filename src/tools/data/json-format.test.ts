import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-format.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    notes?: string[];
    stats?: Record<string, string | number>;
  };

describe('json-format', async () => {
  it('pretty-prints with 2-space indent by default', async () => {
    expect((await run('{"a":1,"b":[2,3]}')).output).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });

  it('pretty-prints with 4 spaces', async () => {
    expect((await run('{"a":1}', { indent: '4' })).output).toBe('{\n    "a": 1\n}');
  });

  it('pretty-prints with tabs', async () => {
    expect((await run('{"a":1}', { indent: 'tab' })).output).toBe('{\n\t"a": 1\n}');
  });

  it('minifies', async () => {
    expect((await run('{\n  "a": 1,\n  "b": 2\n}', { operation: 'minify' })).output).toBe('{"a":1,"b":2}');
  });

  it('sorts keys recursively', async () => {
    expect((await run('{"b":1,"a":{"d":4,"c":3}}', { operation: 'sort-keys' })).output).toBe(
      '{\n  "a": {\n    "c": 3,\n    "d": 4\n  },\n  "b": 1\n}',
    );
  });

  it('validate reports object type and top-level key count', async () => {
    const r = await run('{"a":1,"b":2}', { operation: 'validate' });
    expect(r.output).toBe('Valid JSON');
    expect(r.notes?.[0]).toContain('object');
    expect(r.notes?.[0]).toContain('2 top-level keys');
  });

  it('validate reports array element count', async () => {
    const r = await run('[10,20,30]', { operation: 'validate' });
    expect(r.notes?.[0]).toContain('array');
    expect(r.notes?.[0]).toContain('3 elements');
  });

  it('reports input and output character stats', async () => {
    const r = await run('{"a":1}', { operation: 'minify' });
    expect(r.stats?.['input chars']).toBe(7);
    expect(r.stats?.['output chars']).toBe(7);
  });

  it('throws ToolError with a line/column hint on a syntax error', async () => {
    await expect(run('{\n  "a": 1,\n}')).rejects.toBeInstanceOf(ToolError);
    await expect(run('{\n  "a": 1,\n}')).rejects.toMatchObject({ hint: expect.stringMatching(/line \d+, column \d+/) });
  });

  it('empty input returns empty output', async () => {
    expect((await run('   ')).output).toBe('');
  });
});