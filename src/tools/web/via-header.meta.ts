import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'via-header',
  name: 'HTTP Via Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Via header field values for proxy control.',
  description:
    'Generate or analyze Via header values, conforming to RFC 7230. Detects duplicates and invalid formats, and ensures compliance with HTTP specifications.',
  keywords: ['Via header', 'HTTP proxy', 'RFC 7230'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'analyze',
      choices: [
        { value: 'analyze', label: 'Analyze header' },
        { value: 'build', label: 'Build header' },
      ],
    },
    { key: 'protocol', label: 'Protocol', type: 'text', default: 'HTTP/1.1' },
    { key: 'host', label: 'Host', type: 'text', default: 'example.com' },
  ],
  examples: [
    { title: 'Analyze Via header values', input: '1.0 example.com (Apache)' },
    {
      title: 'Build a proxy header value',
      options: { mode: 'build', protocol: '1.1', host: 'proxy.example.com' },
    },
  ],
  faq: [
    {
      q: 'What is the purpose of the Via header?',
      a: 'The Via header tracks intermediaries like gateways or proxies to avoid request loops and diagnose routing issues.',
    },
    {
      q: 'Is the Via header required for all proxies?',
      a: 'Yes. RFC 7230 requires proxies to add Via headers to their forwarded requests and responses.',
    },
  ],
  related: [  "proxy-authorization",
  "http-header-analyzer"],
  hidden: true,
  redirectTo: 'http-header-analyzer',
  status: 'stable',
};
