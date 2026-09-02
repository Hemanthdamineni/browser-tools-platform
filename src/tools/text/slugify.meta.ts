import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'slugify',
  name: 'Slugify',
  category: 'text',
  summary: 'Turn a title into a clean URL slug — lowercase, hyphenated, accent-folded.',
  description:
    'Convert "My Great Post: Part 2!" into "my-great-post-part-2". Handles accents, symbols and multiple spaces, with options for separator, case and length.',
  keywords: ['slug', 'slugify', 'url slug', 'permalink', 'seo', 'handle'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'separator',
      label: 'Separator',
      type: 'select',
      default: '-',
      choices: [
        { value: '-', label: 'Hyphen (-)' },
        { value: '_', label: 'Underscore (_)' },
        { value: '.', label: 'Dot (.)' },
        { value: '', label: 'None' },
      ],
    },
    { key: 'lowercase', label: 'Lowercase', type: 'boolean', default: true },
    {
      key: 'strict',
      label: 'Strict (ASCII only, drop everything else)',
      type: 'boolean',
      default: true,
    },
    {
      key: 'maxLength',
      label: 'Max length (0 = no limit)',
      type: 'number',
      default: 0,
      min: 0,
      max: 300,
    },
  ],
  examples: [
    { title: 'A blog title', input: 'My Great Post: Part 2!' },
    { title: 'With accents', input: 'Crème brûlée & café' },
    { title: 'Underscores', input: 'Hello World', options: { separator: '_' } },
  ],
  faq: [
    {
      q: 'What happens to non-Latin scripts?',
      a: 'In strict mode they are removed. Turn strict off to keep letters from other scripts (Cyrillic, Greek, CJK) — useful for localised URLs on sites that allow Unicode paths.',
    },
  ],
  related: ['case-convert', 'remove-accents', 'whitespace-cleanup'],
  status: 'stable',
};
