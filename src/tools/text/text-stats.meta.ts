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
  faq: [
    {
      q: 'How is reading time calculated?',
      a: 'Word count divided by 238 words per minute — a common estimate of adult silent reading speed — rounded to the nearest second. Speaking time uses 130 words per minute.',
    },
    {
      q: 'How are the platform limits counted?',
      a: 'The same character count shown at the top (Unicode code points, spaces included) is compared with each limit. Each row shows the count, the limit, and whether you are under it, exactly at it, or over it. Meta descriptions are checked against the usual 155–160 character band, and SMS against 160 characters per segment.',
    },
    {
      q: 'How accurate are the readability scores?',
      a: 'They are estimates. Flesch Reading Ease, Flesch-Kincaid, Gunning Fog, SMOG, ARI and Coleman-Liau all depend on syllable counts, which are estimated from vowel groups rather than a pronunciation dictionary, so proper nouns and unusual words can shift a score by a point or two. Treat them as a guide for comparing drafts, not as a verdict.',
    },
    {
      q: 'How are syllables and sentences counted?',
      a: 'Syllables use a vowel-group heuristic: every run of vowels (a, e, i, o, u, y) is one syllable, then a final silent "e" is dropped, with a floor of one syllable per word. Sentences are split on runs of . ! and ? characters, and for the readability formulas only sentences containing at least one word made of letters are counted.',
    },
    {
      q: 'What does "characters (no spaces)" mean?',
      a: 'The character count after removing every whitespace character, including tabs and newlines.',
    },
  ],
  related: ['readability-score', 'word-frequency', 'char-frequency', 'case-convert'],
  status: 'stable',
};
