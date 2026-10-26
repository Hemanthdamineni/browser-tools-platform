/**
 * Editorial content for the cross-origin-resource-policy tool page.
 *
 * Kept out of ``cross-origin-resource-policy.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What CORP is for',
      body: 'Cross-Origin-Resource-Policy is a response header that tells a browser which origins are allowed to load a resource from another origin. It is a loading policy rather than a reading policy: same-origin stops every cross-origin page from loading the resource, same-site permits pages on related sites such as the www and API variants of one domain, and cross-origin makes the resource freely embeddable. The tool takes one of those three values and explains the choice in plain terms, so you can decide what a given asset should allow before you set the header.',
    },
    {
      heading: 'Analyze versus build',
      body: 'In build mode the value picker produces the finished header line and saves it as cross-origin-resource-policy.txt, with the choice echoed in the stats. In analyze mode you paste whatever value a server is currently sending — from a response header, a security scan or a CDN config — and the tool normalises it, says whether it is a valid CORP value, and reports the assessment, so a typo like same-origin; or SameSite is called out as invalid instead of being copied onward. Any value that is not exactly one of the three is rejected with the list of acceptable options.',
    },
    {
      heading: 'The trade-off between isolation and functionality',
      body: 'A strict policy protects a resource from being embedded by pages that do not own it, which blocks the side channels that spectre-style attacks exploit when combined with cross-origin isolation headers such as COEP. But the same restriction can break legitimate embedding — a payment iframe from another origin, a CDN-hosted image used by many sites — which is why cross-origin is the deliberate choice for assets meant to be shared. The assessment for cross-origin says so explicitly, because a broad policy is usually a decision, not a default.',
    },
    {
      heading: 'What it does not do and where it runs',
      body: 'CORP controls loading, not reading: whether a script may read the bytes of a cross-origin response is CORS’s job, and the note says to configure CORS separately when both are needed. The check is a small local validation of the text you type or the value you pick — nothing is fetched, no live response is probed, and no request leaves the page, so you can use it as a reference while configuring a server or a service worker.',
    },
  ],
  faq: [
    {
      q: 'What does CORP protect?',
      a: 'It lets a resource declare which origins may load it in cross-origin contexts, reducing unwanted reads or embeddings in supported browsers.',
    },
    {
      q: 'Which value is strictest?',
      a: 'same-origin is strictest, same-site permits related sites, and cross-origin permits broad embedding.',
    },
    {
      q: 'Does CORP replace CORS?',
      a: 'No. CORP controls loading/embedding policy, while CORS controls whether scripts may read cross-origin responses.',
    },
  ],
} as const;
