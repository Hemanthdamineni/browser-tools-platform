import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'sql-format',
  name: 'SQL Formatter (basic)',
  category: 'developer',
  summary:
    'Pretty-print a SQL query: keyword casing, clause line breaks, indented joins and columns.',
  description:
    'A lightweight SQL pretty-printer. It uppercases keywords, starts each major clause on its own line, indents JOIN conditions and AND/OR, and breaks a multi-column SELECT list one column per line. String literals and comments are left untouched.',
  keywords: [
    'sql formatter',
    'format sql',
    'sql beautifier',
    'sql pretty print',
    'prettify sql',
    'sql indent',
    'query formatter',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'uppercaseKeywords',
      label: 'Uppercase keywords',
      type: 'boolean',
      default: true,
      help: 'Rewrite SELECT, FROM, JOIN, AND … in uppercase.',
    },
    {
      key: 'indent',
      label: 'Indent width',
      type: 'select',
      default: '2',
      choices: [
        { value: '2', label: '2 spaces' },
        { value: '4', label: '4 spaces' },
      ],
    },
  ],
  examples: [
    {
      title: 'Format a SELECT',
      input: 'select id, name, email from users where active = 1 order by name',
    },
    {
      title: 'Join with conditions',
      input:
        'SELECT o.id, c.name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id AND c.active = 1',
    },
    {
      title: 'Keep lowercase',
      input: 'select a from t',
      options: { uppercaseKeywords: false },
    },
  ],
  faq: [
    {
      q: 'Is this a real SQL parser?',
      a: 'No. It is a formatter built from string rules, not a grammar. It handles common SELECT/INSERT/UPDATE/DELETE shapes but will not understand every dialect or deeply nested statement.',
    },
    {
      q: 'Will it touch my string literals or comments?',
      a: 'No. Single- and double-quoted text, -- line comments and /* block */ comments are masked before formatting and restored verbatim.',
    },
    {
      q: 'Why did it report an unterminated string?',
      a: 'The input has an opening quote or /* with no matching close, so the formatter cannot tell where the literal ends.',
    },
  ],
  related: [  "json-format",
  "xml-format",
  "markdown-to-html",
  "regex-tester"],
  status: 'stable',
};
