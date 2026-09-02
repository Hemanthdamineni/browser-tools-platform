import { site } from './site';
import type { ToolMeta } from './types';
import { CATEGORIES } from './categories';

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}

export function softwareAppJsonLd(meta: ToolMeta) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: meta.name,
    description: meta.summary,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web browser (Windows, macOS, Linux, Android, iOS)',
    url: absoluteUrl(`/tools/${meta.id}`),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isAccessibleForFree: true,
    browserRequirements: 'Requires JavaScript. No sign-up.',
    publisher: { '@type': 'Organization', name: site.name, url: site.url },
  };
}

export function faqJsonLd(meta: ToolMeta) {
  if (!meta.faq?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: meta.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbJsonLd(meta: ToolMeta) {
  const category = CATEGORIES[meta.category];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tools', item: absoluteUrl('/tools') },
      {
        '@type': 'ListItem',
        position: 2,
        name: category.name,
        item: absoluteUrl(`/categories/${category.id}`),
      },
      { '@type': 'ListItem', position: 3, name: meta.name, item: absoluteUrl(`/tools/${meta.id}`) },
    ],
  };
}
