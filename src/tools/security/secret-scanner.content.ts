/**
 * Editorial content for the secret-scanner tool page.
 *
 * Kept out of ``secret-scanner.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Patterns and assignments',
      body: 'The scanner looks for two kinds of signal. Named patterns match recognisable shapes such as GitHub tokens, AWS access key IDs, Google and Stripe keys, JWTs and PEM private-key headers. A second, broader pass finds assignment-looking lines where the key name hints at a secret — password, token, api_key, client_secret, access_key — and the value looks long enough to be one.',
    },
    {
      heading: 'Report or redact',
      body: 'In report mode each finding is listed with its type, a masked preview, and a line and column so you can jump straight to the spot. Redact mode replaces every detected span in the output with a placeholder, producing a cleaned copy you can paste into a ticket or log without leaking the value.',
    },
    {
      heading: 'Heuristics, not guarantees',
      body: 'Detection is heuristic. An unusual token format can be missed entirely, and a string that merely resembles a secret can be flagged by mistake. The minimum-length control tunes how eager the generic assignment detector is, and the private-key rule catches headers rather than the surrounding text.',
    },
    {
      heading: 'Scanned on your machine',
      body: 'The scan runs in your browser over the text you paste, and no network request is made. The masked previews are computed locally, so nothing that could be a real credential is ever transmitted or logged.',
    },
  ],
  faq: [
    {
      q: 'Can this prove that text contains no secrets?',
      a: 'No. The scanner uses heuristics and known token shapes; it can miss unfamiliar formats or produce false positives. Review results and use your organization’s secret-scanning controls for source repositories.',
    },
    {
      q: 'Are detected values shown in the report?',
      a: 'No. The report includes only a short masked preview, type, and line/column. Redaction mode replaces detected spans in the text output.',
    },
    {
      q: 'Is the input uploaded?',
      a: 'No. Scanning runs in your browser and makes no network requests.',
    },
  ],
} as const;
