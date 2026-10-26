/**
 * Editorial content for the content-security-policy tool page.
 *
 * Kept out of ``content-security-policy.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What this CSP tool builds and checks',
      body: 'This tool builds or analyzes Content-Security-Policy response values. Analyze mode returns a table of each directive, its sources and a valid or review status, plus issues such as unknown or duplicate directives, a missing default-src, broad wildcard sources and the unsafe keywords. Build mode joins the filled directive fields into a policy string.',
    },
    {
      heading: 'When to build or audit a policy',
      body: 'Reach for it when writing a policy from scratch, or auditing one a colleague or a scanner handed you. Build mode stands up a strict first policy quickly; analyze mode flags a policy that leans on unsafe-inline or opens a wildcard you meant to avoid.',
    },
    {
      heading: 'The mode switch and the directive fields',
      body: 'Mode chooses analyze or build. In build mode the source fields for default-src, script-src, style-src, img-src, connect-src, frame-ancestors and object-src are assembled, each trimmed and skipped when blank. The tool refuses to build an empty policy or one that trips its own analyzer.',
    },
    {
      heading: 'What the analyzer flags',
      body: 'The analyzer recognises a fixed set of known directives and reports anything else as unknown. A missing default-src is flagged because unlisted directives would have no fallback, duplicate directives are reported because later ones override earlier ones, and unsafe-inline or unsafe-eval weaken the directive they appear on.',
    },
    {
      heading: 'Where the policy is parsed',
      body: 'The policy is parsed and rendered entirely in your browser. Nothing is sent to a server, no request is made, and the analysis keeps working offline.',
    },
  ],
  faq: [
    {
      q: 'What does CSP protect against?',
      a: 'It constrains which resources a page may load (and where scripts may run), reducing XSS and data-injection risk when configured correctly.',
    },
    {
      q: 'Is unsafe-inline always bad?',
      a: 'unsafe-inline weakens CSP for the relevant directive. Use nonces or hashes when you need inline scripts or styles.',
    },
    {
      q: 'What is report-only mode?',
      a: 'Content-Security-Policy-Report-Only reports violations without enforcing them, which is the recommended way to test a policy before roll-out.',
    },
  ],
} as const;
