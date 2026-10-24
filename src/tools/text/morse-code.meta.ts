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
      body: 'Every letter, digit and common punctuation mark maps to its dot-and-dash code, with letters joined by a space and words by the sequence " / ". The box is uppercased first, and an unsupported character \u2014 an accented letter, a symbol, an emoji \u2014 becomes "?" and is named in a warning rather than dropped silently.',
    },
    {
      heading: 'Decoding is forgiving about spacing',
      body: 'Runs of whitespace collapse, and "/" or "|" with or without surrounding spaces is treated as a word separator, while every other run of whitespace just separates letters, so a string typed with extra spaces decodes the same as a neat one. An unrecognised dot-and-dash group, though, raises an error rather than being guessed, since mangling one symbol would corrupt the message.',
    },
    {
      heading: 'When it is useful',
      body: 'Morse is mostly a curiosity today, but the tool genuinely decodes a snippet from a puzzle, a radio hobbyist\u2019s log or a historical document, and encodes short text to test a transmitter or a signal lamp. It covers the full International set rather than a Latin-only toy alphabet, so it serves a real message.',
    },
    {
      heading: 'Limitations, and where it runs',
      body: 'There is no provision for prosigns or other procedural abbreviations, so an accented letter comes back as "?" with a warning, and there is no audio or light output, leaving the flashing or beeping to whatever hardware you connect. The Morse table and both directions live in this page, so a message stays on your device.',
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
    {
      q: 'What happens to characters Morse cannot represent?',
      a: 'On encoding, an accented letter, a symbol or an emoji is written as a literal "?" in the output and named in a warning, so nothing is silently discarded. That question mark is not a Morse code and cannot be decoded back \u2014 check the warning and replace it before converting the result.',
    },
  ],
  related: ['nato-phonetic', 'rot13', 'text-to-binary', 'case-convert'],
  status: 'stable',
};
