import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './string-escape.tool';

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as { output: string; notes?: string[] };

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

/* -------------------------------------------------------------------------- */
/*  Ported from the former "backslash-escape" tool (now target: 'backslash')  */
/* -------------------------------------------------------------------------- */

describe('string-escape — backslash target', async () => {
  const bs = (text: string, options: Record<string, string | number | boolean> = {}) =>
    run(text, { target: 'backslash', ...options });

  it('empty input → empty output in both directions', async () => {
    expect((await bs('')).output).toBe('');
    expect((await bs('', { mode: 'unescape' })).output).toBe('');
  });

  it('escapes tab and newline to short forms (default mode)', async () => {
    expect((await bs('a\tb\nc')).output).toBe('a\\tb\\nc');
  });

  it('doubles a real backslash', async () => {
    expect((await bs('a\\b')).output).toBe('a\\\\b');
  });

  it('escapes NUL as \\0 and other C0 controls as \\xNN', async () => {
    expect((await bs('\x00')).output).toBe('\\0');
    expect((await bs('\x07')).output).toBe('\\x07');
    expect((await bs('\x7f')).output).toBe('\\x7f');
  });

  it('escapes format characters as \\uNNNN', async () => {
    expect((await bs('a\u200bb')).output).toBe('a\\u200bb');
  });

  it('leaves ordinary letters, punctuation and spaces alone', async () => {
    expect((await bs('é世 ok!')).output).toBe('é世 ok!');
  });

  it('unescapes the common sequences', async () => {
    expect((await bs('\\n\\t\\x41\\u0042', { mode: 'unescape' })).output).toBe('\n\tAB');
    expect((await bs('\\0', { mode: 'unescape' })).output).toBe('\x00');
    expect((await bs('a\\\\b', { mode: 'unescape' })).output).toBe('a\\b');
  });

  it('unescapes a \\u{…} code point', async () => {
    expect((await bs('\\u{1F600}', { mode: 'unescape' })).output).toBe('😀');
  });

  it('drops the backslash of an unknown escape and reports it', async () => {
    const res = await bs('\\q\\w x', { mode: 'unescape' });
    expect(res.output).toBe('qw x');
    expect(res.notes?.[0]).toMatch(/\\q, \\w/);
  });

  it('throws ToolError on a code point above U+10FFFF', async () => {
    await expect(bs('\\u{110000}', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError on a non-hex \\u{…} body', async () => {
    await expect(bs('\\u{XYZ}', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError on an unterminated \\u{…} escape', async () => {
    await expect(bs('\\u{1F600', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('round-trips control-heavy text', async () => {
    const original = 'A\tB\nC\x01\x07\u200b\\end';
    const escaped = (await bs(original)).output;
    expect((await bs(escaped, { mode: 'unescape' })).output).toBe(original);
  });

  it('is distinct from the javascript target for format characters', async () => {
    // backslash escapes every Unicode "Other" character; javascript only NUL/controls.
    expect((await bs('a\u200bb')).output).toBe('a\\u200bb');
    expect((await run('a\u200bb', { target: 'javascript' })).output).toBe('a\u200bb');
  });
});

/* -------------------------------------------------------------------------- */
/*  Ported from the former "json-escape" tool (now target: 'json')            */
/* -------------------------------------------------------------------------- */

describe('string-escape — JSON target', async () => {
  const json = (text: string, options: Record<string, string | number | boolean> = {}) =>
    run(text, { target: 'json', ...options });

  it('escapes text into a quoted JSON string literal', async () => {
    expect((await json('he said "hi"\ntab\there')).output).toBe('"he said \\"hi\\"\\ntab\\there"');
  });

  it('escape wraps plain text in quotes', async () => {
    expect((await json('plain')).output).toBe('"plain"');
  });

  it('unescapes a JSON string literal', async () => {
    expect((await json('"line1\\nline2"', { mode: 'unescape' })).output).toBe('line1\nline2');
  });

  it('unescape adds surrounding quotes when missing', async () => {
    expect((await json('a\\tb', { mode: 'unescape' })).output).toBe('a\tb');
  });

  it('escape then unescape round-trips', async () => {
    const original = 'quote " backslash \\ newline \n snowman ☃';
    const escaped = (await json(original)).output;
    expect((await json(escaped, { mode: 'unescape' })).output).toBe(original);
  });

  it('throws ToolError on an unterminated string literal', async () => {
    await expect(json('"unterminated', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('throws ToolError when the text is not a valid string literal', async () => {
    await expect(json('{"a":1}', { mode: 'unescape' })).rejects.toThrow(ToolError);
  });

  it('empty input returns empty output in both modes', async () => {
    expect((await json('', { mode: 'escape' })).output).toBe('');
    expect((await json('', { mode: 'unescape' })).output).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/*  Ported from the former "unicode-escape" tool (now target: 'unicode')      */
/* -------------------------------------------------------------------------- */

describe('string-escape — unicode target', async () => {
  const uni = (text: string, options: Record<string, string | number | boolean> = {}) =>
    run(text, { target: 'unicode', ...options });

  it('escapes non-ASCII to \\uXXXX by default', async () => {
    expect((await uni('café')).output).toBe('caf\\u00E9');
  });

  it('escapes astral chars as a surrogate pair (JS style)', async () => {
    expect((await uni('😀')).output).toBe('\\uD83D\\uDE00');
  });

  it('python style uses \\U for astral', async () => {
    expect((await uni('😀', { style: 'python' })).output).toBe('\\U0001F600');
  });

  it('python style uses \\uNNNN for BMP', async () => {
    expect((await uni('é', { style: 'python' })).output).toBe('\\u00E9');
  });

  it('CSS and HTML styles emit their own notations', async () => {
    expect((await uni('é', { style: 'css' })).output).toBe('\\0000E9 ');
    expect((await uni('é', { style: 'html' })).output).toBe('&#x00E9;');
  });

  it('U+ style', async () => {
    expect((await uni('é', { style: 'unicode-plus' })).output).toBe('U+00E9');
  });

  it('all-characters mode escapes ASCII too', async () => {
    expect((await uni('AB', { which: 'all' })).output).toBe('\\u0041\\u0042');
  });

  it('unescapes mixed forms in one pass', async () => {
    expect(
      (await uni('caf\\u00e9 \\u{1F600} A\\x42 U+0043 &#x44; &#69;', { mode: 'unescape' })).output,
    ).toBe('café 😀 AB C D E');
  });

  it('round-trips emoji', async () => {
    const s = 'hi 🌍 café';
    const escaped = (await uni(s)).output;
    expect((await uni(escaped, { mode: 'unescape' })).output).toBe(s);
  });

  it('empty input', async () => {
    expect((await uni('')).output).toBe('');
  });

  it('reports style and which in stats', async () => {
    const res = (await tool.run({
      text: 'é',
      options: { target: 'unicode', style: 'html', which: 'all' },
    })) as { stats?: Record<string, string | number> };
    expect(res.stats?.style).toBe('html');
    expect(res.stats?.which).toBe('all');
  });
});
