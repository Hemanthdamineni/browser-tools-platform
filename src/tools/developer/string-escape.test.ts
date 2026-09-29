import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './string-escape.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string };

describe('string-escape', async () => {
  it('empty input → empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('escapes for a JavaScript string (default target)', async () => {
    expect((await run('He said "hi"\nbye')).output).toBe('He said \\"hi\\"\\nbye');
  });

  it('escapes for JSON with surrounding quotes', async () => {
    expect((await run('a"b', { target: 'json' })).output).toBe('"a\\"b"');
  });

  it('escapes control chars for C as octal', async () => {
    const res = await run('x\x01y\t', { target: 'c' });
    expect(res.output).toBe('x\\001y\\t');
  });

  it('escapes non-ASCII for Java as \\uNNNN', async () => {
    expect((await run('\\u20ac\\n', { target: 'java' })).output).toBe('\\\\u20ac\\\\n');
  });

  it('escapes for Python with \\x and \\U', async () => {
    expect((await run('é\n😀', { target: 'python' })).output).toBe('\\xe9\\n\\U0001f600');
  });

  it('escapes for POSIX shell with single-quote wrapping', async () => {
    expect((await run("it's", { target: 'shell' })).output).toBe("'it'\\''s'");
  });

  it('escapes for SQL by doubling quotes', async () => {
    expect((await run("O'Brien", { target: 'sql' })).output).toBe("O''Brien");
  });

  it('escapes CSV fields only when they need quoting', async () => {
    expect((await run('a,b', { target: 'csv' })).output).toBe('"a,b"');
    expect((await run('a"b', { target: 'csv' })).output).toBe('"a""b"');
    expect((await run('abc', { target: 'csv' })).output).toBe('abc');
  });

  it('escapes for HTML and XML', async () => {
    expect((await run('<a href="x">& \'', { target: 'html' })).output).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp; &#39;',
    );
    expect((await run("<a>'", { target: 'xml' })).output).toBe('&lt;a&gt;&apos;');
  });

  it('escapes for a URL component', async () => {
    expect((await run('a b&c', { target: 'url' })).output).toBe('a%20b%26c');
  });

  it('unescapes JavaScript escapes and drops unknown backslashes', async () => {
    expect(
      (await run('\\x41\\u0042\\n\\q', { target: 'javascript', mode: 'unescape' })).output,
    ).toBe('AB\nq');
  });

  it('unescapes a JSON string with or without quotes', async () => {
    expect((await run('"a\\\\nb"', { target: 'json', mode: 'unescape' })).output).toBe('a\\nb');
    expect((await run('a\\\\tb', { target: 'json', mode: 'unescape' })).output).toBe('a\\tb');
  });

  it('unescapes C / Python numeric escapes', async () => {
    expect((await run('\\101', { target: 'c', mode: 'unescape' })).output).toBe('A');
    expect((await run('\\x41\\U0001F600', { target: 'python', mode: 'unescape' })).output).toBe(
      'A😀',
    );
  });

  it('unescapes HTML and XML entities', async () => {
    expect((await run('<a>&' + '#x41;', { target: 'html', mode: 'unescape' })).output).toBe('<a>A');
    expect((await run('&apos;<', { target: 'xml', mode: 'unescape' })).output).toBe("'<");
  });

  it('unescapes shell, SQL and CSV', async () => {
    expect((await run("'it'\\''s'", { target: 'shell', mode: 'unescape' })).output).toBe("it's");
    expect((await run("'O''Brien'", { target: 'sql', mode: 'unescape' })).output).toBe("O'Brien");
    expect((await run('"a""b"', { target: 'csv', mode: 'unescape' })).output).toBe('a"b');
  });

  it('unescapes a URL component', async () => {
    expect((await run('a%20b%26c', { target: 'url', mode: 'unescape' })).output).toBe('a b&c');
  });

  it('round-trips every escape target', async () => {
    const sample = 'Tab\\tNL\\nQuote " Apostrophe \' Amp & Angle < > Unicode \\xe4\\xb8\\x96';
    for (const target of [
      'javascript',
      'json',
      'c',
      'java',
      'python',
      'shell',
      'sql',
      'csv',
      'html',
      'xml',
      'url',
    ]) {
      const escaped = (await run(sample, { target, mode: 'escape' })).output;
      expect((await run(escaped, { target, mode: 'unescape' })).output).toBe(sample);
    }
  });

  it('throws ToolError on malformed percent-encoding', async () => {
    await expect(run('%zz', { target: 'url', mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError on an invalid JSON string', async () => {
    await expect(run('"not\\xjson"', { target: 'json', mode: 'unescape' })).rejects.toThrow(
      ToolError,
    );
  });

  it('reports stats', async () => {
    const res = (await tool.run({ text: 'abc', options: { target: 'url', mode: 'escape' } })) as {
      stats?: Record<string, string | number>;
    };
    expect(res.stats?.target).toBe('url');
    expect(res.stats?.mode).toBe('escape');
  });
});
