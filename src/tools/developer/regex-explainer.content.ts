/**
 * Editorial content for the regex-explainer tool page.
 *
 * Kept out of ``regex-explainer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the breakdown gives you',
      body: 'Paste a regular expression and the tool walks it character by character and returns a table: each token on one side, a plain-English explanation of what that token matches on the other. A literal is described as the character it matches, a character class as the set it allows, an escape as what it stands for, and so on. Groups, quantifiers and anchors each get their own row, so a dense pattern reads as a sequence of small, named pieces.',
    },
    {
      heading: 'Reading a pattern you inherited',
      body: 'The obvious use is a regex someone else wrote that you now have to maintain — a validation pattern copied from a library, or a routing rule whose parentheses and question marks have lost all meaning. It is also a practical way to learn: write a small pattern, see how the tool names each part, and the syntax stops feeling like punctuation soup.',
    },
    {
      heading: 'Groups, quantifiers and flags',
      body: 'Capturing groups, non-capturing groups, named groups and lookarounds are told apart rather than lumped together, because they change what a pattern returns and whether it consumes text. Quantifiers state exactly how many repetitions they require and whether they are lazy — {3,16} is spelled out, and an asterisk is described as zero or more rather than just "any". Whatever letters you put in the flags field (g, i, m, s, u, y, d, v) are decoded so the explanation of anchors, the dot and case sensitivity matches how the pattern will actually run.',
    },
    {
      heading: 'What it does not do',
      body: 'It explains, it does not execute: no test string is matched against the pattern, so it will not tell you whether your expression matches the text you have in mind — use a regex tester for that. It flags unknown escapes and unbalanced groups, but a pattern can be syntactically fine and still not mean what you intended. The syntax explained is the JavaScript/ECMAScript flavour, so PCRE-only constructs may be reported as unknown.',
    },
    {
      heading: 'Nothing is sent anywhere',
      body: 'The pattern is tokenised in this tab. No test string, no pattern and no flags leave your device, and the tool needs no network access, so patterns from private code are safe to paste.',
    },
  ],
  faq: [
    {
      q: 'Which regex syntax is explained?',
      a: 'The JavaScript/ECMAScript flavour your browser uses: literals, character classes, escapes, capturing/non-capturing/named groups, lookarounds, quantifiers, anchors, alternation and backreferences. PCRE-only syntax may be shown as unknown.',
    },
    {
      q: 'Will it validate my pattern?',
      a: 'It flags unknown escapes and unbalanced groups, but it does not execute the expression. Use it to read a pattern, not to prove it matches what you expect.',
    },
    {
      q: 'What does the flags field do?',
      a: 'The letters you enter (g, i, m, s, u, y, d, v) are decoded so the anchors, dot and case sensitivity read correctly in the explanation.',
    },
    {
      q: 'Does it tell me if my regex will be slow?',
      a: 'No. The breakdown describes structure, not performance. Catastrophic backtracking comes from nested quantifiers over overlapping alternatives, and you still need to test the expression against realistic input to find it.',
    },
  ],
} as const;
