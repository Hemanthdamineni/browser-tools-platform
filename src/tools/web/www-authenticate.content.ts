/**
 * Editorial content for the www-authenticate tool page.
 *
 * Kept out of ``www-authenticate.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Reading and writing a 401 challenge',
      body: 'Parse mode takes one or more WWW-Authenticate challenges — the kind that appear on a 401 response — and lists each scheme with its auth parameters, so realm, scope, error and anything else come out as separate rows. Build mode emits a challenge string for the Basic or Bearer scheme from the realm, scope and error options.',
    },
    {
      heading: 'Debugging an authentication handshake',
      body: 'Use it when an API returns 401 and you want to read the terms the server offered, when you are writing a client and need to know exactly how a server formatted its challenge, or when producing the challenge your own service will return.',
    },
    {
      heading: 'Options',
      body: 'Mode chooses parse or build. In build mode, Scheme selects Basic or Bearer, Realm supplies the quoted realm value, and the optional Bearer scope and Bearer error parameters are added when non-empty. In parse mode the pasted text is what matters and the options are ignored.',
    },
    {
      heading: 'What it validates and what it does not',
      body: 'It checks that the scheme is a valid token, that parameters are well-formed quoted or token values, that a realm is not empty, and that no parameter repeats. It never handles passwords or tokens and never makes a request. Basic credentials over plain HTTP remain a serious problem — Base64 is encoding, not encryption — and the tool says so.',
    },
    {
      heading: 'Parsed without touching the network',
      body: 'Challenges are parsed in your browser and nothing is transmitted, so a header copied from a production 401 is safe to inspect here. It keeps working with no connection.',
    },
  ],
  faq: [
    {
      q: 'Does this validate credentials?',
      a: 'No. It only builds and parses challenge metadata. It never handles passwords, tokens, or network requests.',
    },
    {
      q: 'Is Basic authentication secure?',
      a: 'Basic credentials must be protected by HTTPS and appropriate server controls. Base64 is encoding, not encryption.',
    },
    {
      q: 'What is a Bearer scope?',
      a: 'It is a server-declared space-delimited scope hint for the requested authorization context. Exact meaning depends on the authorization system.',
    },
  ],
} as const;
