import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'morse-code',
  name: 'Morse Code Translator',
  category: 'text',
  summary: 'Translate text to International Morse code and back, tolerant of messy spacing.',
  description:
    'Encode letters, digits and common punctuation to International Morse code, or decode a Morse string back to text. Letters are separated by a space and words by " / "; decoding also accepts "|" as a word separator and forgives extra spaces.',
  keywords: [
    'morse code',
    'morse',
    'international morse',
    'dot dash',
    'dits and dahs',
    'telegraph',
    'encode',
    'decode',
    'translator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'text-to-morse',
      choices: [
        { value: 'text-to-morse', label: 'Text → Morse' },
        { value: 'morse-to-text', label: 'Morse → Text' },
      ],
    },
  ],
  examples: [
    { title: 'Encode "SOS"', input: 'SOS', options: { mode: 'text-to-morse' } },
    { title: 'Encode a phrase', input: 'Hello World', options: { mode: 'text-to-morse' } },
    {
      title: 'Decode',
      input: '.... . .-.. .-.. --- / .-- --- .-. .-.. -..',
      options: { mode: 'morse-to-text' },
    },
    {
      title: 'Decode a punctuated phrase',
      input: '... --- ...',
      options: { mode: 'morse-to-text' },
    },
  ],
  article: [
    {
      heading: 'Encoding text to International Morse',
      body: 'Every letter, digit and common punctuation mark in the Morse table is mapped to its dot-and-dash code, with letters joined by a single space and words by the sequence " / ". The box is uppercased first, so a mixed-case sentence encodes cleanly, and an unsupported character \u2014 an accented letter, a symbol, an emoji \u2014 is replaced with "?" and named in a warning rather than dropped silently. The output is emitted as a copy-pasteable code string with a word count in the stats.',
    },
    {
      heading: 'Decoding is deliberately forgiving about spacing',
      body: 'On the way back, runs of whitespace are collapsed, and either "/" or "|" \u2014 with or without surrounding spaces \u2014 is treated as a word separator. Every other run of whitespace just separates letters, so a string typed with too many spaces decodes the same as one typed neatly. An unrecognised dot-and-dash group, though, raises an error rather than being guessed, because silently mangling one symbol would corrupt the whole message.',
    },
    {
      heading: 'When it is useful',
      body: 'Morse code is mostly a curiosity today, but the tool is genuinely handy for decoding a Morse snippet from a puzzle, a radio hobbyist\u2019s log or a historical document, and for encoding a short text to test a transmitter or a signal lamp. It handles the full International set, not a US-only or Latin-subset table, so it is the right reference for a genuine message rather than a toy alphabet.',
    },
    {
      heading: 'Limitations',
      body: 'Only the characters in the International Morse table are covered \u2014 there is no provision for prosigns, K, AR or other procedural abbreviations, and accented letters are not in the set so they come back as "?" with a warning. Only one text value is converted per run; there is no audio or light output, so the flashing or beeping is left to whatever hardware you connect.',
    },
    {
      heading: 'Everything is local',
      body: 'The Morse table and both directions of conversion live in this page. Nothing is sent to a server and nothing is stored, so a message you would rather not share is handled entirely on your device.',
    },
  ],
  faq: [
    {
      q: 'Which characters are supported?',
      a: 'A–Z, 0–9 and the common punctuation marks . , ? \' ! / ( ) & : ; = + - _ " $ @. Case is ignored. On encoding, any unsupported character becomes "?" and is listed in a warning.',
    },
    {
      q: 'How forgiving is decoding?',
      a: 'Runs of whitespace are collapsed, and both "/" and "|" (with or without surrounding spaces) are treated as word separators. An unrecognised dot/dash group raises an error rather than being dropped silently.',
    },
  ],
  related: ['nato-phonetic', 'rot13', 'text-to-binary', 'case-convert'],
  status: 'stable',
};
