import { describe, expect, it } from 'vitest';
import tool from './json-to-sql.tool';

type Result = {
  output: string;
  render?: string;
  language?: string;
  stats?: Record<string, number>;
  notes?: string[];
};
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('json-to-sql', () => {
  it('converts an array to INSERT statements', async () => {
    const r = await run('[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]', { table: 'users' });
    expect(r.output).toContain('BEGIN;');
    expect(r.output).toContain('INSERT INTO "users" ("id", "name") VALUES (1, \'Ada\');');
    expect(r.output).toContain('INSERT INTO "users" ("id", "name") VALUES (2, \'Grace\');');
    expect(r.output).toContain('COMMIT;');
    expect(r.stats).toEqual(expect.objectContaining({ rows: 2, columns: 2 }));
  });

  it('escapes single quotes and handles null/booleans/nested values', async () => {
    const r = await run('[{"name":"O\'Brien","ok":true,"none":null,"meta":{"a":1}}]', {
      table: 't',
    });
    expect(r.output).toContain("'O''Brien'");
    expect(r.output).toContain(', 1,');
    expect(r.output).toContain('NULL');
    expect(r.output).toContain('\'{"a":1}\'');
  });

  it('unions differing keys and emits NULL for missing ones', async () => {
    const r = await run('[{"a":1},{"b":2}]', { table: 't' });
    expect(r.output).toContain('("a", "b") VALUES (1, NULL)');
    expect(r.output).toContain('("a", "b") VALUES (NULL, 2)');
  });

  it('emits CREATE TABLE with inferred types when enabled', async () => {
    const r = await run('[{"id":1,"score":1.5,"name":"x","flag":true}]', {
      table: 't',
      includeCreate: true,
    });
    expect(r.output).toContain('CREATE TABLE "t" (');
    expect(r.output).toMatch(/"id" INTEGER/);
    expect(r.output).toMatch(/"score" REAL/);
    expect(r.output).toMatch(/"name" TEXT/);
    expect(r.output).toMatch(/"flag" INTEGER/);
  });

  it('supports MySQL backticks and multi-row inserts', async () => {
    const r = await run('[{"a":1},{"a":2}]', { table: 't', dialect: 'mysql', multiRow: true });
    expect(r.output).toContain('INSERT INTO `t` (`a`) VALUES');
    expect(r.output).toContain('  (1),');
    expect(r.output).toContain('  (2);');
  });

  it('can omit the transaction wrapper', async () => {
    const r = await run('[{"a":1}]', { table: 't', transaction: false });
    expect(r.output).not.toContain('BEGIN;');
    expect(r.output).not.toContain('COMMIT;');
  });

  it('rejects invalid input', async () => {
    await expect(run('not json', {})).rejects.toThrow(/invalid json/i);
    await expect(run('[]', {})).rejects.toThrow(/empty/i);
    await expect(run('[1,2]', {})).rejects.toThrow(/must be a JSON object/i);
    await expect(run('[{"a":1}]', { table: '' })).rejects.toThrow(/table name/i);
    await expect(run('[{"a":1}]', { table: 'bad name' })).rejects.toThrow(/valid identifier/i);
  });
});
