import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './ndjson.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as {
    output: string;
    stats?: Record<string, string | number>;
  };

describe('ndjson', async () => {
  it('converts NDJSON to a compact JSON array by default', async () => {
    expect((await run('{"a":1}\n{"a":2}\n{"a":3}')).output).toBe('[{"a":1},{"a":2},{"a":3}]');
  });

  it('skips blank and whitespace-only lines', async () => {
    const r = await run('\n{"a":1}\n\n   \n{"a":2}\n');
    expect(r.output).toBe('[{"a":1},{"a":2}]');
    expect(r.stats?.elements).toBe(2);
  });

  it('pretty-prints the array when indent is 2', async () => {
    expect((await run('1\n2', { mode: 'to-array', indent: '2' })).output).toBe('[\n  1,\n  2\n]');
  });

  it('converts a JSON array to NDJSON', async () => {
    expect((await run('[{"a":1},{"b":2},[1,2],"x"]', { mode: 'to-ndjson' })).output).toBe(
      '{"a":1}\n{"b":2}\n[1,2]\n"x"',
    );
  });

  it('to-ndjson lines stay compact regardless of the indent option', async () => {
    expect((await run('[{"a":1,"b":2}]', { mode: 'to-ndjson', indent: '2' })).output).toBe(
      '{"a":1,"b":2}',
    );
  });

  it('throws ToolError naming the offending line number', async () => {
    await expect(run('{"a":1}\n{oops}\n{"a":3}')).rejects.toThrow(ToolError);
    await expect(run('{"a":1}\n{oops}\n{"a":3}')).rejects.toThrow(/Line 2/);
  });

  it('throws ToolError when to-ndjson input is not an array', async () => {
    await expect(run('{"a":1}', { mode: 'to-ndjson' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError when to-ndjson input is invalid JSON', async () => {
    await expect(run('[1,2', { mode: 'to-ndjson' })).rejects.toThrow(ToolError);
  });

  it('empty input returns empty output', async () => {
    expect((await run('   ')).output).toBe('');
  });
});
