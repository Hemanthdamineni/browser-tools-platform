/**
 * Editorial content for the upgrade-header tool page.
 *
 * Kept out of ``upgrade-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Does Upgrade alone switch protocols?',
      a: 'No. HTTP/1.1 also requires Connection: Upgrade, and the server must accept the switch with the appropriate response such as 101 Switching Protocols.',
    },
    {
      q: 'Can HTTP/2 use Upgrade?',
      a: 'Extended CONNECT is used for many HTTP/2 protocol tunnels; the HTTP/1.1 Upgrade mechanism is not generally available. HTTP/3 has similar constraints.',
    },
    {
      q: 'Does this test a WebSocket server?',
      a: 'No. It validates the header value locally and never opens a network connection.',
    },
  ],
} as const;
