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
      input: '<html>\n<head><title>T</title></head>\n<body>\n  <p>Hi</p>\n  <img src="x.png">\n</body>\n</html>',
    },
  ],
  faq: [
    {
      q: 'What does it actually check?',
      a: 'Tag balance: every opening tag is matched by a close of the same name in the right order, comments and doctypes are well-formed, and stray "<" or unknown constructs are caught. It does not check attributes, nesting rules of the spec, or link validity.',
    },
    {
      q: 'Which tags are “void”?',
      a: 'The HTML void elements (area, br, col, embed, hr, img, input, link, meta, param, source, track, wbr) are treated as self-closing by spec — they do not need, and must not have, a separate closing tag. Script, style, textarea and title contents are treated as raw text.',
    },
    {
      q: 'Is a passing result proof the page renders?',
      a: 'No — this is structural well-formedness only. A tidy parser-parseable document can still have broken attributes or invalid nesting; those need further tools. This catches the common “unclosed tag breaks the whole page” failure fast.',
    },
  ],
  related: ['html-prettifier', 'html-to-text', 'html-to-markdown', 'markdown-to-html'],
  status: 'stable',
};
