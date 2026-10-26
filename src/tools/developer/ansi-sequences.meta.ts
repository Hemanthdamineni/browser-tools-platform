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
  related: ['string-escape', 'html-to-text'],
  status: 'stable',
};
