import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'access-control-allow-credentials',
  name: 'Access-Control-Allow-Credentials Builder & Analyzer',
  category: 'web',
  summary: 'Build or inspect the CORS credentials flag.',
  description:
    'Generate or analyze the Access-Control-Allow-Credentials response header. Validates the true token, flags non-standard values, and explains the wildcard Allow-Origin restriction and credential-carrying request implications locally.',
  keywords: [
    'Access-Control-Allow-Credentials',
    'CORS credentials',
    'withCredentials',
    'allow credentials flag',
    'cookie cross-origin',
    'CORS true',
    'credentialed requests',
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
        { value: 'build', label: 'Build header' },
      ],
    },
    {
      key: 'value',
      label: 'Value',
      type: 'select',
      default: 'true',
      choices: [
        { value: 'true', label: 'true' },
        { value: 'false', label: 'false' },
      ],
    },
  ],
  examples: [
    { title: 'Analyze a credentials flag', input: 'true' },
    { title: 'Build the credentials header', options: { mode: 'build', value: 'true' } },
  ],
  faq: [
    {
      q: 'What does this header do?',
      a: 'It tells the browser to allow credentialed cross-origin requests (cookies, auth headers) to read the response, when the request used withCredentials.',
    },
    {
      q: 'Can it combine with a wildcard?',
      a: 'No. When credentials are allowed, Access-Control-Allow-Origin must name the specific origin and cannot be *.',
    },
    {
      q: 'Is false a valid value?',
      a: 'The CORS spec defines only true; a false value is non-standard and generally treated as absent.',
    },
  ],
  related: ['cors-headers', 'security-headers'],
  hidden: true,
  redirectTo: 'cors-headers',
  status: 'stable',
};
