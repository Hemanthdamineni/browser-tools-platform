/**
 * Editorial content for the http-range tool page.
 *
 * Kept out of ``http-range.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The three range headers',
      body: 'A client asks for part of a representation with Range, a server answers 206 with Content-Range describing the slice it sent, and Accept-Ranges advertises that the resource supports byte serving at all. Build mode generates any of those values from numeric start, end and size fields, and parse mode reads pasted range values against a known representation size.',
    },
    {
      heading: 'Byte positions are inclusive',
      body: 'The end byte counts as part of the range, so bytes=0-999 asks for one thousand bytes, not nine hundred and ninety-nine. The builder enforces that the end is not before the start, and the parser reports a range that begins at or past the representation size as unsatisfiable.',
    },
    {
      heading: 'Suffix ranges and open ends',
      body: 'A value like bytes=-500 means the final five hundred bytes. When a representation size is supplied, the parser resolves that suffix to a concrete start and end and can warn when the suffix is larger than the whole resource, which simply yields the entire representation.',
    },
    {
      heading: 'No resource is fetched',
      body: 'Every value is parsed and produced as header text inside this page. The tool never requests a URL or inspects a file, so it makes no network calls and keeps your pasted values on your device.',
    },
  ],
  faq: [
    {
      q: 'Are range ends inclusive?',
      a: 'Yes. bytes=0-99 requests the first 100 bytes. Content-Range uses the same inclusive start-end form.',
    },
    {
      q: 'What is a suffix range?',
      a: 'bytes=-500 requests the final 500 bytes. The parser can assess it when a representation size is provided.',
    },
    {
      q: 'Does this download or inspect a resource?',
      a: 'No. It only parses and generates header text locally.',
    },
  ],
} as const;
