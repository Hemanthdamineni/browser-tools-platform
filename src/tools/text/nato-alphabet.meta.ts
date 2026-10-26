import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'nato-alphabet',
  name: 'NATO Phonetic Alphabet',
  category: 'text',
  summary:
    'Spell text aloud with the NATO phonetic alphabet, or decode spoken words back into text.',
  description:
    'Convert text to the NATO phonetic alphabet (Alpha, Bravo, Charlie …) for dictating names, codes and IDs over the phone or radio, or decode a sequence like "Foxtrot Oscar X-ray" back into text. Digits, punctuation and non-Latin characters are handled predictably, with options for word separation style.',
  keywords: [
    'nato phonetic alphabet',
    'phonetic alphabet',
    'radio alphabet',
    'spelling alphabet',
    'alpha bravo charlie',
    'decode nato',
    'spell over phone',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'direction',
      label: 'Direction',
      type: 'select',
      choices: [
        { value: 'encode', label: 'Text → phonetic words' },
        { value: 'decode', label: 'Phonetic words → text' },
      ],
      default: 'encode',
    },
    {
      key: 'separator',
      label: 'Word separator',
      type: 'select',
      choices: [
        { value: 'space', label: 'Space' },
        { value: 'newline', label: 'New line' },
        { value: 'comma', label: 'Comma + space' },
      ],
      default: 'space',
    },
    {
      key: 'uppercase',
      label: 'Uppercase letters',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Spell a callsign',
      input: 'N73AB',
    },
    {
      title: 'Decode a spoken sequence',
      input: 'Foxtrot Oscar X-ray',
      options: { direction: 'decode' },
    },
    {
      title: 'One word per line',
      input: 'Hotel Echo Lima Lima Oscar',
      options: { direction: 'decode', separator: 'newline' },
    },
  ],
  related: ['morse-code', 'text-stats', 'case-convert', 'char-frequency'],
  status: 'stable',
};
