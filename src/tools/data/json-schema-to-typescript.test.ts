import { describe, expect, it } from 'vitest';
import tool from './json-schema-to-typescript.tool';

type Result = { output: string; language?: string; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const USER_SCHEMA = JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['id', 'name'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    role: { $ref: '#/$defs/Role' },
  },
  $defs: { Role: { enum: ['admin', 'user'] } },
});

describe('json-schema-to-typescript', () => {
  it('generates an interface with required/optional properties and $defs', async () => {
    const r = await run(USER_SCHEMA);
    expect(r.output).toBe(
      [
        'export interface Root {',
        '  id: number;',
        '  name: string;',
        '  role?: Role;',
        '}',
        '',
        "export type Role = 'admin' | 'user';",
      ].join('\n'),
    );
    expect(r.language).toBe('typescript');
    expect(r.stats?.declarations).toBe(2);
    expect(r.stats?.refs).toBe(1);
  });

  it('maps arrays of objects and nullable type unions', async () => {
    const schema = JSON.stringify({
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        },
        count: { type: ['integer', 'null'] },
      },
    });
    const r = await run(schema);
    expect(r.output).toBe(
      [
        'export interface Root {',
        '  items: Array<{',
        '    id: string;',
        '  }>;',
        '  count?: number | null;',
        '}',
      ].join('\n'),
    );
  });

  it('emits a type alias when the style option is type', async () => {
    const r = await run(JSON.stringify({ type: 'object', properties: { id: { type: 'integer' } } }), {
      style: 'type',
    });
    expect(r.output).toBe(['export type Root = {', '  id?: number;', '};'].join('\n'));
  });

  it('quotes exotic property keys and copies descriptions as JSDoc', async () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: { 'foo-bar': { type: 'string', description: 'A dashed key' } },
    });
    const r = await run(schema);
    expect(r.output).toBe(
      ['export interface Root {', '  /** A dashed key */', '  "foo-bar"?: string;', '}'].join('\n'),
    );
  });

  it('turns anyOf into a union, enums into literals and const into a literal', async () => {
    const union = await run(JSON.stringify({ anyOf: [{ type: 'string' }, { type: 'number' }] }));
    expect(union.output).toBe('export type Root = string | number;');
    const single = await run(JSON.stringify({ enum: ['a'] }));
    expect(single.output).toBe("export type Root = 'a';");
    const konst = await run(JSON.stringify({ const: 42 }));
    expect(konst.output).toBe('export type Root = 42;');
  });

  it('turns allOf into an intersection', async () => {
    const schema = JSON.stringify({
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } } },
        { type: 'object', properties: { b: { type: 'number' } } },
      ],
    });
    const r = await run(schema);
    expect(r.output).toContain('a?: string;');
    expect(r.output).toContain(' & ');
    expect(r.output.startsWith('export type Root = {')).toBe(true);
  });

  it('adds an index signature that stays assignable to its properties', async () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: { id: { type: 'string' } },
      additionalProperties: { type: 'number' },
    });
    const r = await run(schema);
    expect(r.output).toBe(
      ['export interface Root {', '  id?: string;', '  [key: string]: string | number;', '}'].join('\n'),
    );
    const loose = await run(JSON.stringify({ type: 'object', additionalProperties: true }));
    expect(loose.output).toContain('[key: string]: unknown;');
  });

  it('resolves draft-07 definitions refs', async () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: { foo: { $ref: '#/definitions/Foo' } },
      definitions: { Foo: { type: 'object', properties: { a: { type: 'string' } } } },
    });
    const r = await run(schema);
    expect(r.output).toContain('foo?: Foo;');
    expect(r.output).toContain('export interface Foo {');
    expect(r.stats?.refs).toBe(1);
  });

  it('falls back to unknown for unsupported keywords and remote refs', async () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        a: { not: { type: 'number' } },
        b: { $ref: 'https://example.com/schema.json' },
        c: false,
      },
    });
    const r = await run(schema);
    expect(r.output).toContain('a?: unknown;');
    expect(r.output).toContain('b?: unknown;');
    expect(r.output).toContain('c?: never;');
  });

  it('honors exportTypes, readonlyProps and indent options', async () => {
    const schema = JSON.stringify({ type: 'object', required: ['id'], properties: { id: { type: 'integer' } } });
    const plain = await run(schema, { exportTypes: false });
    expect(plain.output.startsWith('interface Root {')).toBe(true);
    const readonly = await run(schema, { readonlyProps: true });
    expect(readonly.output).toContain('readonly id: number;');
    const wide = await run(schema, { indent: 4 });
    expect(wide.output).toContain('\n    id: number;');
  });

  it('rejects empty, invalid and non-object input', async () => {
    await expect(run('  ')).rejects.toThrow(/schema/i);
    await expect(run('{oops}')).rejects.toThrow(/valid JSON/i);
    await expect(run('[1,2]')).rejects.toThrow(/object/i);
  });
});
