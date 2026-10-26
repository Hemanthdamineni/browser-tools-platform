/**
 * Editorial content for the string-escape tool page.
 *
 * Kept out of ``string-escape.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'One string, many literal dialects',
      body: 'Pick a target and a direction and the text is made safe for that literal, or decoded back out of one. Shell wraps the value in single quotes and rewrites embedded apostrophes, SQL doubles quotes, CSV quotes and escapes per RFC 4180, URL percent-encodes, HTML and XML encode entities, and the generic backslash target turns control characters into sequences like \\n and \\xNN.',
    },
    {
      heading: 'Fitting a value into another syntax',
      body: 'The everyday case is a string that has to be embedded: a Windows path going into a SQL statement, a quote-heavy message inside a JSON field, or a filename with spaces and apostrophes going into a shell command about to be pasted into a terminal.',
    },
    {
      heading: 'Target, direction and the Unicode options',
      body: 'The target list covers JavaScript and TypeScript, JSON, C, Java, Python, POSIX shell, SQL, CSV, HTML, XML, URL components, generic backslash escapes and Unicode code points. Direction toggles between escaping and unescaping, while the Unicode style (JavaScript, Python, CSS, HTML numeric or U+XXXX) and the only-non-ASCII versus all-characters choice apply when escaping.',
    },
    {
      heading: 'Where it refuses or warns',
      body: 'URL unescaping throws on malformed percent-encoding and JSON unescaping throws when the text is not a valid JSON string; a malformed \\u{…} code point is rejected too. The generic backslash target quietly drops an unknown escape such as \\q, keeps the letter, and lists each distinct unknown escape beneath the output.',
    },
    {
      heading: 'Escaping never leaves the tab',
      body: 'Every conversion runs in this browser, so the passwords, tokens and configuration snippets pasted in for quoting travel nowhere.',
    },
  ],
  faq: [
    {
      q: 'Does the JSON target add surrounding quotes?',
      a: 'Yes. JSON strings are quoted by definition, so escaping produces a complete "…" literal and unescaping accepts one with or without the outer quotes.',
    },
    {
      q: 'How does the shell target escape a string?',
      a: "It wraps the whole value in single quotes and rewrites every embedded ' as '\\'' , which is safe for POSIX sh and bash.",
    },
    {
      q: 'Which unescape operations can fail?',
      a: 'URL unescaping throws on malformed percent-encoding, JSON unescaping throws when the text is not a valid JSON string, and the generic backslash target throws on a malformed \\u{…} code point.',
    },
    {
      q: 'What happens to an unknown backslash escape like \\q?',
      a: 'The generic backslash target drops the backslash, keeps the letter, and lists every distinct unknown escape in a note under the output.',
    },
    {
      q: 'Does escaping Unicode depend on the escape direction?',
      a: 'The style and "which characters" options apply when escaping. Unescaping accepts every form at once — \\uXXXX, \\u{…}, \\xXX, \\UXXXXXXXX, U+XXXX, &#xHHHH; and CSS \\HHHHHH — so mixed input just works.',
    },
  ],
} as const;
