/**
 * Editorial content for the markdown-toc tool page.
 *
 * Kept out of ``markdown-toc.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The outline it builds',
      body: 'Paste Markdown and the tool walks its lines for ATX headings, one to six hashes before a space, and builds a nested outline using the level of each heading. Fenced code blocks are skipped so sample files full of hashtags stay out. The output is returned as plain text you can paste into a README.',
    },
    {
      heading: 'Anchor slugs',
      body: 'Links follow the GitHub convention: lowercase, keep letters digits underscores and hyphens, drop other punctuation, and turn whitespace into single hyphens. An explicit custom target at the end of a heading overrides the slug and is dropped from the link text.',
    },
    {
      heading: 'Three output formats',
      body: 'GitHub emits bullet links such as - [Title](#slug). Plain indents each heading title by two spaces per level. HTML wraps every entry in a nested unordered list with anchors, escaping ampersands and angle brackets in the titles.',
    },
    {
      heading: 'Depth and when to use it',
      body: 'The depth option caps how deep the outline goes, from 1 to 6, defaulting to all levels. Most READMEs link h1 to h3, so trimming the depth keeps implementation notes out of navigation. Generation runs locally and your document is never uploaded.',
    },
  ],
  faq: [
    {
      q: 'Which heading syntax is supported?',
      a: 'ATX headings: a line starting with 1–6 # characters followed by a space (or a #-only line is treated as empty and skipped). Setext underlines are not expanded; if your document uses them, convert the top-level titles to # first.',
    },
    {
      q: 'How are the anchors generated?',
      a: 'With the GitHub convention: lowercase, keep letters/digits/underscores/hyphens, drop punctuation, turn whitespace into single hyphens. An explicit {#custom} at the end of a heading overrides the slug and is removed from the link text.',
    },
    {
      q: 'Are code blocks ignored?',
      a: 'Yes. Headings inside fenced code blocks (``` on both sides) are not included, so example documents that show hashtags stay out of the outline.',
    },
    {
      q: 'Should tables of contents be limited by depth?',
      a: 'Most READMEs link h1–h3. The depth option lets you cap how deep the outline goes — useful when h4+ headings are implementation notes you do not want to navigate.',
    },
  ],
} as const;
