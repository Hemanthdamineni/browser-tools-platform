/**
 * Editorial content for the json-format tool page.
 *
 * Kept out of ``json-format.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Four jobs in one box',
      body: 'Pretty-print re-emits your JSON with 2 spaces, 4 spaces or a tab. Minify collapses it to a single line with no unnecessary whitespace. Sort keys walks the whole tree — nested objects included — and writes object keys in ascending order, which makes diffs between two versions stable. Validate only checks the text and reports the top-level value type and how many keys or elements it has, without rewriting anything.',
    },
    {
      heading: 'Errors you can actually act on',
      body: 'When parsing fails the raw message is shown, and where a position can be pulled out of it the tool adds a translated hint such as “at line 12, column 9”. That turns the usual opaque “Unexpected token” into a pointer at the offending line, which is what you want for a config file that was hand-edited.',
    },
    {
      heading: 'Know the number caveat',
      body: 'Values pass through JSON.parse and JSON.stringify, so a full round trip is loss-free for structure but not for every literal: integers beyond 2^53 lose precision, and the exact spelling of a number (1.0, 1e3, very long decimals) can be normalised. If exact big-integer fidelity matters, treat the output as a reformatted view rather than a byte-exact transform.',
    },
    {
      heading: 'Privacy',
      body: 'The text never leaves the tab: parsing and re-serialising use the browser’s own JSON functions with no request, no telemetry and no upload, so a pasted payload or config stays on your device and the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'How are syntax errors reported?',
      a: 'The raw parser message is shown, and where a position can be extracted it is translated into "at line L, column C" as a hint.',
    },
    {
      q: 'Does it preserve large integers exactly?',
      a: 'No. Values pass through JSON.parse, so integers beyond 2^53 and the exact spelling of numbers can change. Formatting is otherwise loss-free.',
    },
    {
      q: 'What does "Validate only" report?',
      a: 'It confirms the text is valid JSON and notes the top-level value type plus how many keys or elements it has.',
    },
  ],
} as const;
