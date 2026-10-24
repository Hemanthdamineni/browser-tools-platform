import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'request-id',
  name: 'X-Request-ID / Correlation-ID Tool',
  category: 'web',
  summary: 'Generate or validate request correlation IDs.',
  description:
    'Generate or analyze the X-Request-ID (correlation ID) request header used to trace a request across services. Generates a UUID or token, validates provided values, and advises echoing the ID in responses and logs for end-to-end debugging.',
  keywords: [
    'X-Request-ID',
    'correlation id',
    'request id',
    'trace id',
    'calling together logs',
    'API debugging',
    'correlation header',
    'end-to-end tracking',
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
        { value: 'analyze', label: 'Analyze value' },
        { value: 'generate', label: 'Generate new ID' },
      ],
    },
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      default: 'uuid-v4',
      choices: [
        { value: 'uuid-v4', label: 'UUID v4' },
        { value: 'token', label: 'Short token (16 hex)' },
      ],
    },
    {
      key: 'header',
      label: 'Header name',
      type: 'select',
      default: 'X-Request-ID',
      choices: [
        { value: 'X-Request-ID', label: 'X-Request-ID' },
        { value: 'X-Correlation-ID', label: 'X-Correlation-ID' },
        { value: 'X-Trace-Id', label: 'X-Trace-Id' },
      ],
    },
  ],
  examples: [
    {
      title: 'Generate a UUID request ID',
      options: { mode: 'generate', format: 'uuid-v4', header: 'X-Request-ID' },
    },
    { title: 'Validate an incoming value', input: '550e8400-e29b-41d4-a716-446655440000' },
    {
      title: 'Generate a short hex token',
      options: { mode: 'generate', format: 'token', header: 'X-Correlation-ID' },
    },
  ],
  article: [
    {
      heading: 'Generating an ID to send',
      body: 'Generate mode creates a random value with the browser crypto API and prints it as a ready-to-send header line. Choose a UUID v4 for full 128-bit entropy or a shorter 16-hex-digit token, then pick the header name it should appear under.',
    },
    {
      heading: 'Validating an incoming value',
      body: 'Analyze mode judges a pasted value as a UUID, a 16-char hex token, or a custom ID and reports its length. Values shorter than eight characters or filled with odd symbols are flagged, and anything past 128 characters is warned about as bloating logs and headers.',
    },
    {
      heading: 'Choosing a header name',
      body: 'X-Request-ID, X-Correlation-ID and X-Trace-Id are all offered in the picker; the chosen name is echoed in the generated header and recorded in the analysis table.',
    },
    {
      heading: 'Making the ID actually useful',
      body: 'The generated or analysed value is only correlation if the server echoes it back and your logs capture it alongside the route and timestamp. Without that wiring, an ID is just a random string.',
    },
    {
      heading: 'Generated on your device',
      body: 'Randomness comes from the browser crypto API and every step runs locally. No ID is uploaded and the tool makes no network call.',
    },
  ],
  faq: [
    {
      q: 'Why use a request ID?',
      a: 'It lets you correlate a single user request across proxies, services, and logs, making failures far easier to trace.',
    },
    {
      q: 'What is a good format?',
      a: 'A UUIDv4 (or a 128-bit random token) is a strong choice: high entropy, collision-resistant, widely understood.',
    },
    {
      q: 'Should the server echo it?',
      a: 'Yes — return the same ID in the response header and include it in your structured logs for end-to-end correlation.',
    },
  ],
  related: ['uuid', 'http-header-analyzer', 'access-log-analyzer'],
  status: 'stable',
};
