import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'http-encoding',
  name: 'HTTP Encoding Header Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect Accept-Encoding and Content-Encoding negotiation values.',
  description:
    'Parse weighted HTTP content-coding lists, choose the best supported coding, and build Accept-Encoding or Content-Encoding headers. Invalid q-values, wildcards, and disabled codings are reported locally.',
  keywords: [
    'Accept-Encoding',
    'Content-Encoding',
    'gzip header',
    'br compression',
    'deflate header',
    'HTTP q value',
    'content negotiation',
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
        { value: 'analyze', label: 'Analyze preferences' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'header',
      label: 'Header',
      type: 'select',
      default: 'accept',
      choices: [
        { value: 'accept', label: 'Accept-Encoding' },
        { value: 'content', label: 'Content-Encoding' },
      ],
    },
    {
      key: 'codings',
      label: 'Codings (comma-separated)',
      type: 'text',
      default: 'br, gzip, deflate',
    },
    {
      key: 'supported',
      label: 'Supported codings (analyze)',
      type: 'text',
      default: 'br, gzip, deflate, identity',
    },
  ],
  examples: [
    { title: 'Analyze browser preferences', input: 'br;q=1.0, gzip;q=0.8, *;q=0.1' },
    {
      title: 'Build an Accept-Encoding header',
      options: { mode: 'build', header: 'accept', codings: 'br, gzip, deflate' },
    },
  ],
  article: [
    {
      heading: 'Two sides of encoding negotiation',
      body: 'Accept-Encoding tells a server which content codings a client can decode, while Content-Encoding states which coding was actually applied to a response body. Build mode assembles either header from a comma-separated list of codings such as br, gzip, deflate and identity, and analyze mode reads a weighted value and explains how it would be interpreted.',
    },
    {
      heading: 'Reading the q-values',
      body: 'Each coding can carry a q parameter from 0 to 1 that expresses relative preference. The parser checks the q syntax carefully, rejecting values above one or a malformed decimal, and treats a coding with q=0 as explicitly unacceptable. Unrecognised parameters are reported against the coding that carried them.',
    },
    {
      heading: 'Wildcards and identity',
      body: 'A * entry sets a default preference for any coding not named elsewhere, which is how a client says it accepts anything at low priority. identity means no compression at all and is normally acceptable unless it is explicitly zeroed or excluded by a wildcard rule. The tool reports which coding from the supported set it would pick.',
    },
    {
      heading: 'Headers only, no bodies',
      body: 'The value is tokenised and interpreted in this page, and nothing is compressed, decompressed or sent. No network request is made, so testing a negotiated header value reveals nothing to any server.',
    },
  ],
  faq: [
    {
      q: 'What does q mean?',
      a: 'The q-value expresses relative preference from 0 to 1. A coding with q=0 is explicitly unacceptable.',
    },
    {
      q: 'What is identity?',
      a: 'identity means no content coding. It is generally acceptable unless explicitly assigned q=0 or excluded by a wildcard rule.',
    },
    {
      q: 'Does this compress data?',
      a: 'No. It only builds and analyzes negotiation headers; it never transforms a response body.',
    },
  ],
  related: ['gzip', 'mime-lookup', 'http-status'],
  status: 'stable',
};
