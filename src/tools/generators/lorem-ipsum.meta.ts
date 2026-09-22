import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'lorem-ipsum',
  name: 'Lorem Ipsum Generator',
  category: 'generators',
  summary:
    'Generate lorem ipsum placeholder text as words, sentences, paragraphs, lists — plain, HTML or Markdown.',
  description:
    'Fill layouts and templates with classic lorem ipsum. Choose how much you need (words, sentences, paragraphs or list items) and get plain text, HTML markup or Markdown.',
  keywords: [
    'lorem ipsum',
    'placeholder text',
    'dummy text',
    'filler text',
    'ipsum generator',
    'lorem',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'unit',
      label: 'Unit',
      type: 'select',
      default: 'paragraphs',
      choices: [
        { value: 'paragraphs', label: 'Paragraphs' },
        { value: 'sentences', label: 'Sentences' },
        { value: 'words', label: 'Words' },
        { value: 'list-items', label: 'List items' },
      ],
    },
    { key: 'count', label: 'Count', type: 'number', default: 3, min: 1, max: 200 },
    {
      key: 'startWithLorem',
      label: 'Start with “Lorem ipsum dolor sit amet…”',
      type: 'boolean',
      default: true,
    },
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      default: 'plain',
      choices: [
        { value: 'plain', label: 'Plain text' },
        { value: 'html', label: 'HTML' },
        { value: 'markdown', label: 'Markdown' },
      ],
    },
  ],
  examples: [
    { title: '3 paragraphs', options: { unit: 'paragraphs', count: 3 } },
    { title: '1 HTML paragraph', options: { unit: 'paragraphs', count: 1, format: 'html' } },
    { title: '10 words', options: { unit: 'words', count: 10 } },
  ],
  faq: [
    {
      q: 'What is lorem ipsum?',
      a: 'A scrambled excerpt from Cicero’s “De finibus” (45 BC), used as neutral placeholder copy in typesetting and design since the 1500s.',
    },
    {
      q: 'Is the text identical every time?',
      a: 'No — beyond the optional “Lorem ipsum dolor sit amet…” opening, the word order and sentence lengths are randomized each run.',
    },
  ],
  related: ['random-data', 'text-repeat'],
  status: 'stable',
};
