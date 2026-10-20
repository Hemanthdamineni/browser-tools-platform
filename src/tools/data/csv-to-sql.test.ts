import { describe, expect, it } from 'vitest';
import tool from './csv-to-sql.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

describe('csv-to-sql', () => {
  it('builds a basic INSERT with header detection', async () => {
    const result = await run('id,name\n1,Ada\n2,Turing', { table: 'users' });
    expect(result.render).toBe('code');
    expect(result.output).toBe(
      'INSERT INTO users (id, name) VALUES\n' + "(1, 'Ada'),\n" + "(2, 'Turing');\n",
    );
    expect(result.stats?.rows).toBe(2);
    expect(result.stats?.columns).toBe(2);
    expect(result.stats?.statements).toBe(1);
  });

  it('handles quoted fields with commas, quotes and apostrophes', async () => {
    const result = await run('name,note\n"O\'Brien, Tom","said ""hi"""', { table: 'notes' });
    expect(result.output).toBe(
      'INSERT INTO notes (name, note) VALUES\n' + "('O''Brien, Tom', 'said \"hi\"');\n",
    );
  });

  it('maps NULL sentinels and empty cells to NULL', async () => {
    const result = await run('name,email\nAda,NULL\nTuring,', { table: 'users' });
    expect(result.output).toBe(
      'INSERT INTO users (name, email) VALUES\n' + "('Ada', NULL),\n" + "('Turing', NULL);\n",
    );
  });

  it('emits numbers unquoted but keeps leading-zero codes as strings', async () => {
    const result = await run('a,b\n1,01\n-2.5,0012', { table: 't' });
    expect(result.output).toBe(
      'INSERT INTO t (a, b) VALUES\n' + "(1, '01'),\n" + "(-2.5, '0012');\n",
    );
  });

  it('supports scientific-notation numbers', async () => {
    const result = await run('v\n1e3\n2.5e-2', { table: 't' });
    expect(result.output).toBe('INSERT INTO t (v) VALUES\n' + '(1e3),\n' + '(2.5e-2);\n');
  });

  it('generates col1..colN when there is no header', async () => {
    const result = await run('1,x\n2,y', { table: 't', header: false });
    expect(result.output).toBe(
      'INSERT INTO t (col1, col2) VALUES\n' + "(1, 'x'),\n" + "(2, 'y');\n",
    );
  });

  it('uses double-quoted literals when requested', async () => {
    const result = await run("a,b\n1,O'Brien", { table: 't', quoteStyle: 'double' });
    expect(result.output).toContain('"O\'Brien"');
    expect(result.output).not.toContain("'O''Brien'");
  });

  it('escapes backslashes and newlines in MySQL mode', async () => {
    const result = await run('v\n"a\\b"\n"x\ny"', { table: 't', mysqlEscapes: true });
    expect(result.output).toContain("'a\\\\b'");
    expect(result.output).toContain("'x\\ny'");
  });

  it('splits output into batches', async () => {
    const result = await run('a\n1\n2\n3\n4\n5', { table: 't', batch: 2 });
    const statements = result.output
      .trim()
      .split(/;\n/)
      .filter((s) => s.length > 0);
    expect(result.stats?.statements).toBe(3);
    expect(statements.length).toBe(3);
    expect(statements[0]).toContain('(1),');
    expect(result.output).toMatch(/INSERT INTO t \(a\) VALUES/);
  });

  it('preserves newlines inside quoted fields as string content (standard SQL)', async () => {
    const result = await run('note\n"line1\nline2"', { table: 't' });
    expect(result.output).toContain("'line1\nline2'");
  });

  it('skips blank lines and whitespace-only rows', async () => {
    const result = await run('a\n1\n\n2\n ', { table: 't' });
    expect(result.stats?.rows).toBe(2);
  });

  it('rejects duplicate column names', async () => {
    await expect(run('a,a\n1,2', { table: 't' })).rejects.toThrow(/duplicate column names/i);
  });

  it('rejects invalid column and table names', async () => {
    await expect(run('first name\n1', { table: 't' })).rejects.toThrow(
      /not valid sql identifiers/i,
    );
    await expect(run('a\n1', { table: 'select; drop' })).rejects.toThrow(
      /not a valid sql table name/i,
    );
  });

  it('rejects rows with the wrong column count', async () => {
    await expect(run('a,b\n1', { table: 't' })).rejects.toThrow(/row 2 has 1 cells/i);
  });

  it('rejects an unterminated quoted field', async () => {
    await expect(run('a\n"oops', { table: 't' })).rejects.toThrow(/unterminated quoted field/i);
  });

  it('rejects empty input and a header without rows', async () => {
    await expect(run('   ', { table: 't' })).rejects.toThrow(/paste a csv/i);
    await expect(run('a,b', { table: 't' })).rejects.toThrow(/no data rows/i);
  });
});
