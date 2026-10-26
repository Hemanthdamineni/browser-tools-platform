/**
 * Editorial content for the proxy-authenticate tool page.
 *
 * Kept out of ``proxy-authenticate.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Build a challenge, or decode one',
      body: 'Build mode emits a Proxy-Authenticate header from the scheme and realm you choose, adding an optional Bearer scope, with values quoted and validated so the result is syntactically sound. Analyze mode splits pasted text into individual challenges — respecting commas that sit inside quotes — and lays out each scheme and its parameters as table rows.',
    },
    {
      heading: 'Why the realm is not optional in practice',
      body: 'A challenge without a realm is incomplete, because the realm is what tells a client which set of proxy credentials to send, so the analyzer flags its absence. It also reports parameters it does not recognise rather than quietly dropping them, which matters when a proxy offers something you have not seen before.',
    },
    {
      heading: 'Proxy auth is not origin auth',
      body: 'This header belongs in a 407 Proxy Authentication Required response from a forward proxy and applies only to the next hop. An origin server challenging the client uses WWW-Authenticate with 401 instead; confusing the two makes a browser collect credentials for the wrong party.',
    },
    {
      heading: 'Basic is encoding, not protection',
      body: 'Basic proxy credentials are merely Base64-encoded, so they look scrambled but reverse trivially — keep the connection on TLS and prefer a stronger scheme when the proxy supports one. Both the builder and the analyzer run locally, so the realms and scope strings you type never leave the page.',
    },
  ],
  faq: [
    {
      q: 'When is Proxy-Authenticate used?',
      a: 'A forward proxy can send it with 407 Proxy Authentication Required to request proxy credentials from the client.',
    },
    {
      q: 'Is it the same as WWW-Authenticate?',
      a: 'No. Proxy-Authenticate applies to the next proxy, while WWW-Authenticate challenges the origin server.',
    },
    {
      q: 'Is Basic safe over HTTP?',
      a: 'Basic credentials are only Base64-encoded. Use TLS and prefer stronger schemes where available.',
    },
  ],
} as const;
