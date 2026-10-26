/**
 * Editorial content for the http-header-analyzer tool page.
 *
 * Kept out of ``http-header-analyzer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the HTTP header analyzer does',
      body: 'Paste a header block and every line is detected by name and parsed with the rules of that header. The table shows each header, its value, the interesting parts broken out, a status such as Valid, Review, Invalid, Deprecated or Generic, and a short assessment, so a whole response head can be checked in one pass.',
    },
    {
      heading: 'Checking a response you just captured',
      body: 'Use it when a proxy, a CDN or an API behaved unexpectedly and you want to know whether the headers are the reason. Pasting the raw head from curl shows at once whether a cache directive is stamped correctly, whether a timing or tracing header is malformed, and which headers are obsolete.',
    },
    {
      heading: 'Auto-detect or one named header',
      body: 'The header selector defaults to auto-detect, which analyses each pasted header with its own parser. Choosing a single header instead treats the whole input as that header value, which is useful for checking a bare value without the name. Include unknown headers keeps unrecognised lines in the table as Generic.',
    },
    {
      heading: 'Handling problems and long inputs',
      body: 'When a value fails validation, the default is to report it in the table and continue, so one bad header does not hide the rest; the alternative is to stop on the first error. A leading status or request line is skipped and any body after a blank line is ignored. Inputs over 100,000 characters are refused.',
    },
    {
      heading: 'Headers are parsed on your device',
      body: 'The pasted text is parsed inside the page: no request, no upload, no telemetry. The tool works offline, so a captured response that carries cookies or tracing identifiers is analysed without leaving your machine.',
    },
  ],
  faq: [
    {
      q: 'Which headers does it understand?',
      a: 'Thirty-two long-tail request and response headers — from Alt-Used and Tracestate to Server-Timing and X-Robots-Tag. Every other header is still checked against the generic HTTP field-value grammar and listed as Generic.',
    },
    {
      q: 'What do the statuses mean?',
      a: "Valid means the value matches the header's grammar, Review means it is usable but has something to flag, Invalid means the value cannot be used as-is, Deprecated means the header itself is obsolete, and Generic means there is no dedicated parser for it.",
    },
    {
      q: 'Does anything leave my device?',
      a: 'No. The pasted text is parsed in the page itself — there is no request, no upload and no telemetry.',
    },
    {
      q: 'Can it check a whole response?',
      a: 'Yes. Paste the raw response head, status line and body included: the status line and the body are ignored and only the headers are analyzed.',
    },
  ],
} as const;
