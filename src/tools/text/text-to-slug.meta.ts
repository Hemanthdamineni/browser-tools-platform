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
      max: 200,
    },
  ],
  examples: [
    {
      title: 'A blog post title',
      input: 'How to Write Clean Code — a 10-Minute Guide',
    },
  ],
  faq: [
    {
      q: 'What exactly is a slug?',
      a: 'The human-readable part of a URL that identifies a page, e.g. /tips/how-to-write-clean-code. A good slug is lowercase, uses one separator, and drops filler words.',
    },
    {
      q: 'Why transliterate accents?',
      a: 'URLs should stay ASCII. "café" becomes "cafe", "ñ" becomes "n", "æ" becomes "ae" — so links are copy-safe and consistent across systems.',
    },
    {
      q: 'What happens when max length cuts a word?',
      a: 'The slug is truncated at a word boundary and trailing separators are removed, so you never get a dangling "my-page-".',
    },
  ],
  related: ['url-parse', 'url-encode', 'case-convert', 'text-stats'],
  status: 'stable',
};
