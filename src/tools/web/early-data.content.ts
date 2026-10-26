/**
 * Editorial content for the early-data tool page.
 *
 * Kept out of ``early-data.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does Early-Data: 0 mean?',
      a: 'It indicates that a request was sent in TLS 1.3 early data and may be replayed by an attacker or network path.',
    },
    {
      q: 'What is 425 Too Early?',
      a: 'A server can return 425 to ask the client to retry the request after the handshake, when replay safety cannot be established.',
    },
    {
      q: 'Does this make a request safe?',
      a: 'No. Applications must still use idempotency keys, reject unsafe replayable operations, and apply server-side anti-replay policy.',
    },
  ],
} as const;
