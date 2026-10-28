import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'upgrade-text-stats',
  name: 'Text Statistics Pro',
  category: 'text',
  summary: 'Enhanced text statistics with platform limits and readability scores.',
  description:
    'Analyze text for comprehensive statistics: character/word/sentence/paragraph counts, reading/speaking time, and platform-specific character limits for X (280), LinkedIn (3000), Instagram (2200), meta descriptions (160), and more. Includes readability scores: Flesch Reading Ease, Flesch-Kincaid Grade Level, Gunning Fog Index, SMOG Index, Automated Readability Index (ARI), and Coleman-Liau Index. All computation runs locally in your browser.',
  keywords: [
    'text statistics',
    'word count',
    'character count',
    'platform limits',
    'twitter character limit',
    'linkedin character limit',
    'instagram character limit',
    'meta description length',
    'readability score',
    'flesch reading ease',
    'flesch-kincaid',
    'gunning fog',
    'smog index',
    'automated readability index',
    'coleman-liau',
    'text analyzer',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'showDetails',
      label: 'Show detailed breakdown',
      type: 'boolean',
      default: true,
    },
    {
      key: 'platform',
      label: 'Platform limit to check',
      type: 'select',
      default: 'all',
      choices: [
        { value: 'all', label: 'All platforms' },
        { value: 'x', label: 'X / Twitter (280)' },
        { value: 'linkedin', label: 'LinkedIn (3000)' },
        { value: 'instagram', label: 'Instagram (2200)' },
        { value: 'meta-description', label: 'Meta Description (160)' },
        { value: 'sms', label: 'SMS (160)' },
        { value: 'email-subject', label: 'Email Subject (50-60)' },
      ],
    },
  ],
  examples: [
    { title: 'Short tweet', input: 'Just finished building a new feature! 🚀 #webdev #typescript' },
    { title: 'LinkedIn post', input: 'I\'m excited to announce that I\'ve joined the team at...' },
    { title: 'Long article excerpt', input: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.' },
  ],
  faq: [
    {
      q: 'What platform limits are included?',
      a: 'X/Twitter: 280 chars, LinkedIn: 3000 chars, Instagram: 2200 chars, Meta Description: 160 chars, SMS: 160 chars, Email Subject: ~60 chars. Limits are based on current platform documentation as of 2024.',
    },
    {
      q: 'What readability formulas are used?',
      a: 'Flesch Reading Ease (0–100), Flesch-Kincaid Grade Level, Gunning Fog Index, SMOG Index, Automated Readability Index (ARI), and Coleman-Liau Index. Syllable counts are estimated via vowel-group heuristics for English text.',
    },
    {
      q: 'How accurate are the readability scores?',
      a: 'Scores are estimates based on word/sentence/syllable counts. They work best for English prose of 100+ words. Short text, code, or non-English content will produce unreliable results.',
    },
    {
      q: 'What is the difference from the basic Text Statistics tool?',
      a: 'This tool adds platform-specific character limit checking and six readability formulas. The basic tool focuses on core counts and reading/speaking time only.',
    },
  ],
  related: ['text-stats', 'readability-score', 'word-frequency', 'char-frequency', 'text-summarizer'],
  status: 'stable',
};