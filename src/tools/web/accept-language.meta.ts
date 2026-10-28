import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'accept-language',
  name: 'Accept-Language Header Analyzer',
  category: 'web',
  summary: 'Analyze and build Accept-Language values',
  description:
    'Analyze HTTP Accept-Language header values or rank a list of language tags. Validates BCP-47 language syntax and q-values, sorts by preference, flags duplicates and malformed weights, and reports which languages a client most prefers.',
  keywords: [
    'Accept-Language',
    'language negotiation',
    'language tag',
    'BCP 47',
    'q-value',
    'quality value',
    'RFC 5646',
    'HTTP language',
    'locale weighting',
    'content negotiation',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze header' },
        { value: 'rank', label: 'Sort by preference' },
      ],
    },
    {
      key: 'defaultQuality',
      label: 'Default q (rank mode)',
      type: 'select',
      default: '1.0',
      choices: [
        { value: '1.0', label: '1.0' },
        { value: '0.9', label: '0.9' },
        { value: '0.5', label: '0.5' },
        { value: '0', label: '0 (not acceptable)' },
      ],
    },
  ],
  examples: [
    {
      title: 'Analyze a browser header',
      input: 'Accept-Language: en-US, en;q=0.9, fr;q=0.7, *;q=0.5',
    },
    {
      title: 'Rank a comma-separated tag list',
      input: 'de, ja, es',
      options: { mode: 'rank', defaultQuality: '0.9' },
    },
  ],
  faq: [
    {
      q: 'How are q-values interpreted?',
      a: "A q-value (0 to 1) expresses a client's preference for that language, with 1.0 the strongest. Descending order of q-value is the preference order.",
    },
    {
      q: 'What is a valid language range?',
      a: 'Per BCP 47, tags like en (language), en-US (region) or zh-Hant (script) are valid. Wildcards (*) match any language.',
    },
    {
      q: 'What are common pitfalls?',
      a: 'q-values outside 0–1 are invalid; duplicate ranges should be combined; and a language with q=0 is explicitly unacceptable.',
    },
  ],
  related: [  "content-language",
  "cache-headers",
  "accept-post"],
  status: 'stable',
};
