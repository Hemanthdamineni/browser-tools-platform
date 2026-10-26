/**
 * Editorial content for the tracestate tool page.
 *
 * Kept out of ``tracestate.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What belongs in tracestate?',
      a: 'Vendors use it for implementation-specific trace metadata while preserving other vendors’ entries during propagation.',
    },
    {
      q: 'Is tracestate confidential?',
      a: 'It may reveal vendor identifiers or routing metadata. Avoid putting secrets or sensitive user data in it.',
    },
    {
      q: 'How large can it be?',
      a: 'The W3C format limits tracestate to 32 list-members and 512 bytes.',
    },
  ],
} as const;
