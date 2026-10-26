import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'www-authenticate',
  name: 'WWW-Authenticate Builder & Parser',
  category: 'web',
  summary: 'Build or inspect HTTP authentication challenges for Basic and Bearer schemes.',
  description:
    'Generate WWW-Authenticate challenge values or parse one or more challenges with quoted realm, scope, and error parameters. Validates tokens and warns about insecure Basic transport and malformed values locally.',
  keywords: [
    'WWW-Authenticate',
    'Bearer challenge',
    'Basic auth challenge',
    'OAuth realm',
    '401 header',
    'auth-param parser',
    'HTTP authentication',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'parse',
      choices: [
        { value: 'parse', label: 'Parse challenges' },
        { value: 'build', label: 'Build challenge' },
      ],
    },
    {
      key: 'scheme',
      label: 'Scheme',
      type: 'select',
      default: 'Bearer',
      choices: ['Basic', 'Bearer'].map((value) => ({ value, label: value })),
    },
    { key: 'realm', label: 'Realm', type: 'text', default: 'api' },
    { key: 'scope', label: 'Bearer scope (optional)', type: 'text', default: '' },
    { key: 'error', label: 'Bearer error (optional)', type: 'text', default: '' },
  ],
  examples: [
    {
      title: 'Parse challenges',
      input: 'Basic realm="Members", Bearer realm="api", scope="read write"',
    },
    {
      title: 'Build a Bearer challenge',
      options: { mode: 'build', scheme: 'Bearer', realm: 'api', scope: 'read:profile' },
    },
    {
      title: 'Read a Bearer error challenge',
      input:
        'Bearer realm="api", error="invalid_token", error_description="The access token expired"',
    },
  ],
  related: ['basic-auth', 'set-cookie', 'security-headers'],
  status: 'stable',
};
