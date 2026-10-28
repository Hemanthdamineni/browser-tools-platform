import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'whitespace-visualizer',
  name: 'Whitespace Visualizer',
  category: 'text',
  summary:
    'Reveal spaces, tabs, line endings, non-breaking spaces and zero-width formatting characters.',
  description:
    'Make invisible whitespace and formatting characters visible with Unicode labels, or clean text by converting non-breaking spaces to ordinary spaces and removing selected zero-width formatting characters. Zero-width joiners are preserved so emoji and joined scripts keep their shaping. All processing happens on your device.',
  keywords: [
    'whitespace visualizer',
    'invisible characters',
    'show tabs',
    'show spaces',
    'zero-width space',
    'non-breaking space',
    'NBSP',
    'line ending viewer',
    'clean invisible characters',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'visualize',
      choices: [
        { value: 'visualize', label: 'Visualize invisible characters' },
        { value: 'clean', label: 'Clean NBSP and zero-width formatting' },
      ],
    },
  ],
  examples: [
    { title: 'Tabs and spaces', input: 'name:\tAda Lovelace\n  role: analyst' },
    { title: 'Non-breaking space', input: 'price: 10 USD' },
    { title: 'Zero-width space', input: 'invisible​break' },
  ],
  faq: [
    {
      q: 'Which characters are shown in visualization mode?',
      a: 'Spaces, tabs, common Unicode spaces, line endings, C0/C1 control characters, byte-order marks, and selected zero-width formatting characters are replaced with labels containing their Unicode code point.',
    },
    {
      q: 'What does clean mode change?',
      a: 'It converts non-breaking spaces to ordinary spaces and removes zero-width space, non-joiner, word joiner, byte-order mark, and several invisible formatting controls. Zero-width joiner is retained because it is needed for emoji sequences and shaping in some scripts.',
    },
    {
      q: 'Are my text or files uploaded?',
      a: 'No. The text is processed entirely in your browser and is not sent over the network.',
    },
  ],
  related: [  "remove-empty-lines",
  "unicode-escape"],
  status: 'stable',
};
