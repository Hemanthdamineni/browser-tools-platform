import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-patch.tool';

type Result = { output: string; stats?: Record<string, string | number> };
const run = (text: string, patch: string, indent = '2') =>
  tool.run({ text, options: { patch, indent } }) as Result;
const resultJson = (result: Result) => JSON.parse(result.output) as unknown;

describe('json-patch', () => {
  it('adds, removes and replaces values without mutating the input', () => {
    const input = '{"name":"Ada","tags":["a","c"],"old":true}';
    const out = run(input, '[{"op":"replace","path":"/name","value":"Grace"},{"op":"add","path":"/tags/1","value":"b"},{"op":"remove","path":"/old"}]');
    expect(resultJson(out)).toEqual({ name: 'Grace', tags: ['a', 'b', 'c'] });
    expect(input).toBe('{"name":"Ada","tags":["a","c"],"old":true}');
  });

  it('supports root replacement and root removal', () => {
    expect(resultJson(run('{"a":1}', '[{"op":"replace","path":"","value":[1,2]}]'))).toEqual([1, 2]);
    expect(resultJson(run('{"a":1}', '[{"op":"remove","path":""}]'))).toBeNull();
  });

  it('supports append, copy, move and test', () => {
    const patch = '[{"op":"test","path":"/a","value":1},{"op":"copy","from":"/a","path":"/b"},{"op":"move","from":"/items/0","path":"/items/-"}]';
    expect(resultJson(run('{"a":1,"items":["x","y"]}', patch))).toEqual({ a: 1, b: 1, items: ['y', 'x'] });
  });

  it('supports escaped JSON Pointer segments', () => {
    expect(resultJson(run('{"a/b":{"~key":1}}', '[{"op":"replace","path":"/a~1b/~0key","value":2}]'))).toEqual({ 'a/b': { '~key': 2 } });
  });

  it('preserves falsy JSON values and minifies when requested', () => {
    expect(run('{"x":1}', '[{"op":"replace","path":"/x","value":false}]', '0').output).toBe('{"x":false}');
    expect(resultJson(run('{"x":1}', '[{"op":"add","path":"/zero","value":0}]'))).toEqual({ x: 1, zero: 0 });
  });

  it('rejects malformed documents, patches, operations and paths', () => {
    expect(() => run('{bad', '[]')).toThrow(ToolError);
    expect(() => run('{}', '{bad')).toThrow(ToolError);
    expect(() => run('{}', '[{"op":"wat","path":"/x"}]')).toThrow(/invalid patch operation/i);
    expect(() => run('{}', '[{"op":"add","path":"/x~2","value":1}]')).toThrow(/operation 1/i);
    expect(() => run('{"x":1}', '[{"op":"replace","path":"/missing","value":2}]')).toThrow(/operation 1/i);
  });

  it('stops on failed tests and never returns a partial result', () => {
    expect(() => run('{"x":1}', '[{"op":"add","path":"/y","value":2},{"op":"test","path":"/x","value":9}]')).toThrow(/patch operation 2/i);
  });

  it('rejects moving a node into its own descendant', () => {
    expect(() => run('{"a":{"b":1}}', '[{"op":"move","from":"/a","path":"/a/b/c"}]')).toThrow(/patch operation 1/i);
  });
});
