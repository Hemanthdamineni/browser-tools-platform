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
  article: [
    {
      heading: 'What it validates',
      body: 'The tool walks the markup with a tag stack and reports, with a line number, every unclosed tag, every close with no matching open, an unexpected close that ends the wrong element, and a stray "<" that starts something unparseable. The result is a two-column table of line and issue, plus counts of tags and problems.',
    },
    {
      heading: 'Why tag balance is the check worth having',
      body: 'A single unclosed div is the classic reason a whole page suddenly lays out wrong, and it is easy to introduce and hard to spot in a long template. This validator pinpoints the line in seconds and deliberately avoids attribute-level nitpicking, so the one error that breaks rendering stands out.',
    },
    {
      heading: 'The rules it knows',
      body: 'The HTML void elements — area, br, col, embed, hr, img, input, link, meta, param, source, track, wbr — are treated as self-closing and need no separate close tag. Script, style, textarea and title contents are treated as raw text, so a "<" inside a script string is not mistaken for a tag. Comments and doctypes are recognised.',
    },
    {
      heading: 'What a passing result does not promise',
      body: 'This is structural well-formedness only. Attributes, ARIA rules, spec-mandated nesting and link validity are outside its scope, and a tidy document that parses can still be semantically invalid. It is the fast first check that catches the failure mode which breaks an entire page.',
    },
    {
      heading: 'Checked in the tab',
      body: 'The markup is scanned by a small local parser with no network access, so a draft page or a fragment under NDA can be pasted in safely. There is no upload and the tool works offline.',
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
