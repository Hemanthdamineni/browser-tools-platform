import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'meta-tags',
  name: 'HTML Meta Tag Generator',
  category: 'web',
  summary: 'Generate SEO, Open Graph and Twitter card meta tags from page details.',
  description:
    'Enter a title, description and optional canonical URL, social image, type and site name — get a copy-pasteable <head> block with SEO, Open Graph and Twitter card tags. Empty fields are skipped and values are HTML-escaped.',
  keywords: [
    'meta tags',
    'open graph generator',
    'twitter card',
    'seo meta',
    'og tags',
    'head tags',
    'meta tag generator',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'title', label: 'Title', type: 'text', default: '' },
    { key: 'description', label: 'Description', type: 'text', default: '' },
    { key: 'canonicalUrl', label: 'Canonical URL', type: 'text', default: '' },
    { key: 'imageUrl', label: 'Social image URL', type: 'text', default: '' },
    {
      key: 'ogType',
      label: 'Open Graph type',
      type: 'select',
      default: 'website',
      choices: [
        { value: 'website', label: 'website' },
        { value: 'article', label: 'article' },
      ],
    },
    {
      key: 'twitterCard',
      label: 'Twitter card',
      type: 'select',
      default: 'summary_large_image',
      choices: [
        { value: 'summary', label: 'summary' },
        { value: 'summary_large_image', label: 'summary_large_image' },
      ],
    },
    { key: 'siteName', label: 'Site name', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Blog post',
      options: {
        title: 'My Page',
        description: 'Hi',
        canonicalUrl: 'https://example.com/my-page',
        imageUrl: 'https://example.com/cover.png',
      },
    },
    {
      title: 'Minimal page',
      options: { title: 'Widget Pro', description: 'A small widget that does a lot.' },
    },
    {
      title: 'Article with a small card',
      options: {
        title: 'Release notes 2.0',
        description: 'What changed in the 2.0 release.',
        canonicalUrl: 'https://example.com/blog/2-0',
        ogType: 'article',
        twitterCard: 'summary',
        siteName: 'Example',
      },
    },
  ],
  related: ['robots-txt', 'gitignore', 'url-parse'],
  status: 'stable',
};
