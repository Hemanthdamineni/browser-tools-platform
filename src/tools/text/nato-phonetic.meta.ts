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
  article: [
    {
      heading: 'Letters, digits and everything else',
      body: 'Each letter becomes its ICAO word — Alfa, Bravo, Charlie through Zulu — and each digit becomes its spoken form, Zero through Eight with Niner for 9. Outgoing text is uppercased before lookup, so sos and SoS both give Sierra Oscar Sierra. Whitespace is dropped, and any other character is emitted as its own token, so B-52 becomes Bravo, a hyphen, Five, Two.',
    },
    {
      heading: 'Reading a list of words back into text',
      body: 'Phonetic to Text splits on whitespace and looks each token up case-insensitively, so alpha bravo reads back as the same letters as Alfa Bravo. Matched tokens are concatenated with no separator, and an unrecognised token is kept verbatim, which is why punctuation survives a round trip. If no token matches, the tool raises an error instead of returning an empty string.',
    },
    {
      heading: 'When spelling a word out loud matters',
      body: 'This is for the moments when one ambiguous letter ruins a message: reading a confirmation code to a support agent, dictating a licence plate over the phone, or passing a short identifier across a noisy radio channel. Letters like B, D, P and V blur together in speech, which is exactly what the alphabet solves.',
    },
    {
      heading: 'Runs entirely on this device',
      body: 'Both directions are plain table lookups in this tab, so nothing you paste is transmitted and the tool keeps working offline. An unusual character passes through unchanged rather than being guessed at.',
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
    {
      q: 'Is the match case-sensitive?',
      a: 'No. Outgoing text is uppercased before lookup, so lowercase input produces the same words, and the reverse pass matches phonetic words case-insensitively as well.',
    },
  ],
  related: ['morse-code', 'rot13', 'case-convert', 'slugify'],
  status: 'stable',
};
