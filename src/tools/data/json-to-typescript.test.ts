import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-to-typescript.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; stats?: Record<string, string | number> };

describe('json-to-typescript', () => {
  it('emits a root interface with a nested named type', () => {
    expect(run('{"id":1,"name":"Ann","address":{"city":"NYC","zip":null}}').output).toBe(
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

  it('merges every array element, making absent keys optional', () => {
    expect(run('{"users":[{"a":1},{"a":2,"b":"x"}]}').output).toBe(
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

  it('uses only the first element when arrayMergeSampleAll is off', () => {
    expect(run('{"users":[{"a":1},{"a":2,"b":"x"}]}', { arrayMergeSampleAll: false }).output).toBe(
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

  it('emits a type alias instead of an interface', () => {
    expect(run('{"a":1}', { preferInterfaces: false }).output).toBe(
      ['type Root = {', '  a: number;', '};'].join('\n'),
    );
  });

  it('marks properties readonly', () => {
    expect(run('{"a":1}', { readonlyProps: true }).output).toBe(
      ['interface Root {', '  readonly a: number;', '}'].join('\n'),
    );
  });

  it('honours a custom root name', () => {
    expect(run('{"a":1}', { rootName: 'Config' }).output).toBe(
      ['interface Config {', '  a: number;', '}'].join('\n'),
    );
  });

  it('turns null and mixed arrays into unions', () => {
    expect(run('{"x":null,"y":[1,"a",null]}').output).toBe(
      ['interface Root {', '  x: null;', '  y: (number | string | null)[];', '}'].join('\n'),
    );
  });

  it('handles an empty object and a bare array root', () => {
    expect(run('{}').output).toBe('interface Root {}');
    expect(run('[]').output).toBe('type Root = unknown[];');
    expect(run('["a","b"]').output).toBe('type Root = string[];');
  });

  it('quotes keys that are not valid identifiers', () => {
    expect(run('{"a-b":1}').output).toBe(['interface Root {', '  "a-b": number;', '}'].join('\n'));
  });

  it('reports the number of named types', () => {
    expect(run('{"address":{"city":"NYC"}}').stats?.['named types']).toBe(2);
  });

  it('empty input returns empty output', () => {
    expect(run('   ').output).toBe('');
  });

  it('throws ToolError on invalid JSON', () => {
    expect(() => run('{bad')).toThrow(ToolError);
  });
});
