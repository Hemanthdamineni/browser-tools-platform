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
  ],
  faq: [
    {
      q: 'What is the NATO phonetic alphabet?',
      a: 'The spelling alphabet used in radio and aviation: A=Alpha, B=Bravo, C=Charlie, and so on through Z=Zulu. Each letter has a distinct word so letters cannot be confused over a noisy channel.',
    },
    {
      q: 'How are digits handled?',
      a: 'Digits map to their English names — 0=Zero, 1=One … 9=Nine — and are emitted as separate tokens, so "N73" becomes "November Seven Three". Punctuation such as hyphens or slashes is passed through as its own token so nothing is lost.',
    },
    {
      q: 'How does decoding work?',
      a: 'Paste words like "Alpha Bravo" and each recognised word maps back to its letter; unknown words are preserved in brackets so nothing is silently lost.',
    },
  ],
  related: [  "morse-code",
  "text-stats",
  "case-convert",
  "char-frequency"],
  status: 'stable',
};
