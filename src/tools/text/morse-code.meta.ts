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
  related: ['nato-phonetic', 'rot13', 'text-to-binary', 'case-convert'],
  status: 'stable',
};
