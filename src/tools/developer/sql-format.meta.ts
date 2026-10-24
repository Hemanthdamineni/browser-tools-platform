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
  article: [
    {
      heading: 'What the formatter rearranges',
      body: 'The result is one normalised statement: whitespace collapses to a single space, every major clause \u2014 SELECT, FROM, WHERE, GROUP BY, ORDER BY, HAVING, LIMIT, UNION, INSERT INTO, UPDATE, SET, DELETE FROM and any JOIN \u2014 starts on a new line, and ON, AND and OR go on their own indented lines. A SELECT listing more than one column is expanded one column per line, with parentheses respected so a comma inside a function call does not split the list.',
    },
    {
      heading: 'Literals and comments are untouchable',
      body: 'Before anything else, single-quoted strings, double-quoted identifiers, -- line comments and /* block */ comments are lifted out and replaced by sentinels. Formatting runs on what remains and the sentinels are put back, so a keyword inside a string or an odd indentation in a comment comes out exactly as typed. The stats report how many literals were preserved.',
    },
    {
      heading: 'The options',
      body: 'Uppercase keywords rewrites any keyword from the tool\u2019s list, including function names such as COUNT and COALESCE and words like NULL, LIKE and BETWEEN, without touching identifiers. Indent width picks two or four spaces, applying to both AND/OR condition lines and the expanded column list. Turning casing off gives structure-only formatting.',
    },
    {
      heading: 'Why it is called basic',
      body: 'This is a rule-based prettifier, not a SQL grammar. It handles common SELECT, INSERT, UPDATE and DELETE shapes, but nested subqueries, dialect-specific constructs and CASE expressions get the same flat rules rather than structural formatting, and an unterminated quote or block comment stops the run with an error. Everything is pure string work in this tab, with nothing uploaded.',
    },
  ],
  related: ['json-format', 'xml-format', 'markdown-to-html', 'regex-tester'],
  status: 'stable',
};
