import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'html-validator',
  name: 'HTML Tag Validator',
  category: 'developer',
  summary:
    'Check tag balance and well-formedness: unclosed, mismatched, stray and unexpected tags, with line numbers.',
  description:
    'Validate that an HTML document is well-formed: every opening tag has a matching close, in the right order. Reports unclosed, stray, unexpectedly-closed and mismatched tags with the line where each problem is, and understands void elements (<img>, <br>…), self-closing syntax, comments, doctypes and raw text like <script> and <style>. On your device, with no network.',
  keywords: [
    'html validator',
    'validate html',
    'check html tags',
    'unclosed tag finder',
    'html tag balance',
    'html lint',
    'malformed html check',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'ignoreComments',
      label: 'Ignore unclosed comments',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'A small document',
      input:
        '<html>\n<head><title>T</title></head>\n<body>\n  <p>Hi</p>\n  <img src="x.png">\n</body>\n</html>',
    },
    {
      title: 'A forgotten closing tag',
      input: '<div>\n  <p>Hello\n</div>',
    },
    {
      title: 'Mismatched nesting',
      input: '<ul>\n  <li>One\n  <li>Two\n</ul>',
    },
  ],
  related: ['html-prettifier', 'html-to-text', 'html-to-markdown', 'markdown-to-html'],
  status: 'stable',
};
