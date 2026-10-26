/**
 * Editorial content for the cors-headers tool page.
 *
 * Kept out of ``cors-headers.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'One tool for the whole Access-Control-* family',
      body: 'CORS is a set of response headers, and getting one wrong usually surfaces as an opaque browser error. This tool covers them all: Allow-Origin, Allow-Credentials, Allow-Methods, Allow-Headers, Expose-Headers and Max-Age. Build mode emits the ones you need as copyable lines; analyze mode reads a pasted response and tells you what each header permits and which values are invalid.',
    },
    {
      heading: 'Building a policy',
      body: 'Pick a target — a full policy or a single header — and fill the values in. The origin field takes * or one full http(s) origin, not a list, because the header itself carries a single value. Methods and headers are comma-separated lists validated as HTTP tokens. The output is a set of header lines with notes, such as the reminder to add Vary: Origin when the origin is chosen per request.',
    },
    {
      heading: 'The wildcard-with-credentials trap',
      body: 'The most common CORS mistake is combining Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true. That combination is forbidden: once credentials are allowed, the origin must name the specific caller and cannot be a wildcard, and the same applies to * in Allow-Methods, Allow-Headers and Expose-Headers. The builder refuses to emit the bad combination and the analyzer flags it.',
    },
    {
      heading: 'Analyzing an existing response',
      body: 'Paste the raw header lines from a devtools panel and each recognised header becomes a row with its value, a Valid or Invalid status and a plain-English assessment. Duplicate lines, malformed tokens and a wildcard used with credentials are called out. A bare number falls back to a Max-Age check and any other bare string to an Allow-Origin check, so a single value is easy to verify.',
    },
    {
      heading: 'Checked on your device',
      body: 'Validation and generation are pure string handling in this tab — no request is sent, so a real origin list or an internal hostname stays private. The tool needs no network at all.',
    },
  ],
  faq: [
    {
      q: 'Can Access-Control-Allow-Origin be * with credentials?',
      a: 'No. When Access-Control-Allow-Credentials: true is set, the allowed origin must name the specific requesting origin and cannot be a wildcard.',
    },
    {
      q: 'Why add Vary: Origin?',
      a: 'If the allowed origin is chosen per request, Vary: Origin stops caches serving one caller the origin grant meant for another.',
    },
    {
      q: 'Which methods trigger a preflight?',
      a: 'GET, HEAD, and POST with simple headers are sent directly; most other methods and headers trigger an OPTIONS preflight answered with Allow-Methods and Allow-Headers.',
    },
  ],
} as const;
