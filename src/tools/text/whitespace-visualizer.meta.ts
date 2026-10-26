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
  related: ['unicode-lookup', 'remove-empty-lines', 'find-replace'],
  status: 'stable',
};
