import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'css-specificity-calculator',
  name: 'CSS Specificity Calculator',
  category: 'developer',
  summary:
    "Score a CSS selector's specificity (a,b,c) and see which rule wins between competing selectors.",
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
    {
      title: 'Pseudo-class versus attribute',
      input: 'a[href^="https"]\na.external',
      options: { showExplanation: true },
    },
    {
      title: 'Where beats is',
      input: ':where(#main) p\n:is(#main) p',
    },
  ],
  related: ['css-units', 'css-minifier', 'css-grid', 'color-contrast'],
  status: 'stable',
};
