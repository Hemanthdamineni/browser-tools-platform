/**
 * Editorial content for the code-beautify tool page.
 *
 * Kept out of ``code-beautify.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'One formatter, eleven languages',
      body: 'Paste a snippet and choose a language — JavaScript, TypeScript, CSS, SCSS, Less, HTML, Vue single-file components, JSON, Markdown or YAML — or leave it on auto-detect so the parser is sniffed from the content. The output is the same Prettier style editors and CI pipelines apply, not a bespoke tidy-up of the input.',
    },
    {
      heading: 'When a minified snippet needs reading',
      body: 'The common trigger is code that arrived compressed or mangled: a one-line bundle excerpt, a stylesheet copied out of an email, or a JSON blob lifted from a log. Here it becomes readable text you can inspect and diff before committing it anywhere.',
    },
    {
      heading: 'The options that actually change the text',
      body: 'Line width decides where Prettier wraps and indent width picks spaces per level. The semicolon toggle, the single-quote toggle and the trailing-comma choice apply to JavaScript and TypeScript only, while JSON also honours trailing commas. Markdown and YAML are reflowed by their own rules and ignore the code-style switches.',
    },
    {
      heading: 'The first run downloads one parser',
      body: 'Prettier and each language bundle load on demand, so the first format in a language waits briefly while just that parser and printer arrive; later runs reuse the cache. Source that is invalid for the chosen parser surfaces the Prettier error line instead of a silent guess.',
    },
    {
      heading: 'Your code never leaves the tab',
      body: 'Formatting happens on this device, with the formatter served from this same origin, so nothing you paste is uploaded or stored.',
    },
  ],
  faq: [
    {
      q: 'Does my code leave the browser?',
      a: 'No. Prettier runs entirely in this tab, and the formatter files are downloaded from this same site the first time you use them.',
    },
    {
      q: 'Why did the first run take a moment?',
      a: 'The formatter is only downloaded when you first use it, and only the parsers for the language you picked. Later runs reuse what is already loaded.',
    },
    {
      q: 'What does Auto-detect do?',
      a: 'It reads the input and picks the most likely language — for example JSON for a JSON object, or TypeScript when it sees type annotations. If it cannot tell, it asks you to choose a language.',
    },
    {
      q: 'The output is wrapped differently from what I expected.',
      a: 'Prettier is opinionated. Line width, indent width, quotes and semicolons are the knobs it exposes; nearly everything else is fixed.',
    },
  ],
} as const;
