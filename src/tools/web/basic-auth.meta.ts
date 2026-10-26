import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'basic-auth',
  name: 'HTTP Basic Auth Header',
  category: 'web',
  summary: 'Build or decode HTTP Basic Authorization headers, UTF-8 safe.',
  description:
    'Build an Authorization: Basic header from a username and password, or decode an existing one back to its credentials. Handles non-ASCII characters correctly by encoding UTF-8 before base64.',
  keywords: [
    'basic auth',
    'basic authentication',
    'authorization header',
    'http auth',
    'base64 credentials',
    'basic base64',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'build',
      choices: [
        { value: 'build', label: 'Build header' },
        { value: 'decode', label: 'Decode header' },
      ],
    },
    {
      key: 'username',
      label: 'Username',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
    {
      key: 'password',
      label: 'Password',
      type: 'text',
      default: '',
      showWhen: { key: 'mode', value: 'build' },
    },
  ],
  examples: [
    {
      title: 'Classic RFC 7617 example',
      options: { mode: 'build', username: 'Aladdin', password: 'open sesame' },
    },
    {
      title: 'Decode',
      input: 'Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==',
      options: { mode: 'decode' },
    },
    {
      title: 'Build with non-ASCII credentials',
      options: { mode: 'build', username: 'josé', password: 'pässwörd' },
    },
  ],
  related: ['url-parse', 'jwt-decode', 'base64'],
  status: 'stable',
};
