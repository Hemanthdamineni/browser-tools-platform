/**
 * Editorial content for the security-headers tool page.
 *
 * Kept out of ``security-headers.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it reviews',
      body: 'Paste a raw HTTP response header block — the status line is optional and is recognised and reported back — and the tool checks six areas: Content-Security-Policy, Strict-Transport-Security, framing protection (X-Frame-Options or CSP frame-ancestors), X-Content-Type-Options, Referrer-Policy and Permissions-Policy. Each is marked Present, Missing or Review, with a sentence explaining what it found, why it might matter and what to look at next.',
    },
    {
      heading: 'Why a finding says "Review"',
      body: 'Header values are contextual, so several checks are written to prompt rather than pass or fail. A CSP containing ’unsafe-inline’, ’unsafe-eval’ or a wildcard source is flagged even though the header exists; HSTS with a max-age under 180 days is flagged; X-Frame-Options is accepted only as DENY or SAMEORIGIN; and a Referrer-Policy of unsafe-url or no-referrer-when-downgrade is called out as potentially over-sharing. The checks also note duplicate header names, since repeats are often a proxy misconfiguration.',
    },
    {
      heading: 'How to use it well',
      body: 'This is the fastest way to spot missing protections on a response you already captured in your browser’s devtools or curl. It is a review aid, not a scanner: it analyses only the text you paste and cannot confirm which headers a live server actually sends, so pair it with a real request and your application’s own testing before changing production settings.',
    },
    {
      heading: 'Limits and privacy',
      body: 'Header configuration depends on your deployment, your framework and browser support, so a clean table here is not a security guarantee and a flagged item is not automatically a bug. The analysis is purely local: no request is made to any host and nothing is uploaded, so you can paste headers from an internal service without exposing the domain.',
    },
  ],
  faq: [
    {
      q: 'Does this scan a website?',
      a: 'No. Paste response headers yourself. The tool never makes a network request and cannot verify which headers a live server actually sends.',
    },
    {
      q: 'Does a passing result mean my site is secure?',
      a: 'No. This is a narrow, heuristic review of selected response headers. Security depends on application behavior, deployment, browser support, and many other controls.',
    },
    {
      q: 'Why might a header be marked for review?',
      a: 'Some policies depend on context. For example, HSTS should only be sent over HTTPS and CSP needs to match the resources your application actually uses. Read the suggestions before changing production settings.',
    },
  ],
} as const;
