import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'accept-patch',
  name: 'Accept-Patch Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Accept-Patch media-type capabilities.',
  description:
    'Generate or analyze Accept-Patch response values that advertise supported PATCH document formats. Validates media types and parameters, detects duplicates and wildcard scope, and explains that capability does not grant authorization.',
  keywords: [
    'Accept-Patch',
    'PATCH media type',
    'JSON Patch',
    'JSON Merge Patch',
    'HTTP API capability',
    'PATCH formats',
    '415 Unsupported Media Type',
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
        { value: 'analyze', label: 'Analyze media types' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'types',
      label: 'Media types (comma-separated)',
      type: 'text',
      default: 'application/json-patch+json, application/merge-patch+json',
    },
  ],
  examples: [
    {
      title: 'Analyze PATCH capabilities',
      input: 'application/json-patch+json, application/merge-patch+json',
    },
    {
      title: 'Build an API capability header',
      options: { mode: 'build', types: 'application/json-patch+json' },
    },
    {
      title: 'A wildcard capability',
      input: '*/*',
    },
  ],
  article: [
    {
      heading: 'What the header advertises',
      body: 'An Accept-Patch response value tells a client which PATCH document formats the resource will accept, so a server that handles JSON Merge Patch might reply with application/merge-patch+json. Build mode turns a comma-separated list of media types into a clean header value, and analyze mode validates a pasted value and reports each type with its status.',
    },
    {
      heading: 'Media types and parameters',
      body: 'Each entry is checked as a real media type: the type and subtype tokens must be valid, and parameters after a semicolon need a token key and a value. Duplicate types and an overly broad */* wildcard are both flagged, because a capability that claims to accept everything deserves a second look.',
    },
    {
      heading: 'Capability is not authorization',
      body: 'Advertising a format is only a hint about what the endpoint can parse. Whether a given client is allowed to PATCH is still decided by authentication and authorization, so the tool notes this in its results rather than implying that listing a media type grants write access.',
    },
    {
      heading: 'Parsing happens locally',
      body: 'The header text is tokenised and validated entirely in this tab. No value is sent to a server, no request is made, and nothing is stored, so API capability values can be pasted in private.',
    },
  ],
  faq: [
    {
      q: 'Does Accept-Patch allow a client to PATCH?',
      a: 'No. It advertises supported document formats; authentication and authorization still control whether a PATCH request is accepted.',
    },
    {
      q: 'Where is Accept-Patch sent?',
      a: 'It is commonly sent in responses to advertise formats accepted by PATCH, including OPTIONS responses.',
    },
    {
      q: 'What happens for an unsupported format?',
      a: 'A server may reject the request with 415 Unsupported Media Type.',
    },
  ],
  related: ['content-type', 'http-status', 'http-header-analyzer'],
  status: 'stable',
};
