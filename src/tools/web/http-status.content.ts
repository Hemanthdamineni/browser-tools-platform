/**
 * Editorial content for the http-status tool page.
 *
 * Kept out of ``http-status.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'A lookup for codes and code names',
      body: 'Type a three-digit code for its official name and plain-language meaning, or a keyword such as teapot, redirect, rate limit or WebDAV to search both the name and the description. Leave the box empty to browse the whole registry, filtered by class with the Class option: 1xx to 5xx.',
    },
    {
      heading: 'Settling an argument about 418 and 451',
      body: 'Reach for it when a log line shows a code you half-remember, when an API returns 422 and you need to know whether that means malformed syntax or a semantic rejection, or when writing an error-handling table. Keyword search is what keeps it quick: "rate" finds 429, "gateway" finds both 502 and 504.',
    },
    {
      heading: 'How the Class option behaves',
      body: 'The class filter applies only when the input box is empty, exactly as its label says. Once you type a code or a keyword the search covers the whole list regardless of the setting, so you never get an empty result merely because the filter was left on 4xx.',
    },
    {
      heading: 'Caveats',
      body: 'The table holds the current IANA HTTP Status Code Registry plus RFC-defined extras such as 418 and 451. Codes that were never standardised — expired drafts and unregistered vendor extensions — are omitted. The meanings are the standard ones; a particular API may use a code differently.',
    },
    {
      heading: 'Looked up offline',
      body: 'The table is part of the page, so lookups are instant and local: no code or keyword is sent anywhere and the reference works with no connection — exactly what you want while debugging a network problem.',
    },
  ],
  faq: [
    {
      q: 'Which codes are missing from the list?',
      a: 'Codes that were never standardised (unregistered NGX extensions, drafts that expired) are omitted. Everything in the current IANA HTTP Status Code Registry is included.',
    },
    {
      q: 'Why does the class filter stop working when I type?',
      a: 'The Class option is documented as applying to the empty-input browse list only. As soon as you type a code or a keyword the search covers the whole registry, so a filter left on 4xx will not hide the 503 you searched for.',
    },
    {
      q: 'What is the difference between 401 and 403?',
      a: '401 Unauthorized means authentication is missing or has failed, so the client should supply or refresh credentials. 403 Forbidden means the client is known and simply not allowed, so retrying with the same credentials will not help. A 401 response is also the one that carries a WWW-Authenticate challenge.',
    },
  ],
} as const;
