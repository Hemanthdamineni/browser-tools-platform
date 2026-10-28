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
  related: [  "uuid",
  "http-header-analyzer"],
  status: 'stable',
};
