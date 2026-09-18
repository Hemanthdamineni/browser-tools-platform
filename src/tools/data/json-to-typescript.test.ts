import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-to-typescript.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) => await tool.run({ text, options }) as { output: string; stats?: Record<string, string | number> };

describe('json-to-typescript', async () => {
  it('emits a root interface with a nested named type', async () => {
    expect((await run('{"id":1,"name":"Ann","address":{"city":"NYC","zip":null}}')).output).toBe(
      [
        'interface Root {',
        '  id: number;',
        '  name: string;',
        '  address: RootAddress;',
        '}',
        '',
        'interface RootAddress {',
        '  city: string;',
        '  zip: null;',
        '}',
      ].join('\n'),
    );
  });

  it('merges every array element, making absent keys optional', async () => {
    expect((await run('{"users":[{"a":1},{"a":2,"b":"x"}]}')).output).toBe(
      [
        'interface Root {',
        '  users: RootUsersItem[];',
        '}',
        '',
        'interface RootUsersItem {',
        '  a: number;',
        '  b?: string;',
        '}',
      ].join('\n'),
    );
  });

  it('uses only the first element when arrayMergeSampleAll is off', async () => {
    expect((await run('{"users":[{"a":1},{"a":2,"b":"x"}]}', { arrayMergeSampleAll: false })).output).toBe(
      [
        'interface Root {',
        '  users: RootUsersItem[];',
        '}',
        '',
        'interface RootUsersItem {',
        '  a: number;',
        '}',
      ].join('\n'),
    );
  });

  it('emits a type alias instead of an interface', async () => {
    expect((await run('{"a":1}', { preferInterfaces: false })).output).toBe(
      ['type Root = {', '  a: number;', '};'].join('\n'),
    );
  });

  it('marks properties readonly', async () => {
    expect((await run('{"a":1}', { readonlyProps: true })).output).toBe(
      ['interface Root {', '  readonly a: number;', '}'].join('\n'),
    );
  });

  it('honours a custom root name', async () => {
    expect((await run('{"a":1}', { rootName: 'Config' })).output).toBe(
      ['interface Config {', '  a: number;', '}'].join('\n'),
    );
  });

  it('turns null and mixed arrays into unions', async () => {
    expect((await run('{"x":null,"y":[1,"a",null]}')).output).toBe(
      ['interface Root {', '  x: null;', '  y: (number | string | null)[];', '}'].join('\n'),
    );
  });

  it('handles an empty object and a bare array root', async () => {
    expect((await run('{}')).output).toBe('interface Root {}');
    expect((await run('[]')).output).toBe('type Root = unknown[];');
    expect((await run('["a","b"]')).output).toBe('type Root = string[];');
  });

  it('quotes keys that are not valid identifiers', async () => {
    expect((await run('{"a-b":1}')).output).toBe(['interface Root {', '  "a-b": number;', '}'].join('\n'));
  });

  it('reports the number of named types', async () => {
    expect((await run('{"address":{"city":"NYC"}}')).stats?.['named types']).toBe(2);
  });

  it('empty input returns empty output', async () => {
    expect((await run('   ')).output).toBe('');
  });

  it('throws ToolError on invalid JSON', async () => {
    await expect(run('{bad')).rejects.toThrow(ToolError);
  });
});
