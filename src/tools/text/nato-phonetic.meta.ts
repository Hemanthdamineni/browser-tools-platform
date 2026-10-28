import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'nato-phonetic',
  name: 'NATO Phonetic Alphabet',
  category: 'text',
  summary: 'Spell text with the NATO/ICAO phonetic alphabet (Alfa, Bravo, Charlie…) and back.',
  description:
    'Convert each letter to its NATO phonetic word and each digit to its spoken form (Niner for 9), or read a list of phonetic words back into plain text. Unrecognised characters are passed through unchanged.',
  keywords: [
    'nato phonetic alphabet',
    'icao spelling alphabet',
    'phonetic alphabet',
    'alfa bravo charlie',
    'radio alphabet',
    'spelling alphabet',
    'military alphabet',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'text-to-phonetic',
      choices: [
        { value: 'text-to-phonetic', label: 'Text → Phonetic' },
        { value: 'phonetic-to-text', label: 'Phonetic → Text' },
      ],
    },
  ],
  examples: [
    { title: 'Spell "SOS"', input: 'SOS', options: { mode: 'text-to-phonetic' } },
    { title: 'Spell "AB12"', input: 'AB12', options: { mode: 'text-to-phonetic' } },
    {
      title: 'Read back',
      input: 'Sierra Oscar Sierra',
      options: { mode: 'phonetic-to-text' },
    },
  ],
  faq: [
    {
      q: 'Which words does it use?',
      a: 'The ICAO/NATO set: Alfa, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliett, Kilo, Lima, Mike, November, Oscar, Papa, Quebec, Romeo, Sierra, Tango, Uniform, Victor, Whiskey, X-ray, Yankee, Zulu, plus Zero–Niner for digits.',
    },
    {
      q: 'What happens to spaces and punctuation?',
      a: 'Spaces are dropped and any other character (a hyphen, comma, symbol) is emitted as its own token. On the reverse pass, a token that is not a phonetic word is kept verbatim, so punctuation survives a round trip.',
    },
  ],
  related: [  "morse-code",
  "rot13",
  "case-convert",
  "slugify"],
  status: 'stable',
};
