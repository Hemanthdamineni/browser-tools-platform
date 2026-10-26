import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-stats',
  name: 'Text Statistics',
  category: 'text',
  summary:
    'Count characters, words, sentences and paragraphs, with platform limits, readability scores and reading time.',
  description:
    'Analyze any text for character, word, sentence, paragraph and line counts, plus reading and speaking time estimates. It also checks the text against common platform limits (X/Twitter, LinkedIn, Instagram, meta descriptions and SMS) and scores readability with Flesch Reading Ease, Flesch-Kincaid, Gunning Fog, SMOG, ARI and Coleman-Liau. Everything is computed on your device.',
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
    'readability score',
    'character limit',
    'twitter character count',
    'syllable count',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  examples: [
    { title: 'Two short sentences', input: 'The quick brown fox. The lazy dog runs.' },
    {
      title: 'Check against platform limits',
      input:
        'The quick brown fox jumps over the lazy dog near the river bank. The clever cat watched the busy fish swim.',
    },
    {
      title: 'Two paragraphs',
      input: 'First paragraph, line one.\n\nSecond paragraph here.',
    },
    {
      title: 'Readability on denser prose',
      input:
        'Reading is a helpful activity for every person. The talented writer produced an excellent chapter for the popular magazine.',
    },
  ],
  related: ['readability-score', 'word-frequency', 'char-frequency', 'case-convert'],
  status: 'stable',
};
