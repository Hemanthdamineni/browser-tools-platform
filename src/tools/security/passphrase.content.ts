/**
 * Editorial content for the passphrase tool page.
 *
 * Kept out of ``passphrase.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A passphrase instead of a password',
      body: 'The tool draws a random set of words from a built-in list of short, common English words and joins them with the separator you choose, so you get something like "wren-veil-glint-amber-plot" rather than a 12-character password you cannot pronounce. The word count, from 3 to 12, sets the length.',
    },
    {
      heading: 'The entropy numbers',
      body: 'The embedded list holds 1110 words, about 10.1 bits of entropy per word, so the default five words come to roughly 51 bits and the maximum twelve reach about 121 bits. Every word is picked with crypto.getRandomValues and rejection sampling, so there is no modulo bias. The reported bit count lets you judge whether a phrase is strong enough for the account.',
    },
    {
      heading: 'Tuning the shape',
      body: 'Choose hyphens, spaces, dots, underscores or no separator at all to match the site’s rules — some forms reject spaces or special characters. Capitalising every word and appending a random 0–999 number each add a little strength, but a number only adds about ten bits and hurts memorability, so adding one more word is the better way to raise entropy.',
    },
    {
      heading: 'When to rely on it',
      body: 'This is for accounts where you can paste a long phrase — a password manager, an email, a machine login. The short embedded word list stays inoffensive and pronounceable, which is the point of Diceware-style phrases: memorable enough to type by hand and strong enough that a dictionary attack on the words has no leverage.',
    },
  ],
  faq: [
    {
      q: 'How big is the built-in word list?',
      a: 'It holds 1110 short, common, inoffensive English words (3–7 letters), which is about 10.1 bits of entropy per word — a 5-word passphrase is roughly 51 bits.',
    },
    {
      q: 'Would a larger list be stronger?',
      a: 'Yes. The EFF long Diceware list has 7776 words, giving about 12.9 bits per word, so the same number of words yields more entropy. The list here is kept small so it can be embedded and works fully offline.',
    },
    {
      q: 'Does the appended number add much?',
      a: 'Only about 10 bits, and it hurts memorability. Adding one more word is a better way to raise entropy.',
    },
  ],
} as const;
