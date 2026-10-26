import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'text-encrypt',
  name: 'Text Encryption (AES-GCM)',
  category: 'security',
  summary:
    'Encrypt or decrypt text with a passphrase using AES-256-GCM and PBKDF2, entirely on your device.',
  description:
    'Protect a note or message with a password. Encryption derives a 256-bit key from your passphrase with PBKDF2-SHA256 (600,000 iterations) and a random salt, then seals the text with AES-256-GCM and a random IV. Nothing is uploaded and there is no key escrow.',
  keywords: [
    'encrypt',
    'decrypt',
    'encryption',
    'aes',
    'aes-gcm',
    'aes-256',
    'pbkdf2',
    'password',
    'passphrase',
    'cipher',
    'secure note',
    'encrypt text online',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encrypt',
      choices: [
        { value: 'encrypt', label: 'Encrypt (text → token)' },
        { value: 'decrypt', label: 'Decrypt (token → text)' },
      ],
    },
    {
      key: 'password',
      label: 'Password',
      type: 'text',
      default: '',
      placeholder: 'Passphrase (required)',
      help: 'The same passphrase is needed to decrypt. It is never stored or sent anywhere.',
    },
  ],
  examples: [
    {
      title: 'Encrypt a note',
      input: 'meet me at the docks at nine',
      options: { mode: 'encrypt', password: 'correct horse battery staple' },
    },
    {
      title: 'Decrypt a token',
      input:
        'TBenc1.VHnONYxWKMKAx6iMPgk+f7MulPOhXvyjQA2xntSPy2wMR9QWCJah30V1C92r9vd5IGYgCseVwe2K/ODCjk+wWYHPlPDXoKfV',
      options: { mode: 'decrypt', password: 'correct horse battery staple' },
    },
    {
      title: 'Encrypt a short key',
      input: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5 shared staging key',
      options: { mode: 'encrypt', password: 'river-stone-42' },
    },
  ],
  related: ['file-hash', 'uuid', 'base64', 'hex'],
  status: 'stable',
};
