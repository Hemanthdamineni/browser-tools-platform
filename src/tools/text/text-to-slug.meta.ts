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
  article: [
    {
      heading: 'What each option changes',
      body: 'Separator picks the joiner between words — hyphen, underscore or none. Lowercase output is on by default, and transliterate maps accented characters to ASCII so café becomes cafe, ñ becomes n, and the ligatures æ, œ, ß, ø, đ and ł each have their own mapping. Remove stopwords drops common words such as the, and, of and to.',
    },
    {
      heading: 'The normalising pipeline',
      body: 'Input is collapsed first: runs of whitespace become one space, both ends are trimmed, and anything over 20,000 characters is refused. The text is then transliterated, lowercased and stripped of every non-alphanumeric run in favour of the separator, with empty segments dropped. If nothing remains, the tool stops with a hint to toggle stopword removal or transliteration instead of returning a blank slug.',
    },
    {
      heading: 'Truncation stops at a word boundary',
      body: 'Max length does not slice mid-word. The slug is rebuilt one word at a time, stopping at the last whole word that fits, so a 60-character cap yields my-page-title rather than my-page-titl. With the none separator there are no word boundaries, so truncation falls back to a plain character cut.',
    },
    {
      heading: 'Deterministic and local',
      body: 'The transformation is a local string pipeline, so the text never leaves your browser and the page works offline. It is deterministic — the same input and options always produce the same slug — which suits filenames, repo names and anchor text.',
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
