/**
 * Editorial content for the http-request-builder tool page.
 *
 * Kept out of ``http-request-builder.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The wire request, not a client',
      body: 'Choose a method from the seven supported verbs, type an absolute or relative URL, add optional headers one per line and a body, and the tool returns the raw HTTP/1.1 message — request line, headers, blank line and body — as text to copy. It renders a request; it does not fire anything over the network.',
    },
    {
      heading: 'When hand-rolling a request makes sense',
      body: 'Use it to reproduce a request for a socket client, netcat, a debugging proxy or a raw TCP repl, or to capture exactly what your server will see on the wire. For building a fetch or curl command you would reach for curl-to-fetch or curl-to-code instead, since those produce code, not bytes.',
    },
    {
      heading: 'How Host and Content-Length get filled',
      body: 'A Host header is derived from the URL origin when the option is on and you have not supplied one; switching it off drops the header entirely. Content-Length is computed from the encoded body bytes when a body is present, the method is not GET or HEAD, and you have not defined it — both can be overridden with your own header lines.',
    },
    {
      heading: 'Edge cases worth knowing',
      body: 'URLs are capped at two hundred thousand characters, and only GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS are accepted. A relative path keeps your own Host header when you supply one. Line endings in the body are normalised to CRLF so the emitted message is byte-accurate for most servers.',
    },
    {
      heading: 'Requests are built, not sent',
      body: 'Everything happens on this device — no request is transmitted, nothing is logged and the composed text is yours to copy.',
    },
  ],
  faq: [
    {
      q: 'What exactly do I get?',
      a: 'A raw HTTP/1.1 message: the request line (METHOD path?query HTTP/1.1), headers, an empty line, and the body. Suitable for debugging proxies, socket tools and netcat.',
    },
    {
      q: 'How are Host and Content-Length handled?',
      a: 'Host is taken from the URL origin unless you already define it; Content-Length is set from the body bytes when present (both can be overridden or disabled with the options).',
    },
    {
      q: 'Is this the same as a code generator?',
      a: 'No — this emits the raw wire-format request text. Tools like curl-to-fetch or curl-to-code generate programming-language snippets instead.',
    },
  ],
} as const;
