import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'proxy-status',
  name: 'Proxy-Status Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Proxy-Status diagnostics.',
  description:
    'Generate or analyze Proxy-Status response entries that describe proxy processing and failures. Validates proxy identifiers, parameters, quoted values, and common error tokens while highlighting topology-disclosure risks.',
  keywords: [
    'Proxy-Status',
    'HTTP proxy diagnostics',
    'proxy error',
    'proxy-status error',
    'proxy observability',
    'bad gateway',
    'gateway timeout',
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
        { value: 'analyze', label: 'Analyze entries' },
        { value: 'build', label: 'Build entry' },
      ],
    },
    { key: 'proxy', label: 'Proxy identifier', type: 'text', default: 'edge' },
    { key: 'error', label: 'Error token (optional)', type: 'text', default: 'connection_refused' },
    { key: 'next', label: 'Next proxy (optional)', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Analyze proxy diagnostics',
      input: 'edge; error=connection_refused; next="upstream"',
    },
    {
      title: 'Build a proxy error entry',
      options: { mode: 'build', proxy: 'edge', error: 'connection_refused' },
    },
    {
      title: 'Build an entry with a next hop',
      options: { mode: 'build', proxy: 'cdn-cache', error: '', next: 'origin-server' },
    },
  ],
  article: [
    {
      heading: 'What a Proxy-Status entry says',
      body: 'A proxy can attach a Proxy-Status response field to report how it handled a request and why it could not complete it, often alongside a 502 or 504. Each entry starts with a proxy identifier and carries parameters such as error, next and received-status. Build mode assembles one well-formed entry, and analyze mode reads one or more pasted entries and validates each parameter.',
    },
    {
      heading: 'The parameters that matter',
      body: 'error must be a token naming the failure, next points at the downstream proxy or origin involved, and received-status holds a three-digit status from that hop. Unknown parameters and duplicate keys are reported, and a malformed parameter without an equals sign is flagged rather than silently dropped.',
    },
    {
      heading: 'Quoted values and topology',
      body: 'A parameter value is read either as a bare token or inside double quotes with backslash escapes. Because identifiers and parameters can reveal vendor names and internal hostnames, the tool notes that you should disclose only the diagnostics a client actually needs, and it never extends those details beyond what you type.',
    },
    {
      heading: 'Parsed on your side',
      body: 'Entries are split on commas outside quotes and validated locally. No request is issued to a proxy, no network call is made, and the pasted text stays in this browser tab.',
    },
  ],
  faq: [
    {
      q: 'What does Proxy-Status describe?',
      a: 'A proxy can use it to report how it processed a request and why it could not complete it, often alongside a 502 or 504 response.',
    },
    {
      q: 'Can it expose infrastructure details?',
      a: 'Yes. Proxy identifiers and parameters can reveal topology or vendor details, so emit only information appropriate for clients.',
    },
    {
      q: 'Does this diagnose a live request?',
      a: 'No. This tool parses and builds header values locally without making network requests.',
    },
  ],
  related: ['http-header-analyzer', 'http-status'],
  status: 'stable',
};
