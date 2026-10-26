/**
 * Editorial content for the objectid tool page.
 *
 * Kept out of ``objectid.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The 12 bytes behind every ObjectId',
      body: 'A MongoDB ObjectId is 24 hexadecimal characters that decode to 12 bytes. In decode mode the tool splits them: the first four bytes are a big-endian Unix timestamp in seconds, the next five are a random value fixed per process, and the final three are an incrementing counter. You get the creation time as an ISO string and a Unix value, plus each section in hex and the counter in decimal.',
    },
    {
      heading: 'Reading a creation time',
      body: 'The timestamp is the whole reason the format is useful for diagnostics: paste an _id from a document and you immediately know when that document was created, to the second, without a query. That is often enough to correlate a record with a deploy, a batch job or an incident window.',
    },
    {
      heading: 'Generating a fresh id',
      body: 'Switch to generate mode and the tool builds a new, structurally valid ObjectId from the current second: the timestamp bytes come from the clock and the remaining bytes from crypto.getRandomValues. It has the same layout a driver would produce and a correct timestamp, but the random and counter bytes are freshly drawn rather than derived from a persistent per-process seed.',
    },
    {
      heading: 'Validation and privacy',
      body: 'Decode requires exactly 24 characters and only 0-9 and a-f, and reports the length it got when that fails — so a truncated id copied out of a log is caught immediately. Nothing is looked up: both decode and generate run in the page with no database and no network, so an id from a private cluster stays on your device.',
    },
  ],
  faq: [
    {
      q: 'What do the 12 bytes mean?',
      a: 'Bytes 0-3 are a big-endian Unix timestamp in seconds, bytes 4-8 are a random value fixed per process, and bytes 9-11 are a counter that increments for each id.',
    },
    {
      q: 'Is the generated id the same as the MongoDB driver would make?',
      a: 'It has the same structure and a valid timestamp. The random and counter bytes come from crypto.getRandomValues rather than a persistent per-process seed.',
    },
    {
      q: 'What happens if I paste a truncated id?',
      a: 'Decode requires exactly 24 hex characters, so anything shorter or longer is refused with the length it received — handy for catching an id cut short when copied from a log.',
    },
  ],
} as const;
