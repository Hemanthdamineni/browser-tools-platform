/**
 * Editorial content for the css-specificity-calculator tool page.
 *
 * Kept out of ``css-specificity-calculator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the (a,b,c) score means',
      body: 'Specificity is how the cascade breaks a tie between two rules that both match the same element: the more specific selector wins. This tool scores each selector you paste as an (a,b,c) triple, where a counts ID selectors, b counts classes, attribute selectors and pseudo-classes, and c counts type selectors and pseudo-elements. Scores are compared lexicographically — a single ID (0,1,0) always beats any number of classes — and the tool reports which of your selectors wins.',
    },
    {
      heading: 'When to check a selector',
      body: 'Reach for it when a style you wrote is not applying and you cannot see why, when you are about to add !important and want to know whether a more specific selector would do, or when reviewing a stylesheet whose rules were added over time and now fight each other. Paste the competing selectors one per line and the ranking shows the true winner.',
    },
    {
      heading: 'The Level 4 subtleties',
      body: 'The scorer follows Selectors Level 4. :not(), :is() and :has() contribute the specificity of their most specific argument rather than a fixed weight, so :is(#a, .b) counts as an ID. :where() always contributes zero, which makes it the right wrapper for low-priority defaults. Functional pseudo-elements and legacy single-colon pseudo-elements such as :before are counted in c.',
    },
    {
      heading: 'What is not part of the triple',
      body: 'Inline style attributes outrank any selector specificity, and !important declarations outrank normal ones regardless of the score — neither is folded into (a,b,c), and the tool flags them separately so you are not misled into thinking a bigger number will win. The explain option can be turned off if you only want the scores and the ranking.',
    },
    {
      heading: 'Your stylesheet stays here',
      body: 'Selectors are parsed and scored in this tab. Nothing is uploaded and no request is made, so you can paste selectors from a client stylesheet or an unreleased design system without exposing them.',
    },
  ],
  faq: [
    {
      q: 'How is the score calculated?',
      a: 'The (a,b,c) triple: a = ID selectors, b = classes, attributes and pseudo-classes, c = type selectors and pseudo-elements. Compare lexicographically — 0,1,0 beats 0,0,9.',
    },
    {
      q: 'How do :not(), :is() and :where() count?',
      a: 'Per Selectors Level 4, :not() and :is() contribute the specificity of their most specific argument (the pseudo-class itself adds nothing), while :where() always contributes zero.',
    },
    {
      q: 'Where do !important and inline styles fit?',
      a: 'They are not part of the (a,b,c) triple. Inline styles outrank any selector specificity, and !important declarations outrank normal ones regardless of specificity — both are noted separately in the output.',
    },
  ],
} as const;
