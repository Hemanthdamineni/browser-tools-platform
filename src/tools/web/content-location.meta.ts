import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'content-location',
  name: 'Content-Location Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect HTTP Content-Location resource references.',
  description:
    'Generate or analyze Content-Location values for representation identity and caching diagnostics. Validates relative and absolute URI references, control characters, fragments, and suspicious whitespace without making network requests.',
  keywords: [
    'Content-Location',
    'HTTP representation URL',
    'resource identity header',
    'canonical response URL',
    'URI reference analyzer',
    'cache representation',
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
        { value: 'analyze', label: 'Analyze references' },
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'location',
      label: 'Location reference',
      type: 'text',
      default: '/representations/en-us.json',
    },
  ],
  examples: [
    { title: 'Analyze representation location', input: '/documents/report.en.html' },
    {
      title: 'Build a response header',
      options: { mode: 'build', location: '/representations/report.en.html' },
    },
  ],
  article: [
    {
      heading: 'Naming a representation',
      body: 'A Content-Location header points at the URI for the particular representation a server returned, which can differ from the request URL when content negotiation chose a variant. Analyze mode classifies a pasted reference as an absolute URI, a network-path, or a relative reference, and build mode assembles a single valid header value from the location field.',
    },
    {
      heading: 'What counts as valid',
      body: 'The checker rejects values that carry whitespace or control characters, since HTTP header field values cannot contain them, and treats the scheme of an absolute URI by attempting to construct it. A fragment is flagged with a warning because a #fragment is client-side and is not sent in a request, so it rarely describes a real representation.',
    },
    {
      heading: 'Not a redirect',
      body: 'Unlike Location, Content-Location is metadata about the selected representation and does not move the client anywhere. The distinction matters for caching: a cache can store the payload keyed by this header without following it like a redirect.',
    },
    {
      heading: 'Nothing is fetched',
      body: 'Validation is purely syntactic and runs in this page. The reference is never fetched, the tool makes no network request, and your pasted values are not uploaded or stored.',
    },
  ],
  faq: [
    {
      q: 'Is Content-Location the same as the request URL?',
      a: 'Not necessarily. It identifies a specific representation or resource associated with the response and may be relative or absolute.',
    },
    {
      q: 'Does it redirect the client?',
      a: 'No. Content-Location is metadata, not a redirect. Use Location with a redirect status to move a client.',
    },
    {
      q: 'Does this fetch the URI?',
      a: 'No. The tool only validates syntax locally and never makes a network request.',
    },
  ],
  related: ['url-parse', 'http-status', 'cache-headers'],
  status: 'stable',
};
