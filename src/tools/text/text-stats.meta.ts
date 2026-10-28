import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-stats',
  name: 'Text Statistics',
  category: 'text',
  summary:
    'Count characters, words, sentences, paragraphs and lines, with reading and speaking time estimates.',
  description:
    'Analyze any text for character, word, sentence, paragraph and line counts. Reading time is estimated at 238 words per minute and speaking time at 130 words per minute. Average word length, average sentence length and the longest word are included, all computed on your device.',
  keywords: [
    'text statistics',
    'word count',
    'character count',
    'wordcount',
    'reading time',
    'speaking time',
    'sentence count',
    'paragraph count',
    'text analyzer',
    'text analyser',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'Two short sentences', input: 'The quick brown fox. The lazy dog runs.' },
    { title: 'A single word', input: 'Hello' },
    {
      title: 'Two paragraphs',
      input: 'First paragraph, line one.\n\nSecond paragraph here.',
    },
  ],
  faq: [
    {
      q: 'How is reading time calculated?',
      a: 'Word count divided by 238 words per minute — a common estimate of adult silent reading speed — rounded to the nearest second. Speaking time uses 130 words per minute.',
    },
    {
      q: 'How are sentences detected?',
      a: 'By splitting on runs of . ! and ? characters. Abbreviations such as "Mr." can therefore inflate the sentence count slightly.',
    },
    {
      q: 'What does "characters (no spaces)" mean?',
      a: 'The character count after removing every whitespace character, including tabs and newlines.',
    },
  ],
  related: [  "word-frequency",
  "char-frequency",
  "case-convert",
  "sort-lines"],
  status: 'stable',
};
