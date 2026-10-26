/**
 * Editorial content for the regex-tester tool page.
 *
 * Kept out of ``regex-tester.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Four ways to run one pattern',
      body: 'Give it a JavaScript regular expression — source plus flags — and it either lists the matches or transforms the text. List matches returns a table of match number, matched text, a JSON object of capture groups, and the match index. Highlight wraps each match in <<...>>. Replace applies your replacement with $&, $1 and $<name> references. Split cuts the text on the pattern and puts each piece on its own line.',
    },
    {
      heading: 'Debugging a pattern before it ships',
      body: 'Use it to find out why a validation regex rejects a real input, to check exactly what a capture group grabs before wiring it into a parser, or to preview a bulk find-and-replace. The index column often reveals an unintended greedy match.',
    },
    {
      heading: 'Options that change the answer',
      body: 'Pattern is the regex source without slashes and is required. Flags accepts any combination of g, i, m, s, u and y, each at most once. Mode selects the four behaviours, and Replacement only applies in Replace mode, where $& stands for the whole match. In highlight and list modes a global flag is added automatically.',
    },
    {
      heading: 'Caveats',
      body: "This is the browser's own ECMAScript engine, so it differs from PCRE, Python and Go in the corners. A zero-length match is highlighted as itself rather than wrapped. Invalid patterns and flags surface the engine's error, and Split returns the text between the matches.",
    },
    {
      heading: 'Matched inside the tab',
      body: 'The pattern and the text are evaluated by the RegExp engine in your browser and nothing is uploaded. Pasting production log lines into it is safe, and it keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'Which regex flavor is used?',
      a: 'JavaScript (ECMAScript) regular expressions, evaluated with your browser’s built-in RegExp engine.',
    },
    {
      q: 'How are capture groups shown?',
      a: 'In "List matches" mode the Groups column is a JSON object keyed by group number ("1", "2", …) plus any named groups.',
    },
    {
      q: 'Why did I get an "Invalid flags" error?',
      a: 'Only g, i, m, s, u and y are accepted, and each flag may appear once.',
    },
  ],
} as const;
