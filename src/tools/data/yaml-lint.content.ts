/**
 * Editorial content for the yaml-lint tool page.
 *
 * Kept out of ``yaml-lint.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Lint first, then normalise',
      body: 'The tool reads the document line by line and builds a logical structure, then reports every problem it finds as a table row with a line and column: tabs used for indentation, an unclosed quote or flow bracket, a duplicate mapping key, or a construct it cannot represent such as an anchor or tag. Only when nothing is wrong does it also emit normalised YAML if you asked for it.',
    },
    {
      heading: 'What the normalised output does',
      body: 'Normalising re-emits the parsed document with consistent indentation at the width you choose (2 to 8 spaces), decodes quoted scalars back to their values, strips trailing comments and adds safe quoting only where a plain scalar would be ambiguous. Because the output is regenerated from values, it parses back to exactly the same data — the change is presentation, not meaning.',
    },
    {
      heading: 'A concrete use',
      body: 'Paste a Kubernetes manifest or a CI workflow that a colleague hand-edited and broken. Instead of the runtime’s terse “mapping values are not allowed here”, you get a list of the offending lines — most often a tab where spaces belonged, or two keys with the same name — so the fix is obvious before the file ever reaches the cluster.',
    },
    {
      heading: 'Scope and privacy',
      body: 'This is a focused validator for the common YAML subset — block and flow collections, quoted and plain scalars, block scalars, comments and document markers — not a full spec-conformant parser; anchors, aliases, tags and multi-document streams are flagged rather than silently misread. The whole analysis runs in the page with no upload, so a secret-laden config never leaves your device.',
    },
  ],
  faq: [
    {
      q: 'Which YAML features are validated?',
      a: 'Block mappings and sequences with nesting, flow collections ([…] and {…}, including multi-line), plain and single/double-quoted scalars, block scalars (| and >), comments, and document markers (---). Anchors, aliases, tags and multi-document streams are reported as unsupported rather than silently misparsed.',
    },
    {
      q: 'Does "normalize" change the meaning?',
      a: 'No. Values are re-emitted with safe quoting rules, so numbers, booleans and nulls keep their native meaning and strings are quoted only when a plain scalar would be ambiguous. Trailing comments are stripped after values, which is cosmetic.',
    },
    {
      q: 'What makes linting fail?',
      a: 'Tabs used for indentation, unclosed quotes or brackets, duplicate keys inside the same mapping, inconsistent block indentation, and empty input are reported as errors so you can fix the document.',
    },
    {
      q: 'Is this a full YAML parser?',
      a: 'It is a focused validator and normalizer for the common YAML subset described above — enough to catch most real-world mistakes — not a conformance implementation of the whole spec.',
    },
  ],
} as const;
