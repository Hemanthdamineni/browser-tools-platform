/**
 * Editorial content for the rot13 tool page.
 *
 * Kept out of ``rot13.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What each variant rotates',
      body: 'ROT13 shifts A–Z and a–z by thirteen places, leaving case intact; ROT5 shifts the digits 0–9 by five; ROT18 does both. ROT47 rotates every printable ASCII character from "!" (33) through "~" (126) by forty-seven positions, which means punctuation moves too. Caesar takes a shift you choose from 1 to 25 and applies it to letters only, so the classic "+3" cipher is available exactly as textbooks describe it.',
    },
    {
      heading: 'Why ROT13 is its own inverse',
      body: 'Thirteen is half of twenty-six, so applying ROT13 twice returns the original text — there is no separate encrypt and decrypt mode. ROT5 and ROT18 are self-inverse for the same reason, and ROT47 is self-inverse because the printable range has an even size and forty-seven is half of ninety-four. A Caesar shift of n is undone by a shift of 26 − n.',
    },
    {
      heading: 'A concrete use',
      body: 'ROT13 is a long-standing convention for hiding a spoiler, a punchline or an answer in a forum or an email without really securing it — the reader consciously decodes it, which is the whole point. Caesar shifts are handy for quick classroom demonstrations of substitution ciphers and for puzzles that expect one specific shift.',
    },
    {
      heading: 'Limits and privacy',
      body: 'These are toy ciphers: anyone who recognises them reverses them instantly, so never use them on anything that needs actual confidentiality. Characters outside the chosen set — spaces, non-ASCII letters, emoji — pass through untouched, and the stats line reports the character count and the variant used. The rotation happens in the page with no upload, so pasted text stays on your device.',
    },
  ],
  faq: [
    {
      q: 'How do I decrypt the result?',
      a: 'ROT13 and ROT47 are their own inverse — run the tool again with the same variant to get the original text back. ROT5 and ROT18 are also self-inverse for their character sets. A Caesar shift of n is undone by a shift of 26 − n.',
    },
    {
      q: 'Which characters are changed?',
      a: 'ROT13 and Caesar touch A–Z/a–z only, ROT5 touches 0–9 only, ROT18 touches both, and ROT47 touches every printable ASCII character from "!" (33) to "~" (126). Everything else, including spaces and non-ASCII letters, is left untouched.',
    },
    {
      q: 'Is ROT13 secure encryption?',
      a: 'No. It is a substitution cipher that anyone who recognises it reverses instantly — it hides text from a casual glance, such as a spoiler, not from an attacker. Never use it for anything that needs real confidentiality.',
    },
  ],
} as const;
