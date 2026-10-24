import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'string-escape',
  name: 'String Escaper',
  category: 'developer',
  summary:
    'Escape or unescape text for JS, JSON, C, Java, Python, shell, SQL, CSV, HTML, XML, URL, backslash or Unicode.',
  description:
    'Make a string safe to paste inside a literal for the language or format you pick, or reverse a value that is already escaped. Each target uses its own rules: shell single-quote wrapping, SQL doubled quotes, CSV quoting, percent-encoding, entity encoding, generic backslash escapes for control characters, and Unicode code-point notations (\\uXXXX, \\xXX, \\u{…}, U+XXXX, CSS and HTML numeric forms).',
  keywords: [
    'string escape',
    'unescape',
    'escape string',
    'javascript escape',
    'json escape',
    'sql escape',
    'shell escape',
    'csv escape',
    'html escape',
    'xml escape',
    'url encode',
    'escape special characters',
    'backslash escape',
    'control characters',
    'unicode escape',
    'codepoint',
    '\\uXXXX',
    'U+',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'target',
      label: 'Target language / context',
      type: 'select',
      default: 'javascript',
      choices: [
        { value: 'javascript', label: 'JavaScript / TypeScript string' },
        { value: 'json', label: 'JSON string (adds quotes)' },
        { value: 'c', label: 'C string' },
        { value: 'java', label: 'Java string' },
        { value: 'python', label: 'Python string' },
        { value: 'shell', label: 'POSIX shell (single-quote wrap)' },
        { value: 'sql', label: "SQL string (double '')" },
        { value: 'csv', label: 'CSV field (RFC 4180)' },
        { value: 'html', label: 'HTML text / attribute' },
        { value: 'xml', label: 'XML text / attribute' },
        { value: 'url', label: 'URL component (percent-encoding)' },
        { value: 'backslash', label: 'Generic backslash (control characters)' },
        { value: 'unicode', label: 'Unicode code points (\\uXXXX, U+XXXX, CSS, HTML)' },
      ],
    },
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'escape',
      choices: [
        { value: 'escape', label: 'Escape' },
        { value: 'unescape', label: 'Unescape' },
      ],
    },
    {
      key: 'style',
      label: 'Unicode escape style',
      type: 'select',
      default: 'js',
      help: 'Applies to the escape direction. Unescaping always accepts every form at once.',
      showWhen: { key: 'target', value: 'unicode' },
      choices: [
        { value: 'js', label: 'JavaScript / JSON (\\uXXXX, surrogate pairs)' },
        { value: 'python', label: 'Python (\\uXXXX / \\U00XXXXXX)' },
        { value: 'css', label: 'CSS (\\XXXXXX )' },
        { value: 'html', label: 'HTML numeric (&#xXXXX;)' },
        { value: 'unicode-plus', label: 'U+XXXX' },
      ],
    },
    {
      key: 'which',
      label: 'Which characters to escape',
      type: 'select',
      default: 'non-ascii',
      help: 'Applies to the Unicode escape direction.',
      showWhen: { key: 'target', value: 'unicode' },
      choices: [
        { value: 'non-ascii', label: 'Only non-ASCII' },
        { value: 'all', label: 'All characters' },
      ],
    },
  ],
  examples: [
    {
      title: 'Escape for a JavaScript string',
      input: 'He said "hi"\nbye',
      options: { target: 'javascript', mode: 'escape' },
    },
    {
      title: 'Escape a value for SQL',
      input: "O'Brien",
      options: { target: 'sql', mode: 'escape' },
    },
    {
      title: 'Unescape HTML entities',
      input: '&lt;a href=&quot;x&quot;&gt;&amp;&#39;',
      options: { target: 'html', mode: 'unescape' },
    },
    {
      title: 'Turn control characters into \\n \\t \\xNN',
      input: 'a\tb\nc\x07',
      options: { target: 'backslash', mode: 'escape' },
    },
    {
      title: 'Escape emoji as Unicode',
      input: 'A → 😀',
      options: { target: 'unicode', mode: 'escape', style: 'js' },
    },
  ],
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
  related: ['html-entities', 'url-encode', 'hex', 'base64'],
  status: 'stable',
};
