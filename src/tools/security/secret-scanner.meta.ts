import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'secret-scanner',
  name: 'Secret & Credential Scanner',
  category: 'security',
  summary: 'Find and optionally redact likely credentials in pasted text or configuration.',
  description:
    'Scan configuration, source snippets, or logs for recognizable access tokens, private-key headers, and secret-like assignments. Review findings locally or produce redacted text. Detection is heuristic and cannot guarantee a clean result.',
  keywords: [
    'secret scanner',
    'credential scanner',
    'api key detector',
    'token scanner',
    'find secrets in code',
    'redact credentials',
    'private key detector',
    'security audit text',
    'password leak check',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'operation',
      label: 'Operation',
      type: 'select',
      default: 'report',
      choices: [
        { value: 'report', label: 'Report findings' },
        { value: 'redact', label: 'Redact detected values' },
      ],
    },
    {
      key: 'minLength',
      label: 'Minimum generic secret length',
      type: 'number',
      default: 12,
      min: 8,
      max: 64,
    },
  ],
  examples: [
    {
      title: 'Check a config snippet',
      input: 'API_TOKEN=ghp_1234567890abcdefghijklmnopqrstuv\nPUBLIC_URL=https://example.com',
    },
    {
      title: 'Redact assignments',
      input: 'password = "not-a-real-password"\nregion = "eu-west-1"',
      options: { operation: 'redact' },
    },
    {
      title: 'Raise the generic secret length',
      input: 'token = "secret12345"\nTOKEN = "secret12345"',
      options: { minLength: 8 },
    },
  ],
  article: [
    {
      heading: 'Patterns and assignments',
      body: 'The scanner looks for two kinds of signal. Named patterns match recognisable shapes such as GitHub tokens, AWS access key IDs, Google and Stripe keys, JWTs and PEM private-key headers. A second, broader pass finds assignment-looking lines where the key name hints at a secret — password, token, api_key, client_secret, access_key — and the value looks long enough to be one.',
    },
    {
      heading: 'Report or redact',
      body: 'In report mode each finding is listed with its type, a masked preview, and a line and column so you can jump straight to the spot. Redact mode replaces every detected span in the output with a placeholder, producing a cleaned copy you can paste into a ticket or log without leaking the value.',
    },
    {
      heading: 'Heuristics, not guarantees',
      body: 'Detection is heuristic. An unusual token format can be missed entirely, and a string that merely resembles a secret can be flagged by mistake. The minimum-length control tunes how eager the generic assignment detector is, and the private-key rule catches headers rather than the surrounding text.',
    },
    {
      heading: 'Scanned on your machine',
      body: 'The scan runs in your browser over the text you paste, and no network request is made. The masked previews are computed locally, so nothing that could be a real credential is ever transmitted or logged.',
    },
  ],
  faq: [
    {
      q: 'Can this prove that text contains no secrets?',
      a: 'No. The scanner uses heuristics and known token shapes; it can miss unfamiliar formats or produce false positives. Review results and use your organization’s secret-scanning controls for source repositories.',
    },
    {
      q: 'Are detected values shown in the report?',
      a: 'No. The report includes only a short masked preview, type, and line/column. Redaction mode replaces detected spans in the text output.',
    },
    {
      q: 'Is the input uploaded?',
      a: 'No. Scanning runs in your browser and makes no network requests.',
    },
  ],
  related: ['file-hash', 'text-encrypt', 'json-format'],
  status: 'stable',
};
