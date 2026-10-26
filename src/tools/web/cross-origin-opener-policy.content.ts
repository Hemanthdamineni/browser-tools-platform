/**
 * Editorial content for the cross-origin-opener-policy tool page.
 *
 * Kept out of ``cross-origin-opener-policy.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How the COOP checker reads a token',
      body: 'COOP is a single token rather than a list, so this tool matches the pasted value against the four defined policies and describes what it means. Analyze mode returns a one-row table with the normalised policy, a Valid verdict and a plain-language assessment; build mode echoes the token ready to paste into a header.',
    },
    {
      heading: 'When opener isolation matters',
      body: 'Reach for it when a popup could abuse window.opener, or when you are pursuing cross-origin isolation for SharedArrayBuffer and precise timers. Checking the token before shipping avoids the surprise of an OAuth or payment popup losing the reference back to the page that opened it.',
    },
    {
      heading: 'What the four values trade away',
      body: 'same-origin is the strict form, leaving the cross-origin document in a separate browsing context group so window.opener is severed. same-origin-allow-popups keeps popups the page opens working while isolating everything else. unsafe-none applies no isolation, and restrict-properties limits selected cross-origin window properties instead of cutting the relationship.',
    },
    {
      heading: 'One header is not cross-origin isolation',
      body: 'COOP governs browsing-context relationships only. Cross-origin isolation also needs a compatible Cross-Origin-Embedder-Policy. Values are matched case-insensitively, so Same-Origin normalises, while an unknown token is reported invalid with the accepted values listed.',
    },
    {
      heading: 'Described on this device',
      body: 'The token is compared and explained by code already in the page, with no request to a server, so a policy being drafted for an unreleased site stays private.',
    },
  ],
  faq: [
    {
      q: 'What does COOP isolate?',
      a: 'It controls whether a document shares a browsing context group with cross-origin windows, affecting window.opener relationships and popup communication.',
    },
    {
      q: 'Does COOP alone enable cross-origin isolation?',
      a: 'No. Cross-origin isolation commonly also requires compatible Cross-Origin-Embedder-Policy and resource headers.',
    },
    {
      q: 'What is the popup tradeoff?',
      a: 'same-origin is stricter, while same-origin-allow-popups preserves selected opener relationships but provides less isolation.',
    },
  ],
} as const;
