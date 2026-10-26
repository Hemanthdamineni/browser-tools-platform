/**
 * Editorial content for the css-variables-extractor tool page.
 *
 * Kept out of ``css-variables-extractor.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Every custom property, with the scope that declared it',
      body: 'Paste a stylesheet and the tool walks it block by block, recording each --name: value declaration together with the selector that declared it. The default Table output has three columns — Variable, Value and Scope — and the notes summarise how many declarations, unique variables and scopes were found.',
    },
    {
      heading: 'Taking the tokens out of CSS you inherited',
      body: 'This is the tool for adopting a theme you did not write: feed in the compiled CSS and get a complete inventory of its design tokens, which selector holds the base value and which selector overrides it. It is just as useful for checking that a dark theme really redeclares everything the light theme defines.',
    },
    {
      heading: 'The output format decides the shape',
      body: 'Table lists one row per declaration. JSON flattens each variable to its value, or to an array of value-and-scope objects where a name repeats. JavaScript wraps the same object in an export. SCSS turns each variable into a $variable, which collapses overrides to the last value. Group duplicate declarations controls whether repeats are grouped.',
    },
    {
      heading: 'Limits and gotchas',
      body: 'CSS comments are stripped before parsing; Keep comments only adds a count annotation to SCSS lines for variables declared more than once. Input beyond 500,000 characters is refused, and a stylesheet with no custom properties is an error rather than an empty table. The SCSS export cannot express per-scope overrides, because SCSS variables are global.',
    },
    {
      heading: 'Parsed in the browser',
      body: "The stylesheet is read and parsed inside this tab and never uploaded, which matters when the CSS comes from a client's unpublished design system. Nothing about your tokens leaves the page.",
    },
  ],
  faq: [
    {
      q: 'What does "scope" mean?',
      a: 'The selector that declared the variable — :root for globals, .theme-dark for a theme override, or the enclosing @media/@supports block. Seeing the scope explains where an override takes effect.',
    },
    {
      q: 'How are duplicates handled?',
      a: 'The same variable declared in several scopes is grouped, listing every scope and value in order, so override chains are obvious. Turn grouping off to see one row per declaration.',
    },
    {
      q: 'Which formats can I export?',
      a: 'A table, a flat JSON object, a JavaScript object, or SCSS $variables. The JSON/JS forms are handy for feeding tokens into a design system.',
    },
  ],
} as const;
