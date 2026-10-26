/**
 * Editorial content for the html-to-pug tool page.
 *
 * Kept out of ``html-to-pug.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Paste HTML and get the equivalent Pug template. Elements become indented selectors, id and class attributes collapse into #id and .class shorthand, other attributes keep their values, void elements stay self-contained, comments carry over as //-, and script or style bodies become raw text blocks. The result renders as Pug source, and the notes say how many elements were converted.',
    },
    {
      heading: 'When to use it',
      body: 'Reach for it when porting a static page into a Pug view layer. Rebuilding a finished page by hand inside an Express app is slow and easy to get wrong, and this keeps the nesting and shorthand selectors faithful.',
    },
    {
      heading: 'The options',
      body: 'indentWidth sets the leading spaces from 2 to 8, quoteStyle switches attribute quoting between double and single, keepComments decides whether HTML comments survive as Pug comments, and inlineText controls whether an element with one text child keeps that text on the same line or moves it to a | line.',
    },
    {
      heading: 'Caveats',
      body: 'Some markup has no exact Pug form, such as an element with both leading and trailing text siblings. Those cases still yield valid Pug with the text placed on separate | lines, and a warning appears in the notes. Input over 500,000 characters is refused, and a snippet containing no elements cannot be converted.',
    },
    {
      heading: 'Privacy',
      body: 'Parsing and emitting are ordinary browser code, so your markup never leaves the tab and the page works with no connection. That matters when the HTML holds unpublished copy or internal URLs.',
    },
  ],
  faq: [
    {
      q: 'What happens to class and id attributes?',
      a: 'They become Pug shorthand: class="a b" turns into .a.b and id="x" becomes #x. A div with only classes or an id drops the tag name entirely, as in .card or #title.',
    },
    {
      q: 'How are script and style tags handled?',
      a: 'Their contents are emitted as raw text blocks using the trailing dot form (script. / style.), so JavaScript and CSS are not treated as markup or re-indented as Pug.',
    },
    {
      q: 'When is the output not exactly equivalent?',
      a: 'Pug cannot represent some HTML directly — for example an element with both leading and trailing text siblings, or mixed inline/block content in one line. Those cases still produce valid Pug, with the text moved to separate | lines and a warning listed in the notes.',
    },
  ],
} as const;
