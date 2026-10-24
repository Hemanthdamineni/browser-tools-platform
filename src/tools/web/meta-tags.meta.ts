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
  article: [
    {
      heading: 'What the generator emits',
      body: 'Fill in a title and a description and you get a head block: a <title>, a meta description, an optional canonical link, a set of Open Graph meta properties and a set of Twitter card meta tags. Empty fields are simply omitted, so you can start with just a title and add the social details later. The output is a block of HTML lines ready to paste between <head> and </head>.',
    },
    {
      heading: 'The two fields that are always written',
      body: 'Open Graph type and the Twitter card type always appear, because both protocols require a value: og:type defaults to website and can be switched to article, while twitter:card defaults to summary_large_image with a plain summary alternative. Everything conditional \u2014 og:title, og:description, og:url, og:image, og:site_name and the matching twitter: fields \u2014 is included only when you supplied the value it needs.',
    },
    {
      heading: 'Escaping and safe pasting',
      body: 'Every value is HTML-escaped before it goes in an attribute, so an ampersand becomes &amp; and a double quote becomes &quot;. That means a title containing quotes or angle brackets cannot break out of the attribute and corrupt your head section, which is exactly the kind of bug a hand-written tag block tends to hide until a page title contains a stray character.',
    },
    {
      heading: 'What it does not do',
      body: 'The tool writes tags; it does not validate them. It does not check that your canonical URL matches the page you are on, that the social image is the right size or reachable, or that the description lands in the 50 to 160 character band search engines prefer. It also does not emit structured data such as JSON-LD, or favicon and viewport tags, which belong alongside it rather than inside it.',
    },
    {
      heading: 'Ready offline, private by default',
      body: 'There is no URL fetching and no image inspection \u2014 the tags are assembled from the strings you type. Nothing is uploaded, so you can draft metadata for an unreleased page without leaking anything about it.',
    },
  ],
  faq: [
    {
      q: 'Why are attribute values escaped?',
      a: 'Quotes and angle brackets are escaped (&quot; &lt; &gt; &amp;) so the generated HTML is safe to paste even when your title contains special characters.',
    },
    {
      q: 'Why is og:type always included even when I leave fields blank?',
      a: 'The Open Graph protocol requires a type, and the Twitter card tag is likewise mandatory. Both get a sensible default (website and summary_large_image), while every other tag appears only when you supply its value.',
    },
    {
      q: 'Can I generate a page with only a description?',
      a: 'Yes. The tool needs at least one of title or description; the title tag, og:title and twitter:title are simply dropped when no title is given, and the description tags are written instead.',
    },
  ],
  related: ['robots-txt', 'gitignore', 'url-parse'],
  status: 'stable',
};
