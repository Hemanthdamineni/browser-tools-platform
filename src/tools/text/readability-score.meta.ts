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
  ],
  faq: [
    {
      q: 'What do the two scores mean?',
      a: 'Flesch Reading Ease runs 0–100: roughly 90–100 is very easy (children\'s books), 60–70 is plain English, under 30 is very difficult. Flesch-Kincaid Grade Level reports the US education grade needed, so 8 means an average 13–14 year old can read it.',
    },
    {
      q: 'How are syllables counted?',
      a: 'By a vowel-group estimate — every run of vowels (a, e, i, o, u, y after a consonant) in a word counts as one syllable, then small rules fix silent-e endings. It is close for English without needing a dictionary.',
    },
    {
      q: 'When is short text unreliable?',
      a: 'The formulas are meant for prose like articles. A single word or a very short phrase can produce a score that does not generalise, so the result is marked as approximate for input under about 100 words.',
    },
  ],
  related: ['text-stats', 'word-frequency', 'char-frequency', 'text-summarizer'],
  status: 'stable',
};
