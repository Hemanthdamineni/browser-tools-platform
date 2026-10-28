import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-to-slug',
  name: 'Text to Slug',
  category: 'text',
  summary:
    'Convert text into URL-friendly slugs: lowercase, separator, trim, stopword and unicode options.',
  description:
    'Turn any text into a URL- and filename-safe slug. Standardise casing and separators, optionally strip common stopwords, transliterate accented characters (café → cafe), and cap length so slugs stay predictable. Useful for article URLs, subdomain segments, repo names and anchor-friendly text. Everything runs on-device.',
  keywords: [
    'text to slug',
    'slug generator',
    'url slug',
    'make a slug',
    'slugify',
    'URL-friendly text',
    'slug converter',
    'filename slug',
    'seo slug',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'separator',
      label: 'Separator',
      type: 'select',
      choices: [
        { value: '-', label: 'hyphen' },
        { value: '_', label: 'underscore' },
        { value: '', label: 'none' },
      ],
      default: '-',
    },
    {
      key: 'lowercase',
      label: 'Lowercase output',
      type: 'boolean',
      default: true,
    },
    {
      key: 'transliterate',
      label: 'Convert accents to ASCII',
      type: 'boolean',
      default: true,
    },
    {
      key: 'removeStopwords',
      label: 'Drop common stopwords',
      type: 'boolean',
      default: false,
    },
    {
      key: 'maxLength',
      label: 'Maximum slug length',
      type: 'number',
      default: 0,
      min: 0,
    },
  ],
  examples: [
    {
      title: 'A blog post title',
      input: 'How to Write Clean Code — a 10-Minute Guide',
    },
    {
      title: 'Drop stopwords',
      input: 'The Art of the Deal',
      options: { removeStopwords: true },
    },
    {
      title: 'Underscore filename',
      input: 'My Final Report 2024',
      options: { separator: '_' },
    },
  ],
  related: ['url-parse', 'url-encode', 'case-convert', 'text-stats'],
  status: 'stable',
};
