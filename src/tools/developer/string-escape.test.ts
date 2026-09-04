import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './string-escape.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };

describe('string-escape', () => {
  it('empty input → empty output', () => {
    expect(run('').output).toBe('');
  });

  it('escapes for a JavaScript string (default target)', () => {
    expect(run('He said "hi"\nbye').output).toBe('He said \\"hi\\"\\nbye');
  });

  it('escapes for JSON with surrounding quotes', () => {
    expect(run('a"b', { target: 'json' }).output).toBe('"a\\"b"');
  });

  it('escapes control chars for C as octal', () => {
    expect(run('x\x01y\t', { target: 'c' }).output).toBe('x\\001y\\t');
  });

  it('escapes non-ASCII for Java as \\uNNNN', () => {
    expect(run('€\n', { target: 'java' }).output).toBe('\\u20ac\\n');
  });

  it('escapes for Python with \\x and \\U', () => {
    expect(run('é\n\u{1f600}', { target: 'python' }).output).toBe('\\xe9\\n\\U0001f600');
  });

  it('escapes for POSIX shell with single-quote wrapping', () => {
    expect(run("it's", { target: 'shell' }).output).toBe("'it'\\''s'");
  });

  it('escapes for SQL by doubling quotes', () => {
    expect(run("O'Brien", { target: 'sql' }).output).toBe("O''Brien");
  });

  it('escapes CSV fields only when they need quoting', () => {
    expect(run('a,b', { target: 'csv' }).output).toBe('"a,b"');
    expect(run('a"b', { target: 'csv' }).output).toBe('"a""b"');
    expect(run('abc', { target: 'csv' }).output).toBe('abc');
  });

  it('escapes for HTML and XML', () => {
    expect(run('<a href="x">& \'', { target: 'html' }).output).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp; &#39;',
    );
    expect(run("<a>'", { target: 'xml' }).output).toBe('&lt;a&gt;&apos;');
  });

  it('escapes for a URL component', () => {
    expect(run('a b&c', { target: 'url' }).output).toBe('a%20b%26c');
  });

  it('unescapes JavaScript escapes and drops unknown backslashes', () => {
    expect(run('\\x41\\u0042\\n\\q', { target: 'javascript', mode: 'unescape' }).output).toBe(
      'AB\nq',
    );
  });

  it('unescapes a JSON string with or without quotes', () => {
    expect(run('"a\\nb"', { target: 'json', mode: 'unescape' }).output).toBe('a\nb');
    expect(run('a\\tb', { target: 'json', mode: 'unescape' }).output).toBe('a\tb');
  });

  it('unescapes C / Python numeric escapes', () => {
    expect(run('\\101', { target: 'c', mode: 'unescape' }).output).toBe('A');
    expect(run('\\x41\\U0001F600', { target: 'python', mode: 'unescape' }).output).toBe(
      'A\u{1f600}',
    );
  });

  it('unescapes HTML and XML entities', () => {
    expect(run('&lt;a&gt;&amp;&#39;&#x41;', { target: 'html', mode: 'unescape' }).output).toBe(
      "<a>&'A",
    );
    expect(run('&apos;&lt;', { target: 'xml', mode: 'unescape' }).output).toBe("'<");
  });

  it('unescapes shell, SQL and CSV', () => {
    expect(run("'it'\\''s'", { target: 'shell', mode: 'unescape' }).output).toBe("it's");
    expect(run("'O''Brien'", { target: 'sql', mode: 'unescape' }).output).toBe("O'Brien");
    expect(run('"a""b"', { target: 'csv', mode: 'unescape' }).output).toBe('a"b');
  });

  it('unescapes a URL component', () => {
    expect(run('a%20b%26c', { target: 'url', mode: 'unescape' }).output).toBe('a b&c');
  });

  it('round-trips every escape target', () => {
    const sample = 'Tab\tNL\nQuote " Apostrophe \' Amp & Angle < > Unicode é世';
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
      const escaped = run(sample, { target, mode: 'escape' }).output;
      expect(run(escaped, { target, mode: 'unescape' }).output).toBe(sample);
    }
  });

  it('throws ToolError on malformed percent-encoding', () => {
    expect(() => run('%zz', { target: 'url', mode: 'unescape' })).toThrow(ToolError);
  });

  it('throws ToolError on an invalid JSON string', () => {
    expect(() => run('not\\xjson', { target: 'json', mode: 'unescape' })).toThrow(ToolError);
  });

  it('reports stats', () => {
    const res = tool.run({ text: 'abc', options: { target: 'url', mode: 'escape' } }) as {
      stats?: Record<string, string | number>;
    };
    expect(res.stats?.target).toBe('url');
    expect(res.stats?.mode).toBe('escape');
  });
});
