/**
 * Editorial content for the css-to-js tool page.
 *
 * Kept out of ``css-to-js.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Declaration lists and rule blocks',
      body: 'Paste a bare declaration list such as color: red; font-size: 12px and get one flat object, or paste complete rules and get an object keyed by selector, so a:hover becomes a quoted key whose value is its own style object. The parser tracks quotes and braces, so semicolons inside a quoted value do not split a declaration and an unbalanced brace is reported rather than guessed at.',
    },
    {
      heading: 'Property names for react',
      body: 'With camelCase on, font-size becomes fontSize and background-color becomes backgroundColor, which is the shape React inline styles and most CSS-in-JS libraries expect. Turning it off keeps property names verbatim for frameworks that want kebab-case keys. Custom properties are never camelCased.',
    },
    {
      heading: 'Prefixes and comments',
      body: 'A vendor prefix is capitalised after the dash, so -webkit-transform becomes WebkitTransform, matching the JavaScript property name. Block comments are stripped before parsing, and a declaration with no colon is ignored rather than breaking the output, which keeps a pasted stylesheet resilient to stray text.',
    },
    {
      heading: 'Converted in the page',
      body: 'The stylesheet text is parsed by plain string handling in this tab. Nothing is uploaded, no request is sent to any server, and the resulting object is produced instantly from the bytes you pasted.',
    },
  ],
  faq: [
    {
      q: 'What if my input is a full rule, not a declaration list?',
      a: 'Both work. A rule is converted to a nested object keyed by selector, e.g. a:hover becomes "a:hover": { color: "red" }; a bare declaration list becomes a flat object.',
    },
    {
      q: 'How are vendor prefixes handled?',
      a: '-webkit-transform becomes WebkitTransform (capitalised after the dash) like React expects. CSS custom properties (--accent) are left untouched since they are not camelCased.',
    },
    {
      q: 'Is the output always a single object?',
      a: 'Yes — one flat object for a declaration list, or one object with selectors as keys when rules are given. Value strings are escaped so the output is always valid JS.',
    },
  ],
} as const;
