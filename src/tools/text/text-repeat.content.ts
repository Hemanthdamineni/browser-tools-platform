/**
 * Editorial content for the text-repeat tool page.
 *
 * Kept out of ``text-repeat.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What Repeat Text produces',
      body: 'Repeat Text writes a piece of text out a chosen number of times, joined by a separator you pick. You set a copy count from 1 to 100000, and the separator goes between copies only, never at the start or the end. The result also reports the copy count and the total character length.',
    },
    {
      heading: 'When a repeated string saves time',
      body: 'Reach for it for repeated test data, a filled placeholder, N identical lines for a file you are about to generate, or a comma-joined series of the same value built in one step instead of typed out by hand.',
    },
    {
      heading: 'Choosing the copy count and separator',
      body: 'Count sets how many copies appear and is clamped to 100000 even if a larger number is typed. Separator offers newline, space, comma, none, or custom; custom reveals a text field whose literal string is inserted verbatim, so multi-character joins like " | " work.',
    },
    {
      heading: 'The five-million-character ceiling',
      body: 'The result is capped at five million characters. The tool predicts the length before building it and refuses with a clear message if that passes the limit. Counts below 1 are rejected, and an empty input simply gives an empty output.',
    },
    {
      heading: 'Where the text is processed',
      body: 'Everything happens on your device. The text is repeated in memory in the browser, no part of it is sent to a server, and the tool works offline with no network requests.',
    },
  ],
  faq: [
    {
      q: 'Is there a size limit?',
      a: 'Yes — the output is capped at 5,000,000 characters. If you exceed it, reduce the number of copies.',
    },
    {
      q: 'Can the separator be more than one character?',
      a: 'Yes. Choose "Custom…" and type any literal string, including spaces. It is inserted verbatim between copies, not before the first or after the last.',
    },
    {
      q: 'What happens with an empty input?',
      a: 'The output is empty. There is nothing to repeat, so the result is an empty string regardless of the count.',
    },
  ],
} as const;
