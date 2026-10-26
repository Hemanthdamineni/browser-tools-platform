/**
 * Editorial content for the clear-site-data tool page.
 *
 * Kept out of ``clear-site-data.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the Clear-Site-Data analyser reports',
      body: 'Paste quoted targets such as "cookies", "storage" and "cache" and the analyser returns a table with each target, a Valid or Invalid verdict and the scope it wipes. Build mode takes the same comma-separated list, checks it and prints the joined header value ready to copy into a response.',
    },
    {
      heading: 'Planning what a logout should clear',
      body: 'This is for the response that follows a sign-out or account reset, where the browser should drop stored data instead of leaving a half-authenticated session behind. Cookies and storage cover the usual case; add cache when a service worker or cached HTML would otherwise resurface.',
    },
    {
      heading: 'Quoting, duplicates and the wildcard',
      body: 'Targets are compared case-insensitively against a fixed set, so an unquoted cookies is reported as invalid. Duplicate entries are flagged, and pairing the * wildcard with another target is called out as redundant because the wildcard already requests every supported type. Build mode refuses an empty list.',
    },
    {
      heading: 'What the browser will actually do',
      body: 'The header is honoured only on secure responses, and it affects the origin that sent it rather than third-party data. A target the browser does not implement may simply be ignored, which is why unsupported names are marked Invalid instead of being guessed at.',
    },
    {
      heading: 'Parsed inside this tab',
      body: 'The splitter and validator are plain page code: the header text you paste is inspected in the browser and never sent to a server, and the tool works with the network disabled.',
    },
  ],
  faq: [
    {
      q: 'When is Clear-Site-Data used?',
      a: 'Commonly on logout or account-reset responses to ask the browser to clear cookies, storage, or cache for the site.',
    },
    {
      q: 'What does the wildcard clear?',
      a: 'The * target requests clearing all supported data types; browsers that do not support a type may ignore it.',
    },
    {
      q: 'Does it work over plain HTTP?',
      a: 'No. Browsers require the response to be secure (HTTPS) and typically apply it only to the secure origin context.',
    },
  ],
} as const;
