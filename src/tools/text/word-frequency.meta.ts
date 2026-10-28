import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'word-frequency',
  name: 'Word Frequency Counter',
  category: 'text',
  summary:
    'Count how often each word appears, with case folding, a minimum length, stop-word removal and a top-N limit.',
  description:
    'Tally word occurrences in a block of text and rank them from most to least frequent. Optionally fold case, ignore short words, drop about 40 common English stop words, and keep only the most frequent results.',
  keywords: [
    'word frequency',
    'word count',
    'term frequency',
    'keyword density',
    'word counter',
    'most common words',
    'stop words',
    'text analysis',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'caseInsensitive',
      label: 'Ignore case',
      type: 'boolean',
      default: true,
    },
    {
      key: 'minLength',
      label: 'Minimum word length',
      type: 'number',
      default: 1,
      min: 1,
    },
    {
      key: 'top',
      label: 'Show top N (0 = all)',
      type: 'number',
      default: 25,
      min: 0,
    },
    {
      key: 'ignoreCommon',
      label: 'Ignore common words (stop words)',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Repeated words',
      input: 'the cat the dog the cat',
      options: { caseInsensitive: true },
    },
    {
      title: 'Ignore common words',
      input: 'the quick brown fox jumps over the lazy dog',
      options: { ignoreCommon: true },
    },
    {
      title: 'Words of 4+ letters, top 5',
      input: 'one two three four five three four four five five five',
      options: { minLength: 4, top: 5 },
    },
  ],
  faq: [
    {
      q: 'What counts as a word?',
      a: 'A run of letters, digits and apostrophes. Hyphens, spaces and other punctuation split words apart.',
    },
    {
      q: 'What does the percentage mean?',
      a: "A word's share of all counted words, after the minimum-length and stop-word filters have been applied.",
    },
    {
      q: 'Which stop words are removed?',
      a: 'About 40 of the most common English function words such as the, a, an, and, or, of, to, in, is and it.',
    },
  ],
  related: [  "text-stats",
  "char-frequency",
  "case-convert",
  "dedupe-lines"],
  status: 'stable',
};
