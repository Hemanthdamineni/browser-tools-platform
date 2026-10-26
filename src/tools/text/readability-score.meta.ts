import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'readability-score',
  name: 'Readability Score',
  category: 'text',
  summary:
    'Score text with Flesch Reading Ease and Flesch-Kincaid Grade Level, with syllable estimates and interpretation.',
  description:
    'Paste any text to get its readability measured two ways: the Flesch Reading Ease score (0–100, 100 being very easy) and the Flesch-Kincaid Grade Level (the US school grade a reader needs). Both use word, sentence and syllable counts; syllables are estimated from vowel groups so no dictionary is needed. The tool grades the result by reading experience and explains what each score means.',
  keywords: [
    'readability score',
    'flesch reading ease',
    'flesch-kincaid grade',
    'reading level',
    'text readability',
    'syllable count',
    'grade level checker',
    'readability test',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'showDetails',
      label: 'Show word/sentence/syllable counts',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A short sentence',
      input: 'The quick brown fox jumps over the lazy dog.',
    },
    {
      title: 'A dense academic paragraph',
      input:
        'The epistemological ramifications of post-structuralist hermeneutics necessitate a reconsideration of the methodological presuppositions underlying contemporary textual analysis.',
      options: { showDetails: true },
    },
    {
      title: 'Score without the raw counts',
      input: 'We shipped the update on Tuesday. It made the app start faster. Users noticed.',
      options: { showDetails: false },
    },
  ],
  related: ['text-stats', 'word-frequency', 'char-frequency', 'text-summarizer'],
  status: 'stable',
};
