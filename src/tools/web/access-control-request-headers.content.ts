/**
 * Editorial content for the access-control-request-headers tool page.
 *
 * Kept out of ``access-control-request-headers.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Reading and writing the OPTIONS request',
      body: 'Analyze mode takes a pasted preflight header block and reports, header by header, what it means: the Access-Control-Request-Method token is checked against the method grammar, the Access-Control-Request-Headers list is split into field names with any forbidden or malformed name flagged, and an Origin of null is called out. Build mode does the reverse.',
    },
    {
      heading: 'Working out why a cross-origin call is blocked',
      body: "It is for the moment a fetch from your app to another origin fails in the console. Paste the OPTIONS request headers from the network panel to see exactly which field names the browser asked for, then check that the server's Access-Control-Allow-Headers echoes them — a missing entry there is a common cause of preflight failure.",
    },
    {
      heading: 'Options',
      body: 'Mode selects Analyze or Build. In Build mode, Method and Request headers produce the block, with the method upper-cased and each requested header name validated as an HTTP token. In Analyze mode the options are ignored.',
    },
    {
      heading: 'What it will flag',
      body: 'Forbidden request headers such as Cookie, Host, Origin and Content-Length cannot be listed in a preflight and are reported as errors, along with malformed tokens and duplicate Access-Control-Request-Headers lines. Safelisted methods such as GET and POST are noted as needing no preflight. The tool reads request headers only, so a clean analysis is not a promise the real request will succeed.',
    },
    {
      heading: 'Analysed offline',
      body: 'Pasted headers are parsed in your browser, no request is made to any origin and nothing is uploaded. That makes it safe for internal hostnames and for debugging a production API without generating traffic.',
    },
  ],
  faq: [
    {
      q: 'When is a preflight sent?',
      a: 'For requests that are not simple — non-safelisted methods (PUT, PATCH, DELETE) or non-safelisted headers — the browser sends an OPTIONS preflight first, and proceeds only if the response allows it.',
    },
    {
      q: 'What do the two headers mean?',
      a: 'Access-Control-Request-Method states the method the real request will use; Access-Control-Request-Headers lists the custom headers it will send.',
    },
    {
      q: 'How do I read this vs Allow-* ?',
      a: 'The server must echo back Access-Control-Allow-Methods/Headers covering those requested values; otherwise the browser blocks the real request.',
    },
  ],
} as const;
