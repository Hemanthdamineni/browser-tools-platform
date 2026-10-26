/**
 * Editorial content for the querystring tool page.
 *
 * Kept out of ``querystring.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Parse or build from the same box',
      body: 'In parse mode the box takes a query string, with or without a leading ? or #, and returns a pretty JSON object of the parameters. In build mode it takes a JSON object and returns the encoded query string without the ?. Both directions honour the array-format and sort-keys options.',
    },
    {
      heading: 'How repeated keys become arrays',
      body: 'A key appearing more than once becomes a JSON array whatever the format. With brackets, tag[]=a&tag[]=b is always an array and the [] is stripped from the key; with comma, a value containing commas is split into members; repeat is the plain key=a&key=b shape.',
    },
    {
      heading: 'Decoding and encoding rules',
      body: 'Parsing percent-decodes every key and value and treats + as a space, and a stray % that is not a valid escape raises a clear error. Building re-encodes with encodeURIComponent, so spaces become %20 and brackets become %5B%5D in the brackets format.',
    },
    {
      heading: 'Caveats and privacy',
      body: 'Sort keys orders only the top level alphabetically, arrays keep their order, and a nested object value is serialised with JSON.stringify into a single parameter rather than flattened. Nothing is fetched; the parser only reads your text, so query strings carrying tokens or personal data stay on your device.',
    },
  ],
  faq: [
    {
      q: 'How are repeated keys handled?',
      a: 'Any key that appears more than once becomes an array. With the brackets format a key ending in [] is always an array; with the comma format a value containing commas is split.',
    },
    {
      q: 'Is the input URL-decoded?',
      a: 'Yes. Keys and values are percent-decoded and + is treated as a space when parsing, and re-encoded when building.',
    },
    {
      q: 'Can I paste a whole URL?',
      a: 'Only the query part is parsed. Paste everything from the ? onwards, or strip the scheme, host and path first, because the tool looks for & and = pairs rather than splitting a full URL.',
    },
  ],
} as const;
