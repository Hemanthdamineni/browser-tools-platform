import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ansi-sequences',
  name: 'ANSI Escape Sequence Inspector',
  category: 'developer',
  summary: 'Strip, visualize, or inspect ANSI terminal escape sequences in text and logs.',
  description:
    'Inspect terminal output containing ANSI control sequences. Remove styling codes, replace recognized sequences with readable labels, or list sequence types and positions. CSI, SGR, OSC (including BEL and ST terminators), and malformed escapes are handled locally.',
  keywords: [
    'ansi',
    'ansi escape',
    'terminal colors',
    'terminal control codes',
    'strip ansi',
    'remove ansi colors',
    'escape sequences',
    'console log cleanup',
    'sgr',
    'osc',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      default: 'strip',
      choices: [
        { value: 'strip', label: 'Strip recognized sequences' },
        { value: 'visualize', label: 'Visualize as readable markers' },
        { value: 'analyze', label: 'List sequence details' },
      ],
    },
  ],
  examples: [
    { title: 'Strip colored output', input: '\u001b[31mERROR\u001b[0m: disk full' },
    {
      title: 'Visualize cursor and style codes',
      input: '\u001b[1;32mOK\u001b[0m\u001b[2K',
      options: { operation: 'visualize' },
    },
    {
      title: 'Inspect terminal hyperlinks',
      input: '\u001b]8;;https://example.com\u0007Example\u001b]8;;\u0007',
      options: { operation: 'analyze' },
    },
  ],
  article: [
    {
      heading: 'The three operations',
      body: 'Choose strip to remove recognised escape sequences, visualize to replace each with a readable label such as [SGR 31] or [OSC 8; ... (BEL)], or analyze to get a table of every sequence with its offset, kind, readable form and raw bytes. Each operation also reports how many sequences were found and how many were left untouched.',
    },
    {
      heading: 'What counts as a sequence',
      body: 'The scanner recognises CSI sequences, which start with ESC [ and end in a final byte from @ to ~ (colour, cursor movement and screen erasure), and OSC sequences, which start with ESC ] and end with BEL or ESC backslash (window titles, hyperlinks, clipboard calls). Other escape forms, C1 controls and stray ESC bytes count as malformed and are left in place.',
    },
    {
      heading: 'Strip versus visualize',
      body: 'Strip is the everyday answer, clearing a coloured test run or a remote log before it goes into a plain-text document. Visualize is for debugging your own tooling, showing the codes the way a terminal reads them. Analyze is the most detailed, for auditing exactly which codes a program emits.',
    },
    {
      heading: 'OSC payloads, and where this runs',
      body: 'Analysis and visualization print OSC payloads literally, because that is the point of the tool. Hyperlinks and some title or command sequences can carry URLs or shell commands, so avoid sharing output from a private source. The scan is a pure string pass in this tab, so cleaning a sensitive log never sends it anywhere.',
    },
  ],
  faq: [
    {
      q: 'Which codes are recognized?',
      a: 'CSI sequences are recognized by their ESC [ prefix and final byte; OSC sequences begin with ESC ] and end with BEL or ESC backslash. Other C1 or terminal-specific controls are not interpreted.',
    },
    {
      q: 'Does stripping ANSI codes remove all control characters?',
      a: 'No. This utility removes recognized CSI and OSC sequences only. Newlines, tabs, carriage returns and unsupported control bytes are preserved.',
    },
    {
      q: 'Can OSC sequences contain sensitive links?',
      a: 'OSC payloads are shown literally in analysis and visualization output. Avoid sharing the output if it contains private terminal hyperlinks or commands.',
    },
  ],
  related: ['string-escape', 'html-to-text'],
  status: 'stable',
};
