import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-language',
  name: 'Content-Language Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Content-Language locale tags.',
  description:
    'Generate or analyze Content-Language response values using BCP 47-style language tags, including regional and script subtags. Validates common tag structure, wildcard usage, duplicates, and private-use caveats locally.',
  keywords: [
    'Content-Language',
    'BCP 47',
    'language tag header',
    'locale header',
    'HTTP localization',
    'language negotiation',
    'Accept-Language related',
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
        { value: 'analyze', label: 'Analyze tags' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'tags', label: 'Language tags (comma-separated)', type: 'text', default: 'en-US, fr' },
  ],
  examples: [
    { title: 'Analyze localized response', input: 'en-US, Latn, fr-CA' },
    { title: 'Build a language header', options: { mode: 'build', tags: 'en-US, fr-CA' } },
    { title: 'Check a wildcard tag', input: '*' },
  ],
  related: ['http-encoding', 'cache-headers', 'meta-tags'],
  status: 'stable',
};
