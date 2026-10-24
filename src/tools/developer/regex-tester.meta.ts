import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'regex-tester',
  name: 'Regex Tester',
  category: 'developer',
  summary:
    'Test a JavaScript regular expression against text — highlight, list matches, replace or split.',
  description:
    'Run a JavaScript (ECMAScript) regular expression against your input. See every match with its capture groups and index, wrap matches in markers, apply a replacement with $1/$<name> references, or split the text on the pattern.',
  keywords: [
    'regex',
    'regexp',
    'regular expression',
    'regex tester',
    'pattern match',
    'capture group',
    'find and replace',
    'split',
    'javascript regex',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'pattern',
      label: 'Pattern',
      type: 'text',
      default: '',
      placeholder: '\\b\\w+\\b',
      help: 'The regular expression source, without slashes. Required.',
    },
    {
      key: 'flags',
      label: 'Flags',
      type: 'text',
      default: 'gm',
      placeholder: 'gm',
      help: 'Any combination of g i m s u y.',
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'matches',
      choices: [
        { value: 'highlight', label: 'Highlight matches (<<…>>)' },
        { value: 'matches', label: 'List matches (table)' },
        { value: 'replace', label: 'Replace' },
        { value: 'split', label: 'Split' },
      ],
    },
    {
      key: 'replacement',
      label: 'Replacement',
      type: 'text',
      default: '$&',
      placeholder: '$1',
      help: 'Supports $& (whole match), $1 and $<name> back-references.',
      showWhen: { key: 'mode', value: 'replace' },
    },
  ],
  article: [
    {
      heading: 'Four ways to run one pattern',
      body: 'Give it a JavaScript regular expression — source plus flags — and it either lists the matches or transforms the text. List matches returns a table of match number, matched text, a JSON object of capture groups, and the match index. Highlight wraps each match in <<...>>. Replace applies your replacement with $&, $1 and $<name> references. Split cuts the text on the pattern and puts each piece on its own line.',
    },
    {
      heading: 'Debugging a pattern before it ships',
      body: 'Use it to find out why a validation regex rejects a real input, to check exactly what a capture group grabs before wiring it into a parser, or to preview a bulk find-and-replace. The index column often reveals an unintended greedy match.',
    },
    {
      heading: 'Options that change the answer',
      body: 'Pattern is the regex source without slashes and is required. Flags accepts any combination of g, i, m, s, u and y, each at most once. Mode selects the four behaviours, and Replacement only applies in Replace mode, where $& stands for the whole match. In highlight and list modes a global flag is added automatically.',
    },
    {
      heading: 'Caveats',
      body: "This is the browser's own ECMAScript engine, so it differs from PCRE, Python and Go in the corners. A zero-length match is highlighted as itself rather than wrapped. Invalid patterns and flags surface the engine's error, and Split returns the text between the matches.",
    },
    {
      heading: 'Matched inside the tab',
      body: 'The pattern and the text are evaluated by the RegExp engine in your browser and nothing is uploaded. Pasting production log lines into it is safe, and it keeps working offline.',
    },
  ],
  examples: [
    {
      title: 'List all numbers',
      input: 'order a1, item b22, code c333',
      options: { pattern: '\\d+', mode: 'matches' },
    },
    {
      title: 'Mask vowels',
      input: 'hello world',
      options: { pattern: '[aeiou]', flags: 'g', mode: 'replace', replacement: '*' },
    },
    {
      title: 'Split on comma + space',
      input: 'red, green, blue',
      options: { pattern: ',\\s*', mode: 'split' },
    },
  ],
  faq: [
    {
      q: 'Which regex flavor is used?',
      a: 'JavaScript (ECMAScript) regular expressions, evaluated with your browser’s built-in RegExp engine.',
    },
    {
      q: 'How are capture groups shown?',
      a: 'In "List matches" mode the Groups column is a JSON object keyed by group number ("1", "2", …) plus any named groups.',
    },
    {
      q: 'Why did I get an "Invalid flags" error?',
      a: 'Only g, i, m, s, u and y are accepted, and each flag may appear once.',
    },
  ],
  related: ['find-replace', 'cron-parser', 'slugify', 'case-convert'],
  status: 'stable',
};
