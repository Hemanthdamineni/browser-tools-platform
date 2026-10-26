import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'bcrypt',
  name: 'BCrypt Hash / Verify',
  category: 'security',
  summary: 'Hash a password with bcrypt, or verify a password against a stored hash.',
  description:
    'Turn a password into a bcrypt hash with a chosen cost factor (work factor), or check a password against a stored hash. Everything runs locally in a Web Worker so the page stays responsive even at high cost, and the password never leaves your device.',
  keywords: [
    'bcrypt',
    'hash',
    'password hash',
    'password verify',
    'cost factor',
    'rounds',
    'bcrypt hash',
    'check password',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  worker: true,
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'hash',
      choices: [
        { value: 'hash', label: 'Hash a password' },
        { value: 'verify', label: 'Verify against a hash' },
      ],
    },
    {
      key: 'cost',
      label: 'Cost factor (rounds)',
      type: 'range',
      default: 10,
      min: 4,
      max: 15,
      step: 1,
      help: 'Work factor. Each +1 doubles the time. Default 10 ≈ 0.1 s.',
      showWhen: { key: 'mode', value: 'hash' },
    },
    {
      key: 'hash',
      label: 'Stored bcrypt hash',
      type: 'text',
      default: '',
      placeholder: '$2b$10$…',
      showWhen: { key: 'mode', value: 'verify' },
    },
  ],
  examples: [
    {
      title: 'Hash a password at the default cost',
      input: 'hunter2',
      options: { mode: 'hash', cost: 10 },
    },
    {
      title: 'Hash with a higher cost factor',
      input: 'correct horse battery staple',
      options: { mode: 'hash', cost: 12 },
    },
    {
      title: 'Verify a matching password',
      input: 'hunter2',
      options: {
        mode: 'verify',
        hash: '$2b$10$EZHlFIQcLaXBPdVq9vdDC.OFujeyPmE613GmGj.itHbjbhCYA8J.2',
      },
    },
  ],
  related: ['password-strength', 'passphrase', 'password', 'file-hash'],
  credits: [{ name: 'bcryptjs', url: 'https://github.com/dcodeIO/bcrypt.js', license: 'MIT' }],
  status: 'stable',
};
