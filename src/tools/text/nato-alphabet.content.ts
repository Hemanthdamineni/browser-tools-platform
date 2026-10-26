/**
 * Editorial content for the nato-alphabet tool page.
 *
 * Kept out of ``nato-alphabet.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Why a spelling alphabet exists',
      body: 'Over a noisy radio link, or a bad phone line, "B" and "D" and "P" are indistinguishable. The NATO phonetic alphabet replaces every letter with a distinct word — Alpha for A, Bravo for B through Zulu for Z — so a code read aloud is unambiguous. This tool converts both ways.',
    },
    {
      heading: 'What happens to digits and punctuation',
      body: 'Digits map to their English names as separate tokens, so N73 becomes November Seven Three. Characters outside A–Z and 0–9 are passed through as their own token rather than dropped, which keeps hyphens and slashes visible so nothing is silently lost. Text is read one character at a time, so the source case does not matter.',
    },
    {
      heading: 'Decoding and unknown words',
      body: 'In decode mode the input is split on spaces, commas and semicolons, and each recognised word maps back to its letter or digit. A single-character token is kept as itself, since it is meaningful punctuation. A word that is not in the alphabet is preserved in square brackets, so a typo shows up instead of vanishing.',
    },
    {
      heading: 'Separation and case options',
      body: 'The separator option — space, new line or comma plus space — controls how the encoded words are laid out, useful when you want one word per line to read down a list. The uppercase toggle renders the phonetic words in block capitals. Both options apply to encoding only; decoding always splits on the same separators.',
    },
    {
      heading: 'Computed in your browser',
      body: 'Encoding and decoding are a table lookup in this tab, with a 100,000-character ceiling so a huge paste cannot stall the page. A customer name or a tracking number is never sent anywhere — the tool works offline.',
    },
  ],
  faq: [
    {
      q: 'What is the NATO phonetic alphabet?',
      a: 'The spelling alphabet used in radio and aviation: A=Alpha, B=Bravo, C=Charlie, and so on through Z=Zulu. Each letter has a distinct word so letters cannot be confused over a noisy channel.',
    },
    {
      q: 'How are digits handled?',
      a: 'Digits map to their English names — 0=Zero, 1=One … 9=Nine — and are emitted as separate tokens, so "N73" becomes "November Seven Three". Punctuation such as hyphens or slashes is passed through as its own token so nothing is lost.',
    },
    {
      q: 'How does decoding work?',
      a: 'Paste words like "Alpha Bravo" and each recognised word maps back to its letter; unknown words are preserved in brackets so nothing is silently lost.',
    },
  ],
} as const;
