/**
 * Editorial content for the content-type tool page.
 *
 * Kept out of ``content-type.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Building a header from parts',
      body: 'Build mode joins a media type with an optional charset and boundary. The type must use type/subtype syntax, and a boundary is limited to 70 characters with no quotes, semicolons or line breaks. Multipart types are refused outright when no boundary is supplied.',
    },
    {
      heading: 'Parsing one header or many',
      body: 'Parse mode accepts one Content-Type per line and returns a table of the media type, every parameter and its value, plus any issues. Pasting several lines at once makes it easy to compare what different endpoints really send.',
    },
    {
      heading: 'What counts as a problem',
      body: 'A line without type/subtype syntax is marked invalid. Duplicate parameters, a charset containing non-token characters, and a multipart value missing its boundary are flagged for review instead of being quietly accepted.',
    },
    {
      heading: 'Where the scope ends',
      body: 'The header text is all the tool can see. It cannot confirm whether a body was really encoded as the charset claims, and it does not decode, inspect or validate the payload the header describes.',
    },
    {
      heading: 'Parsed on your device',
      body: 'Values are read and assembled in the browser. Nothing is uploaded, no request is made, and the page runs offline.',
    },
  ],
  faq: [
    {
      q: 'Should JSON include a charset?',
      a: 'UTF-8 is the standard encoding for JSON, and many APIs send application/json without a charset. Either form is commonly accepted.',
    },
    {
      q: 'Why does multipart need a boundary?',
      a: 'The boundary separates parts in the body. The server must use the same boundary value in the body delimiters.',
    },
    {
      q: 'Does this inspect the body encoding?',
      a: 'No. It only parses or builds the header value and cannot infer how an external body was actually encoded.',
    },
  ],
} as const;
