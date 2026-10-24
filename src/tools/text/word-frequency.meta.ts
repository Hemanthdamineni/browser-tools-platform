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
      max: 20,
    },
    {
      key: 'top',
      label: 'Show top N (0 = all)',
      type: 'number',
      default: 25,
      min: 0,
      max: 500,
    },
    {
      key: 'ignoreCommon',
      label: 'Ignore common words (stop words)',
      type: 'boolean',
      default: false,
    },
  ],
  article: [
    {
      heading: 'From text to a ranked tally',
      body: 'Paste a block of text and the tool splits it into words, counts each distinct one, and returns a table of word, count and percentage of all counted words, sorted from most to least frequent with ties broken alphabetically. The stats line gives the total word count, the unique-word count and how many rows are shown. It is the quick way to see what a document is actually about, or to catch a word you have overused.',
    },
    {
      heading: 'What counts as a word',
      body: 'A word is a run of letters, digits and apostrophes — so "don’t" and "2024" each count as one, while hyphens and other punctuation split words apart. The count uses Unicode letter and number classes, so accented and non-Latin words are tallied correctly rather than dropped, and the minimum length filter is measured in characters on the folded word.',
    },
    {
      heading: 'The filters that matter',
      body: 'Ignore case folds everything to lower case first, so "The" and "the" merge — usually what you want, and on by default. Minimum word length drops short words before counting, which removes noise from a top-N list. Ignore common words removes about 40 English function words (the, a, an, and, or, of, to, in, is, it and so on) so content words rise to the top. Show top N trims the output — set it to 0 for the full list, or a small number for a keyword-density view.',
    },
    {
      heading: 'Caveats and privacy',
      body: 'The percentage is a share of the words that survived the filters, not of the original document, so lowering the minimum length or enabling stop-word removal changes every percentage. There is no stemming, so "run" and "running" are counted separately. The analysis runs entirely in the page with no request or upload, so an unpublished draft stays on your device.',
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
  related: ['text-stats', 'char-frequency', 'case-convert', 'dedupe-lines'],
  status: 'stable',
};
