/**
 * Editorial content for the sunset-deprecation tool page.
 *
 * Kept out of ``sunset-deprecation.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What do Sunset and Deprecation do?',
      a: 'They communicate the end-of-life or deprecation date of an API resource to clients, replacing ad-hoc documentation-only notices.',
    },
    {
      q: 'How do they differ?',
      a: 'Sunset announces when a served resource will stop being available; Deprecation indicates the resource is deprecated but still functional.',
    },
    {
      q: 'Why include a Link?',
      a: 'A Link header (or Link parameter) can point clients to migration or replacement documentation for the deprecated resource.',
    },
  ],
} as const;
