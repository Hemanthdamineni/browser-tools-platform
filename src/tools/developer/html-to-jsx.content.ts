/**
 * Editorial content for the html-to-jsx tool page.
 *
 * Kept out of ``html-to-jsx.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'HTML in, JSX out',
      body: 'Paste a static HTML snippet and get JSX for a React component body. Attribute names are mapped to their React spelling (class to className, for to htmlFor, tabindex to tabIndex and so on), void elements such as img, input, br and hr are self-closed, HTML comments become {/* ... */} and the tree is indented with two spaces.',
    },
    {
      heading: 'When you are porting a static page',
      body: 'Use it when a design hand-off arrives as HTML, when you are lifting markup out of a template or a CMS export into a component, or when you want to confirm a snippet is valid JSX before committing it. It is deliberately a converter rather than a framework: it never invents props, state or event handlers.',
    },
    {
      heading: 'The two options',
      body: 'Wrap multiple roots in a fragment encloses several top-level elements in <>...</> so the result is a legal component body instead of invalid sibling markup. Keep comments decides whether HTML comments survive as JSX comment expressions or are dropped, which is handy when comment blocks are template noise rather than documentation.',
    },
    {
      heading: 'What it deliberately will not do',
      body: 'Inline style strings are carried through unchanged, because turning CSS text into a React style object needs a full CSS parser. Attribute values stay plain strings, and a value containing a double quote is wrapped in a JS expression so the JSX stays valid. Unbalanced markup is reported rather than guessed at.',
    },
    {
      heading: 'Nothing leaves the page',
      body: 'The parse and render run in your browser and the snippet is never uploaded. Client markup, internal templates and half-finished components can all be converted without a network connection.',
    },
  ],
  faq: [
    {
      q: 'Does it convert CSS style strings to style objects?',
      a: 'No. inline style="…" strings are carried through unchanged as strings. Converting to React style objects would need a CSS parser and is out of scope for a markup converter.',
    },
    {
      q: 'Why are void elements self-closed?',
      a: 'JSX requires every element to have a closing form, so img, input, br, hr, meta, link and friends are emitted as <img />, <input /> etc. HTML attributes are otherwise passed through.',
    },
    {
      q: 'What about attributes I add later with expressions?',
      a: 'Static input produces static JSX. You can replace any attribute value with an expression afterwards; the converter keeps values as plain strings so nothing is guessed.',
    },
    {
      q: 'Can it handle multiple root elements?',
      a: 'Yes — with "Wrap multiple roots" enabled, several top-level elements are wrapped in a JSX fragment so the output is a valid component body.',
    },
  ],
} as const;
