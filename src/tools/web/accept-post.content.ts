/**
 * Editorial content for the accept-post tool page.
 *
 * Kept out of ``accept-post.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the Accept-Post tool does',
      body: 'Paste a comma-separated list of media types and it validates each one against the HTTP media-type grammar, flags duplicates and wildcards, and reports a verdict per type. In build mode you supply the types and get back a clean header value such as application/json, application/x-www-form-urlencoded, ready to paste into an OPTIONS response.',
    },
    {
      heading: 'Documenting what a resource accepts',
      body: 'Use it when you run a POST endpoint and want to advertise which document formats it will take. Building the value here keeps it consistent and flags a typo before it reaches your API description, while analyze mode is for reading a value you were sent or are about to test.',
    },
    {
      heading: 'The two modes',
      body: 'Build mode constructs a header from the media types option and errors on the first invalid entry, so you always get a usable result. Analyze mode inspects whatever you paste, breaking each media type into major and minor token plus parameters, and judging validity without changing your text.',
    },
    {
      heading: 'What the check notices',
      body: 'A media type must have both a major and a minor token using HTTP token characters. Duplicate types are flagged, and a bare wildcard is called out because it advertises every media type at once. A parameter key must be a valid token and carry a value. The verdict is only about syntax, not what your server really accepts.',
    },
    {
      heading: 'Your media types stay local',
      body: 'Validation and building happen in the page, with nothing sent over the network and no request made. The tool works offline, so a list of formats for an unreleased API stays on your machine.',
    },
  ],
  faq: [
    {
      q: 'Does Accept-Post authorize a client?',
      a: 'No. It advertises supported document formats; authentication and authorization still determine whether a POST is allowed.',
    },
    {
      q: 'Where is Accept-Post useful?',
      a: 'It can describe formats accepted by a resource, commonly in OPTIONS responses or API capability discovery.',
    },
    {
      q: 'What happens for an unsupported format?',
      a: 'A server may reject the request with 415 Unsupported Media Type.',
    },
  ],
} as const;
