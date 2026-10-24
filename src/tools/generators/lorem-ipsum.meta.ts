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
    {
      q: 'What does the output look like in each format?',
      a: 'Plain text joins paragraphs with a blank line and list items with a newline. HTML wraps paragraphs in <p> tags or list items in a <ul> with <li> children. Markdown uses blank lines between paragraphs and hyphens for list items, so it can be pasted straight into a README.',
    },
  ],
  article: [
    {
      heading: 'Choosing the unit and count',
      body: 'Pick how much copy you need from the unit dropdown — paragraphs, sentences, words or list items — and set the count from 1 to 200. The generator builds each unit from a shared word list, so a paragraph is a handful of sentences and a sentence is roughly eight to fifteen words. With the count at its maximum you get a long block suitable for a full-page mockup.',
    },
    {
      heading: 'The classic opening',
      body: 'With Start with “Lorem ipsum dolor sit amet…” on, the very first paragraph or sentence begins with the traditional eight words and the rest of the text is randomized around them. It is off by default only when the count is small; the option guarantees a familiar first line for a placeholder.',
    },
    {
      heading: 'The output formats',
      body: 'Plain text is ready for any editor. HTML wraps paragraphs in <p> tags, or list items in a <ul> with <li> children, so a mockup can paste it into a template directly. Markdown emits blank-line-separated paragraphs or hyphen-prefixed list items, which reads cleanly in a README or issue body.',
    },
    {
      heading: 'Random, but generated in your tab',
      body: 'Each run is randomized with crypto.getRandomValues, so consecutive clicks give different filler — it is not the same canned text every time. The generation is pure string work in the page, makes no network request and uploads nothing, so placeholder copy is produced instantly even offline.',
    },
  ],
  related: ['random-data', 'text-repeat'],
  status: 'stable',
};
