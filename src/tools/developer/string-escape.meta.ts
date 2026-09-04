import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'string-escape',
  name: 'String Escaper',
  category: 'developer',
  summary:
    'Escape or unescape text for a target language or context — JS, JSON, C, Java, Python, shell, SQL, CSV, HTML, XML, URL.',
  description:
    'Make a string safe to paste inside a literal for the language or format you pick, or reverse a value that is already escaped. Each target uses its own rules: shell single-quote wrapping, SQL doubled quotes, CSV quoting, percent-encoding, entity encoding, and backslash escapes.',
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
      a: 'URL unescaping throws on malformed percent-encoding, and JSON unescaping throws when the text is not a valid JSON string.',
    },
  ],
  related: ['json-escape', 'html-entities', 'url-encode', 'unicode-escape'],
  status: 'stable',
};
