/**
 * Editorial content for the sql-format tool page.
 *
 * Kept out of ``sql-format.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
