/**
 * Editorial content for the date-header tool page.
 *
 * Kept out of ``date-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Why does Date matter?',
      a: 'Caches use response dates with Age and freshness metadata, and operational tooling uses them to diagnose server clock skew.',
    },
    {
      q: 'Should every response include Date?',
      a: 'Origin servers generally send it for responses except some status and protocol-specific cases; intermediaries may add or update it according to HTTP rules.',
    },
    {
      q: 'Does this measure my server clock?',
      a: 'No. It only validates a pasted value or formats a supplied date string; it makes no network request.',
    },
  ],
} as const;
