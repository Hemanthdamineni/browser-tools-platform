import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './dotenv.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; render?: string; language?: string };

describe('dotenv', () => {
  it('parses KEY=VALUE lines, skipping comments and blanks and stripping "export"', () => {
    const src = '# database\n\nexport DB_HOST=localhost\nDB_PORT=5432\nGREETING="hello world"\n';
    const out = run(src, { mode: 'parse' });
    expect(JSON.parse(out.output)).toEqual({
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      GREETING: 'hello world',
    });
    expect(out.render).toBe('code');
    expect(out.language).toBe('json');
  });

  it('strips inline comments from unquoted values and processes double-quote escapes', () => {
    expect(JSON.parse(run('PORT=5432 # the port', { mode: 'parse' }).output)).toEqual({
      PORT: '5432',
    });
    expect(JSON.parse(run('MSG="a\\nb"', { mode: 'parse' }).output)).toEqual({ MSG: 'a\nb' });
  });

  it('does not expand ${VAR} by default', () => {
    const src = 'HOST=localhost\nPORT=5432\nURL=proto://${HOST}:${PORT}/app';
    expect(JSON.parse(run(src, { mode: 'parse' }).output).URL).toBe('proto://${HOST}:${PORT}/app');
  });

  it('expands ${VAR} from earlier keys when expand is on, but not in single quotes', () => {
    const src = "HOST=localhost\nPORT=5432\nURL=proto://${HOST}:${PORT}/app\nRAW='${HOST}'";
    const parsed = JSON.parse(run(src, { mode: 'parse', expand: true }).output);
    expect(parsed.URL).toBe('proto://localhost:5432/app');
    expect(parsed.RAW).toBe('${HOST}');
  });

  it('builds .env text, quoting values with spaces or specials by default', () => {
    const out = run('{ "DB_HOST": "localhost", "GREETING": "hello world" }', { mode: 'build' });
    expect(out.output).toBe('DB_HOST=localhost\nGREETING="hello world"');
    expect(out.language).toBe('bash');
  });

  it('escapes quotes when quoting and handles numbers and null', () => {
    expect(run('{ "A": "he said \\"hi\\"" }', { mode: 'build' }).output).toBe(
      'A="he said \\"hi\\""',
    );
    expect(run('{ "N": 42, "Z": null }', { mode: 'build' }).output).toBe('N=42\nZ=');
  });

  it('leaves values unquoted when quoteValues is off', () => {
    expect(run('{ "GREETING": "hello world" }', { mode: 'build', quoteValues: false }).output).toBe(
      'GREETING=hello world',
    );
  });

  it('returns empty output for empty input', () => {
    expect(run('').output).toBe('');
    expect(run('   \n  ', { mode: 'build' }).output).toBe('');
  });

  it('throws ToolError on a non-comment line without =', () => {
    expect(() => run('DB_HOST=localhost\nJUST_A_LINE', { mode: 'parse' })).toThrow(ToolError);
  });

  it('throws ToolError when building from a non-object or invalid JSON', () => {
    expect(() => run('[1, 2]', { mode: 'build' })).toThrow(ToolError);
    expect(() => run('nope', { mode: 'build' })).toThrow(ToolError);
  });
});
