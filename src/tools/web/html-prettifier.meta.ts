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
  ],
  faq: [
    {
      q: 'Is the output semantically identical to the input?',
      a: 'Yes. The formatter only changes whitespace between tokens (and never inside a <pre> element). Tag names, attributes, quoted values, comments and character references are copied as-is.',
    },
    {
      q: 'Can it parse HTML perfectly?',
      a: 'No parser handles every malformed document. Unknown tags, unmatched brackets and weird inline content are normalized conservatively; the formatter is designed to fail gracefully and never throw for malformed markup.',
    },
    {
      q: 'Does it minify?',
      a: 'No, it does the opposite. There is nothing removed and no attribute reordered. Use it to make inline messy markup human-readable again.',
    },
  ],
  related: ['html-to-text', 'html-to-markdown', 'html-entities', 'markdown-link-checker'],
  status: 'stable',
};
