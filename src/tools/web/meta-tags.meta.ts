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
  ],
  faq: [
    {
      q: 'Why are attribute values escaped?',
      a: 'Quotes and angle brackets are escaped (&quot; &lt; &gt; &amp;) so the generated HTML is safe to paste even when your title contains special characters.',
    },
  ],
  related: ['robots-txt', 'gitignore', 'url-parse'],
  status: 'stable',
};
