import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'rot13',
  name: 'ROT13 / Caesar Cipher',
  category: 'text',
  summary: 'Apply ROT13, ROT5, ROT18, ROT47 or an arbitrary Caesar shift to text.',
  description:
    'A family of simple substitution ciphers. ROT13 rotates letters, ROT5 rotates digits, ROT18 does both, ROT47 rotates printable ASCII, and Caesar shifts letters by any amount from 1 to 25.',
  keywords: [
    'rot13',
    'rot5',
    'rot18',
    'rot47',
    'caesar cipher',
    'caesar shift',
    'substitution cipher',
    'letter rotation',
    'encode',
    'decode',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'variant',
      label: 'Variant',
      type: 'select',
      default: 'rot13',
      choices: [
        { value: 'rot13', label: 'ROT13 (letters)' },
        { value: 'rot5', label: 'ROT5 (digits)' },
        { value: 'rot18', label: 'ROT18 (letters + digits)' },
        { value: 'rot47', label: 'ROT47 (printable ASCII)' },
        { value: 'caesar', label: 'Caesar (custom shift)' },
      ],
    },
    {
      key: 'shift',
      label: 'Caesar shift (1–25)',
      type: 'number',
      default: 3,
      min: 1,
      max: 25,
      step: 1,
      showWhen: { key: 'variant', value: 'caesar' },
    },
  ],
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
  examples: [
    { title: 'ROT13 "Hello"', input: 'Hello', options: { variant: 'rot13' } },
    { title: 'ROT47 "Hello"', input: 'Hello', options: { variant: 'rot47' } },
    { title: 'Caesar +3 on "abc XYZ"', input: 'abc XYZ', options: { variant: 'caesar', shift: 3 } },
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
  related: ['case-convert', 'reverse-text', 'morse-code', 'nato-phonetic'],
  status: 'stable',
};
