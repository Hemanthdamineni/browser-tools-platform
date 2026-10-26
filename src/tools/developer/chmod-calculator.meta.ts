import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'chmod-calculator',
  name: 'chmod Permission Calculator',
  category: 'developer',
  summary:
    'Convert Unix file permissions between octal (755) and symbolic (rwxr-xr-x), with a per-class breakdown.',
  description:
    'Paste an octal mode such as 755, 0644 or 4755, or a symbolic string such as rwxr-xr-x or -rwsr-xr-x. The tool shows the 4-digit octal form, the 9-character symbolic form, and a table of read / write / execute plus setuid, setgid and sticky bits for owner, group and other.',
  keywords: [
    'chmod calculator',
    'chmod',
    'file permissions',
    'octal permissions',
    'symbolic permissions',
    'unix permissions',
    'setuid',
    'setgid',
    'sticky bit',
    'rwxr-xr-x',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect input' },
        { value: 'to-symbolic', label: 'Octal → symbolic' },
        { value: 'to-octal', label: 'Symbolic → octal' },
      ],
    },
  ],
  examples: [
    { title: '755 to symbolic', input: '755', options: { mode: 'auto' } },
    { title: 'Symbolic to octal', input: 'rwxr-xr-x', options: { mode: 'auto' } },
    { title: 'setuid binary (4755)', input: '4755', options: { mode: 'to-symbolic' } },
  ],
  related: ['number-base', 'hash-identifier', 'hex', 'base64'],
  status: 'stable',
};
