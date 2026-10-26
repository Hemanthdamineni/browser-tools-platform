/**
 * Editorial content for the accept-patch tool page.
 *
 * Kept out of ``accept-patch.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the header advertises',
      body: 'An Accept-Patch response value tells a client which PATCH document formats the resource will accept, so a server that handles JSON Merge Patch might reply with application/merge-patch+json. Build mode turns a comma-separated list of media types into a clean header value, and analyze mode validates a pasted value and reports each type with its status.',
    },
    {
      heading: 'Media types and parameters',
      body: 'Each entry is checked as a real media type: the type and subtype tokens must be valid, and parameters after a semicolon need a token key and a value. Duplicate types and an overly broad */* wildcard are both flagged, because a capability that claims to accept everything deserves a second look.',
    },
    {
      heading: 'Capability is not authorization',
      body: 'Advertising a format is only a hint about what the endpoint can parse. Whether a given client is allowed to PATCH is still decided by authentication and authorization, so the tool notes this in its results rather than implying that listing a media type grants write access.',
    },
    {
      heading: 'Parsing happens locally',
      body: 'The header text is tokenised and validated entirely in this tab. No value is sent to a server, no request is made, and nothing is stored, so API capability values can be pasted in private.',
    },
  ],
  faq: [
    {
      q: 'Does Accept-Patch allow a client to PATCH?',
      a: 'No. It advertises supported document formats; authentication and authorization still control whether a PATCH request is accepted.',
    },
    {
      q: 'Where is Accept-Patch sent?',
      a: 'It is commonly sent in responses to advertise formats accepted by PATCH, including OPTIONS responses.',
    },
    {
      q: 'What happens for an unsupported format?',
      a: 'A server may reject the request with 415 Unsupported Media Type.',
    },
  ],
} as const;
