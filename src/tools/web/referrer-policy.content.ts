/**
 * Editorial content for the referrer-policy tool page.
 *
 * Kept out of ``referrer-policy.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Building or dissecting the header',
      body: 'Build mode turns the chosen policy token into a usable Referrer-Policy value and reports how many tokens it contains and which one is effective. Analyze mode takes a pasted value — including a comma-separated fallback list — and returns a table of Policy, Status (Valid or Invalid) and Behaviour for each token, with its issues in the notes.',
    },
    {
      heading: 'Auditing how much URL you leak',
      body: 'Use it when you are adding security headers and want to know exactly which Referer a browser will send in each case, when a third-party analytics vendor needs more referrer detail than your current policy allows, or when a penetration-test report flags referrer leakage and you need the tightest policy that still works.',
    },
    {
      heading: 'Options',
      body: 'Mode picks analyze or build, and Policy selects one of the eight standard tokens for build mode. Build mode refuses to emit a value it would itself flag, so unsafe-url cannot be produced through the builder without the tool telling you why it is risky.',
    },
    {
      heading: 'What the checks look for',
      body: 'Unknown tokens are marked Invalid, duplicates are called out, unsafe-url is flagged because it sends full URLs cross-origin, and no-referrer-when-downgrade is flagged as the legacy default that leaks more than modern policies. The effective token is the last one a browser recognises. The tool explains the header but never fetches your site.',
    },
    {
      heading: 'Analysed in your tab',
      body: 'The value is parsed locally and nothing is uploaded, so you can check a header from an internal or pre-release site without exposing it. It works offline.',
    },
  ],
  faq: [
    {
      q: 'What is the recommended default?',
      a: 'strict-origin-when-cross-origin is the common recommendation: it sends origins on cross-origin requests and full URLs same-origin.',
    },
    {
      q: 'Why list multiple policies?',
      a: 'The browser applies the last supported token, so a list can express a preferred policy with fallbacks for older browsers.',
    },
    {
      q: 'Why is unsafe-url risky?',
      a: 'It sends full URLs, potentially including paths, queries, or tokens, on cross-origin requests.',
    },
  ],
} as const;
