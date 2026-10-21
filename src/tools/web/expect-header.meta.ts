import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'expect-header',
  name: 'Expect Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Expect request expectations.',
  description:
    'Generate or analyze Expect request headers for 100-continue upload handshakes. Validates the standard expectation, detects duplicates and malformed tokens, and explains intermediary compatibility locally.',
  keywords: [
    'Expect header',
    '100 Continue',
    'HTTP upload handshake',
    'expect 100-continue',
    'request body negotiation',
    'HTTP expectation',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze expectations' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'expectation', label: 'Expectation', type: 'text', default: '100-continue' },
  ],
  examples: [
    { title: 'Analyze upload handshake', input: '100-continue' },
    {
      title: 'Build a request expectation',
      options: { mode: 'build', expectation: '100-continue' },
    },
  ],
  faq: [
    {
      q: 'What does 100-continue do?',
      a: 'It lets a client ask the server to approve request headers before sending a potentially large request body.',
    },
    {
      q: 'Does this guarantee a 100 response?',
      a: 'No. Servers and intermediaries may ignore, reject, or mishandle the expectation; clients need a timeout and fallback strategy.',
    },
    {
      q: 'Can I use custom expectations?',
      a: 'Extensions are possible in theory, but interoperability is limited. This tool flags them for review rather than claiming universal support.',
    },
  ],
  related: ['http-status', 'http-header-analyzer', 'content-type'],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
