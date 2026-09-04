import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-to-jsonschema.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

const parsed = (text: string, options: Record<string, string | number | boolean> = {}) =>
  JSON.parse(run(text, options).output) as Record<string, unknown>;

describe('json-to-jsonschema', () => {
  it('infers an object schema with required keys by default', () => {
    expect(parsed('{"name":"Ann","age":30,"active":true}')).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
        active: { type: 'boolean' },
      },
      required: ['name', 'age', 'active'],
      additionalProperties: false,
    });
  });

  it('distinguishes integer from number', () => {
    expect(parsed('{"a":5,"b":5.5}').properties).toEqual({
      a: { type: 'integer' },
      b: { type: 'number' },
    });
  });

  it('maps null to the null type', () => {
    expect((parsed('{"x":null}').properties as Record<string, unknown>).x).toEqual({
      type: 'null',
    });
  });

  it('omits required when requireAllProps is off', () => {
    const p = parsed('{"a":1}', { requireAllProps: false });
    expect(p.required).toBeUndefined();
    expect(p.additionalProperties).toBe(false);
  });

  it('allows additional properties when the option is set', () => {
    expect(parsed('{"a":1}', { additionalProperties: true }).additionalProperties).toBe(true);
  });

  it('adds a title when provided', () => {
    expect(parsed('{"a":1}', { title: 'Widget' }).title).toBe('Widget');
    expect('title' in parsed('{"a":1}')).toBe(false);
  });

  it('describes an array of integers', () => {
    expect(parsed('[1,2,3]')).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
      items: { type: 'integer' },
    });
  });

  it('merges element schemas of an array of objects', () => {
    expect(parsed('[{"a":1},{"a":2,"b":"x"}]').items).toEqual({
      type: 'object',
      properties: { a: { type: 'integer' }, b: { type: 'string' } },
      required: ['a'],
      additionalProperties: false,
    });
  });

  it('collapses mixed primitive elements to a type array', () => {
    expect(parsed('["a",1,null]').items).toEqual({ type: ['integer', 'null', 'string'] });
  });

  it('handles empty object and empty array', () => {
    expect(parsed('{}')).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {},
      additionalProperties: false,
    });
    expect(parsed('[]')).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
    });
  });

  it('nests object schemas', () => {
    expect((parsed('{"a":{"b":1}}').properties as Record<string, unknown>).a).toEqual({
      type: 'object',
      properties: { b: { type: 'integer' } },
      required: ['b'],
      additionalProperties: false,
    });
  });

  it('empty input returns empty output', () => {
    expect(run('  ').output).toBe('');
  });

  it('throws ToolError on invalid JSON', () => {
    expect(() => run('{oops')).toThrow(ToolError);
  });
});
