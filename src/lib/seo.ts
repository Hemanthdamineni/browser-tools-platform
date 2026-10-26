import { site } from './site';
import type { ToolMeta } from './types';
import { CATEGORIES } from './categories';

export function absoluteUrl(path: string): string {
  return new URL(path, site.url).toString();
}

/**
 * Stable `@id` for the whole organisation. Every page that describes the
 * publisher references this id instead of inlining the Organization node, so
 * the schema graph stays connected and unambiguous.
 */
export function organizationId(): string {
  return `${site.url}#organization`;
}

/** Stable `@id` for the website (the searchable home page). */
export function websiteId(): string {
  return `${site.url}#website`;
}

/** Stable `@id` for a single tool page, referenced by ItemList entries. */
export function toolPageId(id: string): string {
  return absoluteUrl(`/tools/${id}`);
}

/**
 * The organisation behind the site. Emitted on the home page and referenced by
 * id from every SoftwareApplication / WebSite node so they share one identity.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@id': organizationId(),
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-512.png') },
  };
}

/** The website itself, including a SearchAction so search engines index /tools?q=. */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@id': websiteId(),
    '@type': 'WebSite',
    name: site.name,
    alternateName: site.shortName,
    url: site.url,
    description: site.description,
    publisher: { '@id': organizationId() },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: absoluteUrl('/tools?q={search_term_string}'),
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function softwareAppJsonLd(meta: ToolMeta) {
  return {
    '@context': 'https://schema.org',
    '@id': `${toolPageId(meta.id)}#software-application`,
    '@type': 'SoftwareApplication',
    name: meta.name,
    description: meta.summary,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web browser (Windows, macOS, Linux, Android, iOS)',
    url: absoluteUrl(`/tools/${meta.id}`),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isAccessibleForFree: true,
    browserRequirements: 'Requires JavaScript. No sign-up.',
    publisher: { '@id': organizationId() },
  };
}

export function faqJsonLd(meta: ToolMeta, faq?: { q: string; a: string }[]) {
  if (!faq?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@id': `${toolPageId(meta.id)}#faq`,
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
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
    '@id': `${toolPageId(meta.id)}#breadcrumb`,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tools', item: absoluteUrl('/tools') },
      {
        '@type': 'ListItem',
        position: 2,
        name: category.name,
        item: absoluteUrl(`/categories/${category.id}`),
      },
      { '@type': 'ListItem', position: 3, name: meta.name, item: toolPageId(meta.id) },
    ],
  };
}

/**
 * Ordered steps for the tool page, derived from the `article` headings. Only
 * emitted when the tool actually ships an `article`, so the schema never
 * describes content that is not visible on the page.
 */
export function howToJsonLd(meta: ToolMeta, article?: { heading: string; body: string }[]) {
  if (!article?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@id': `${toolPageId(meta.id)}#how-to`,
    '@type': 'HowTo',
    name: meta.name,
    step: article.map((entry, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: entry.heading,
      text: entry.body,
    })),
  };
}

/** Ordered list of pages, used on /tools and /categories/[category]. */
export function itemListJsonLd(
  items: { id: string; name: string; url: string }[],
  name: string,
  url: string,
) {
  return {
    '@context': 'https://schema.org',
    '@id': `${absoluteUrl(url)}#item-list`,
    '@type': 'ItemList',
    name,
    url: absoluteUrl(url),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
      item: { '@id': item.url },
    })),
  };
}

/** Breadcrumb for category listing pages ("Categories › <category>"). */
export function categoryBreadcrumbJsonLd(categoryId: string, categoryName: string) {
  return {
    '@context': 'https://schema.org',
    '@id': `${absoluteUrl(`/categories/${categoryId}`)}#breadcrumb`,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Categories', item: absoluteUrl('/categories') },
      {
        '@type': 'ListItem',
        position: 2,
        name: categoryName,
        item: absoluteUrl(`/categories/${categoryId}`),
      },
    ],
  };
}
