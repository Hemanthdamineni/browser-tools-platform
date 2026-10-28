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
  related: [  "nato-phonetic",
  "rot13",
  "case-convert"],
  status: 'stable',
};
