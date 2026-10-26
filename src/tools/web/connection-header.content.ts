/**
 * Editorial content for the connection-header tool page.
 *
 * Kept out of ``connection-header.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does hop-by-hop mean?',
      a: 'A hop-by-hop field applies only to the current connection and must not be blindly forwarded by proxies.',
    },
    {
      q: 'Can HTTP/2 or HTTP/3 send Connection?',
      a: 'No. Connection is prohibited in HTTP/2 and HTTP/3; use protocol-specific mechanisms instead.',
    },
    {
      q: 'Is Upgrade enough for WebSockets?',
      a: 'No. HTTP/1.1 WebSocket handshakes use Connection: Upgrade together with Upgrade: websocket and other handshake fields.',
    },
  ],
} as const;
