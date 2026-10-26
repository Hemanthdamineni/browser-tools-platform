import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-to-pug',
  name: 'HTML to Pug',
  category: 'developer',
  summary:
    'Convert HTML into Pug (formerly Jade) template syntax with shorthand selectors, attributes and indentation.',
  description:
    'Paste HTML and get equivalent Pug markup. Elements become indented selectors, id and class attributes collapse into #id and .class shorthand, remaining attributes keep their values, void elements stay self-contained, comments carry over as //-, and script/style/pre bodies become raw text blocks. Nested inline elements and mixed text are handled, with a warning for anything that cannot be represented exactly.',
  keywords: [
    'html to pug',
    'html to jade',
    'pug converter',
    'jade converter',
    'html to template',
    'pug generator',
    'convert html markup',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'indentWidth',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 2,
      min: 2,
      max: 8,
    },
    {
      key: 'quoteStyle',
      label: 'Attribute quote style',
      type: 'select',
      choices: [
        { value: 'double', label: 'Double quotes' },
        { value: 'single', label: 'Single quotes' },
      ],
      default: 'double',
    },
    {
      key: 'keepComments',
      label: 'Keep HTML comments',
      type: 'boolean',
      default: true,
    },
    {
      key: 'inlineText',
      label: 'Inline single text children',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A small card',
      input: '<div class="card"><h2 id="title">Hello</h2><p>Body text</p></div>',
    },
    {
      title: 'Nested menu with four-space indent',
      input:
        '<ul class="menu"><li><a href="/home">Home</a></li><li><a href="/about">About</a></li></ul>',
      options: { indentWidth: 4 },
    },
    {
      title: 'Single-quoted attributes, comments dropped',
      input:
        '<figure><img src="logo.png" alt="Logo"><figcaption>Mark</figcaption></figure><!-- old -->',
      options: { quoteStyle: 'single', keepComments: false },
    },
  ],
  related: ['html-to-jsx', 'html-to-markdown', 'html-prettifier', 'html-to-text'],
  status: 'stable',
};
