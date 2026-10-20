import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './json-schema-check.tool';

type Result = {
  output: string;
  stats?: Record<string, string | number | boolean>;
  notes?: string[];
};
const run = (schema: unknown, document: unknown) =>
  tool.run({ text: JSON.stringify({ schema, document }), options: {} }) as Result;
const rows = (result: Result) => JSON.parse(result.output).rows as string[][];

describe('json-schema-check', () => {
  it('accepts a valid object and reports no errors', () => {
    const result = run(
      {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2 },
          age: { type: 'integer', minimum: 0 },
        },
        additionalProperties: false,
      },
      { name: 'Ada', age: 36 },
    );
    expect(result.stats).toMatchObject({ valid: 'yes', errors: 0 });
  });

  it('reports missing, wrong type, bounds, and escaped JSON Pointer paths', () => {
    const result = run(
      {
        type: 'object',
        required: ['a/b'],
        properties: { 'a/b': { type: 'string', minLength: 3, pattern: '^ok' } },
        additionalProperties: false,
      },
      { 'a/b': 'no', extra: 1 },
    );
    expect(result.stats?.valid).toBe('no');
    expect(rows(result)).toContainEqual(['/a~1b', 'minLength', expect.any(String)]);
    expect(rows(result)).toContainEqual(['/a~1b', 'pattern', expect.any(String)]);
    expect(rows(result)).toContainEqual(['/extra', 'additionalProperties', expect.any(String)]);
  });

  it('supports type arrays, const, enum, and false schemas', () => {
    expect(run({ type: ['string', 'null'] }, null).stats?.errors).toBe(0);
    expect(run({ const: 3 }, 4).stats?.errors).toBe(1);
    expect(run({ enum: ['a', 'b'] }, 'c').stats?.errors).toBe(1);
    expect(run(false, 1).stats?.errors).toBe(1);
  });

  it('checks arrays, unique items, nested schema, and Unicode code point lengths', () => {
    const result = run(
      { type: 'array', minItems: 3, uniqueItems: true, items: { type: 'string', maxLength: 1 } },
      ['😀', '😀'],
    );
    expect(rows(result).map((row) => row[1])).toEqual(
      expect.arrayContaining(['minItems', 'uniqueItems']),
    );
    expect(rows(result).some((row) => row[1] === 'maxLength')).toBe(false);
  });

  it('checks numeric exclusive bounds and multiples', () => {
    const result = run({ type: 'number', exclusiveMinimum: 1, maximum: 10, multipleOf: 2 }, 3);
    expect(rows(result).map((row) => row[1])).toEqual(['multipleOf']);
    expect(run({ type: 'number', multipleOf: 0.1 }, 0.3).stats?.errors).toBe(0);
  });

  it('reports unsupported keywords instead of silently claiming full validation', () => {
    const result = run(
      { type: 'string', format: 'email', anyOf: [{ type: 'string' }] },
      'not-email',
    );
    expect(result.stats?.unsupported).toBe(1);
    expect(result.notes?.join(' ')).toContain('format');
  });

  it('validates malformed payloads and enforces input size', () => {
    expect(() => tool.run({ text: '{bad', options: {} })).toThrow(/valid JSON/i);
    expect(() => tool.run({ text: JSON.stringify({ schema: {} }), options: {} })).toThrow(
      ToolError,
    );
    expect(() => tool.run({ text: ' '.repeat(500_001), options: {} })).toThrow(ToolError);
  });
});
