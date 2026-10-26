import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-prettifier',
  name: 'HTML Prettifier',
  category: 'web',
  summary:
    'Beautify HTML output — indented tags, one attribute per line for long tags, preserved text.',
  description:
    'Format a chunk of HTML into nicely indented, readable markup without altering tag names, attributes, or text content. Inline elements without figurative whitespace are kept on one line when they fit, and long opening tags have their attributes unbundled vertically. Comments, CDATA, and <pre> content are never re-indented, so meaningful whitespace is preserved. Runs entirely in the browser on your device.',
  keywords: [
    'html format',
    'html beautify',
    'prettify html',
    'html prettifier',
    'html formatter',
    'beautify markup',
    'indent html',
    'html tag reformatter',
    'tidy html online',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'indent',
      label: 'Indent width (spaces)',
      type: 'number',
      default: 2,
      min: 0,
      max: 8,
    },
    {
      key: 'inlineMax',
      label: 'Max width before attributes wrap',
      type: 'number',
      default: 80,
      min: 40,
      max: 200,
    },
    {
      key: 'prettyComments',
      label: 'Re-indent comments',
      type: 'boolean',
      default: false,
    },
    {
      key: 'tabs',
      label: 'Use tabs for indent',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Indent a snippet',
      input: '<div class="hero"><h1>Hello</h1><p>World</p></div>',
    },
    {
      title: 'Keep pre and comments',
      input: '<pre>  keep\n  this\n</pre><div style="color:red">x</div>',
    },
    {
      title: 'Tabs with a wide wrap point',
      input: '<ul><li><a href="/a">Alpha</a></li><li><a href="/b">Beta</a></li></ul>',
      options: { indent: 1, tabs: true, inlineMax: 120 },
    },
  ],
  related: ['html-to-text', 'html-to-markdown', 'html-entities', 'markdown-link-checker'],
  status: 'stable',
};
