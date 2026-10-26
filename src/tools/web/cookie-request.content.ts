/**
 * Editorial content for the cookie-request tool page.
 *
 * Kept out of ``cookie-request.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Parse a request header into pairs',
      body: 'Paste a Cookie request header, with or without the "Cookie:" prefix, and the tool splits it on semicolons into name/value pairs, each with a status of Valid, Duplicate or Invalid. Values are percent-decoded for display, so %20 becomes a space, and the stats report how many pairs, how many duplicates and whether any percent-encoding was present.',
    },
    {
      heading: 'The semicolon rule and quoted values',
      body: 'The delimiter is the semicolon, but double-quoted strings are honoured, so a value like theme="a;b" stays whole. A pair with no equals sign gets an empty name and is marked Invalid with a message saying a cookie pair needs the name=value form. Decoding turns each %XX into the byte it names and leaves plainly written text alone.',
    },
    {
      heading: 'Build mode goes the other way',
      body: 'Build takes name=value pairs separated by commas or semicolons and reassembles a single Cookie header joined with "; ". It flags an empty name and detects duplicate names case-insensitively, since a header naming the same cookie twice is broken in practice: a server or proxy normally keeps only the last occurrence.',
    },
    {
      heading: 'Local and unread',
      body: 'Parsing and building run entirely in this tab. Cookies often carry session tokens, so it matters that nothing here is uploaded, logged or sent to a server, and the page makes no request while you work.',
    },
  ],
  faq: [
    {
      q: 'How are cookies delimited?',
      a: 'The request-header uses semicolons between pairs and an = between name and value. Quoted values can contain semicolons.',
    },
    {
      q: 'Should I percent-decode values?',
      a: 'Values may be percent-encoded (e.g. space as %20); decoding shows the real value but encoded form is what compares for use.',
    },
    {
      q: 'Are duplicate names allowed?',
      a: 'Broken; only the last name in the HTTP header would normally survive. Servers should treat repeats as an anomaly, and proxies rarely tolerate them.',
    },
  ],
} as const;
