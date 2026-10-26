/**
 * Editorial content for the request-id tool page.
 *
 * Kept out of ``request-id.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Generating an ID to send',
      body: 'Generate mode creates a random value with the browser crypto API and prints it as a ready-to-send header line. Choose a UUID v4 for full 128-bit entropy or a shorter 16-hex-digit token, then pick the header name it should appear under.',
    },
    {
      heading: 'Validating an incoming value',
      body: 'Analyze mode judges a pasted value as a UUID, a 16-char hex token, or a custom ID and reports its length. Values shorter than eight characters or filled with odd symbols are flagged, and anything past 128 characters is warned about as bloating logs and headers.',
    },
    {
      heading: 'Choosing a header name',
      body: 'X-Request-ID, X-Correlation-ID and X-Trace-Id are all offered in the picker; the chosen name is echoed in the generated header and recorded in the analysis table.',
    },
    {
      heading: 'Making the ID actually useful',
      body: 'The generated or analysed value is only correlation if the server echoes it back and your logs capture it alongside the route and timestamp. Without that wiring, an ID is just a random string.',
    },
    {
      heading: 'Generated on your device',
      body: 'Randomness comes from the browser crypto API and every step runs locally. No ID is uploaded and the tool makes no network call.',
    },
  ],
  faq: [
    {
      q: 'Why use a request ID?',
      a: 'It lets you correlate a single user request across proxies, services, and logs, making failures far easier to trace.',
    },
    {
      q: 'What is a good format?',
      a: 'A UUIDv4 (or a 128-bit random token) is a strong choice: high entropy, collision-resistant, widely understood.',
    },
    {
      q: 'Should the server echo it?',
      a: 'Yes — return the same ID in the response header and include it in your structured logs for end-to-end correlation.',
    },
  ],
} as const;
