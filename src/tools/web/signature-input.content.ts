/**
 * Editorial content for the signature-input tool page.
 *
 * Kept out of ``signature-input.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does this create a cryptographic signature?',
      a: 'No. Signature-Input declares what a separate HTTP Message Signature covers; a Signature header and a signing key are still required.',
    },
    {
      q: 'What are covered components?',
      a: 'They identify derived components such as @method and @target-uri or message fields such as content-digest.',
    },
    {
      q: 'Are timestamps required?',
      a: 'Created is recommended for freshness and expires can bound validity, but deployment requirements depend on the signature profile.',
    },
  ],
} as const;
