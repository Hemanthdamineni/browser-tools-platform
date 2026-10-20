import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'css-specificity-calculator',
  name: 'CSS Specificity Calculator',
  category: 'developer',
  summary: 'Score a CSS selector\'s specificity (a,b,c) and see which rule wins between competing selectors.',
  description:
    'Paste one or more CSS selectors to get their specificity as an (a,b,c) triple and a comparison rank. The calculator follows the CSS Selectors Level 4 rules: ID selectors count for a, classes, attributes and pseudo-classes for b, and type selectors and pseudo-elements for c, with :not()/:is()/:has() taking the specificity of their most specific argument and :where() counting as zero. Inline styles and !important are reported separately.',
  keywords: [
    'css specificity calculator',
    'css specificity',
    'selector specificity',
    'css selector weight',
    'which css rule wins',
    'css cascade',
    'specificity score',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'showExplanation',
      label: 'Explain each selector',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A common specificity clash',
      input: '#nav .item:hover\nnav ul li a',
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
  related: ['css-units', 'css-minifier', 'css-grid', 'color-contrast'],
  status: 'stable',
};
