import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { ToolError } from '@/lib/types';
import {
  assertReadOnly,
  cellToString,
  cellToJson,
  csvCell,
  listTables,
  runQuery,
  toCsv,
  toJson,
} from './sqlite-viewer.core';

interface SqlDb {
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  run(sql: string, params?: unknown[]): unknown;
  export(): Uint8Array;
  close(): void;
}

let SQL: { Database: new (data?: Uint8Array) => SqlDb };

beforeAll(async () => {
  SQL = await initSqlJs();
});

const makeDb = (setup: string): SqlDb => {
  const db = new SQL.Database();
  db.run(setup);
  return db;
};

describe('sqlite-viewer.core — assertReadOnly', () => {
  it('accepts SELECT, WITH, VALUES, PRAGMA and EXPLAIN', () => {
    expect(() => assertReadOnly('SELECT 1')).not.toThrow();
    expect(() => assertReadOnly('  with cte as (select 1) select * from cte')).not.toThrow();
    expect(() => assertReadOnly('VALUES (1), (2)')).not.toThrow();
    expect(() => assertReadOnly('PRAGMA table_info(t)')).not.toThrow();
    expect(() => assertReadOnly('EXPLAIN QUERY PLAN SELECT 1')).not.toThrow();
    expect(() => assertReadOnly('SELECT 1;')).not.toThrow();
  });

  it('rejects empty input', () => {
    expect(() => assertReadOnly('')).toThrow(ToolError);
    expect(() => assertReadOnly('   ')).toThrow(ToolError);
  });

  it('rejects write statements', () => {
    expect(() => assertReadOnly('DROP TABLE users')).toThrow(ToolError);
    expect(() => assertReadOnly('UPDATE users SET name = 1')).toThrow(ToolError);
    expect(() => assertReadOnly('INSERT INTO t VALUES (1)')).toThrow(ToolError);
    expect(() => assertReadOnly('DELETE FROM t')).toThrow(ToolError);
    expect(() => assertReadOnly('CREATE TABLE t (a)')).toThrow(ToolError);
    expect(() => assertReadOnly('ATTACH DATABASE "x" AS x')).toThrow(ToolError);
  });

  it('rejects multiple statements but allows a trailing semicolon', () => {
    expect(() => assertReadOnly('SELECT 1; SELECT 2')).toThrow(ToolError);
    expect(() => assertReadOnly('SELECT 1;')).not.toThrow();
  });

  it('ignores semicolons inside string literals', () => {
    expect(() => assertReadOnly("SELECT ';'")).not.toThrow();
    expect(() => assertReadOnly("SELECT 'a;b'")).not.toThrow();
    expect(() => assertReadOnly('SELECT "x;y"')).not.toThrow();
  });
});

describe('sqlite-viewer.core — runQuery', () => {
  it('returns headers, display rows and raw rows', () => {
    const db = makeDb(
      "CREATE TABLE t (a INTEGER, b TEXT); INSERT INTO t VALUES (1, 'hi'), (2, NULL);",
    );
    const result = runQuery(db, 'SELECT a, b FROM t ORDER BY a');
    expect(result.headers).toEqual(['a', 'b']);
    expect(result.rows).toEqual([
      ['1', 'hi'],
      ['2', ''],
    ]);
    expect(result.rawRows).toEqual([
      [1, 'hi'],
      [2, null],
    ]);
    db.close();
  });

  it('wraps SQL errors in ToolError', () => {
    const db = makeDb('CREATE TABLE t (a);');
    expect(() => runQuery(db, 'SELECT * FROM missing')).toThrow(ToolError);
    db.close();
  });

  it('handles empty results', () => {
    const db = makeDb('CREATE TABLE t (a);');
    const result = runQuery(db, 'SELECT a FROM t');
    expect(result.headers).toEqual(['a']);
    expect(result.rows).toEqual([]);
    expect(result.rawRows).toEqual([]);
    db.close();
  });
});

describe('sqlite-viewer.core — listTables', () => {
  it('lists tables with columns, pk, notnull and row counts, skipping sqlite_*', () => {
    const db = makeDb(
      'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER);' +
        'CREATE TABLE logs (msg TEXT);' +
        'CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT);' +
        "INSERT INTO users VALUES (1, 'ada', 36);",
    );
    const tables = listTables(db);
    // `sqlite_sequence` (created by AUTOINCREMENT) is an internal table and
    // must not be listed.
    expect(tables.map((t) => t.name)).toEqual(['logs', 'tags', 'users']);

    const users = tables.find((t) => t.name === 'users')!;
    expect(users.rows).toBe(1);
    expect(users.columns).toEqual([
      { name: 'id', type: 'INTEGER', notNull: false, pk: true },
      { name: 'name', type: 'TEXT', notNull: true, pk: false },
      { name: 'age', type: 'INTEGER', notNull: false, pk: false },
    ]);
    expect(users.ddl).toContain('CREATE TABLE users');

    const logs = tables.find((t) => t.name === 'logs')!;
    expect(logs.rows).toBe(0);
    db.close();
  });

  it('returns [] for an empty database', () => {
    const db = makeDb('');
    expect(listTables(db)).toEqual([]);
    db.close();
  });

  it('quotes table names containing quotes when reading table_info', () => {
    const db = makeDb('CREATE TABLE "we""ird" (a);');
    const tables = listTables(db);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.name).toBe('we"ird');
    expect(tables[0]!.columns).toEqual([{ name: 'a', type: '', notNull: false, pk: false }]);
    db.close();
  });
});

describe('sqlite-viewer.core — cell serialization', () => {
  it('maps NULL, BLOB, numbers and text', () => {
    expect(cellToString(null)).toBe('');
    expect(cellToString(undefined)).toBe('');
    expect(cellToString(42)).toBe('42');
    expect(cellToString(1.5)).toBe('1.5');
    expect(cellToString(Number.NaN)).toBe('NaN');
    expect(cellToString(Infinity)).toBe('Infinity');
    expect(cellToString(new Uint8Array([1, 2, 3]))).toBe('BLOB (3 bytes)');
    expect(cellToString('text')).toBe('text');
  });

  it('maps JSON cells with null preserved', () => {
    expect(cellToJson(null)).toBeNull();
    expect(cellToJson(undefined)).toBeNull();
    expect(cellToJson(1.5)).toBe(1.5);
    expect(cellToJson('x')).toBe('x');
    expect(cellToJson(new Uint8Array(4))).toEqual({ blob: 4 });
  });
});

describe('sqlite-viewer.core — CSV', () => {
  it('quotes only cells that need it (RFC 4180)', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('has,comma')).toBe('"has,comma"');
    expect(csvCell('has"quote')).toBe('"has""quote"');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('writes a header row and data rows', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['1', 'x,y'],
          ['2', 'z'],
        ],
      ),
    ).toBe('a,b\n1,"x,y"\n2,z');
  });
});

describe('sqlite-viewer.core — JSON', () => {
  it('produces objects keyed by column with nulls preserved', () => {
    expect(
      toJson(
        ['a', 'b'],
        [
          [1, null],
          [2, 'x'],
        ],
      ),
    ).toBe(
      JSON.stringify(
        [
          { a: 1, b: null },
          { a: 2, b: 'x' },
        ],
        null,
        2,
      ),
    );
  });
});

describe('sqlite-viewer.tool — round trip through run()', () => {
  it('exports a query as CSV', async () => {
    const tool = (await import('./sqlite-viewer.tool')).default;
    const db = makeDb(
      "CREATE TABLE t (a INTEGER, b TEXT); INSERT INTO t VALUES (1, 'x,y'), (2, NULL);",
    );
    const file = new File([new Uint8Array(db.export())], 'test.sqlite');
    const result = (await tool.run({
      files: [file],
      text: 'SELECT a, b FROM t ORDER BY a',
      options: { exportFormat: 'csv' },
    })) as { outputs: { blob: Blob }[]; report: { output: string } };

    const csv = await result.outputs[0]!.blob.text();
    expect(csv).toBe('a,b\n1,"x,y"\n2,');
    expect(result.report.output).toBe(csv);
    db.close();
  });
});
