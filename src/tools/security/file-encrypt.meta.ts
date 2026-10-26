import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'file-encrypt',
  name: 'File Encryption (AES-GCM)',
  category: 'security',
  summary:
    'Encrypt or decrypt any file with a password using AES-256-GCM — chunked, with a versioned header.',
  description:
    'Lock a file with a password, or open a file this tool encrypted earlier. A 256-bit key is derived from your password with PBKDF2-SHA256, then the file is sealed chunk by chunk with AES-256-GCM behind a versioned header so large files never need to fit in memory twice. Nothing is uploaded and there is no key escrow.',
  keywords: [
    'file encryption',
    'encrypt file',
    'decrypt file',
    'aes-256',
    'aes-gcm',
    'pbkdf2',
    'password protect file',
    'encrypt file online',
    'secure file',
    'tbenc',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encrypt',
      choices: [
        { value: 'encrypt', label: 'Encrypt (file → .tbenc)' },
        { value: 'decrypt', label: 'Decrypt (.tbenc → file)' },
      ],
    },
    {
      key: 'password',
      label: 'Password',
      type: 'text',
      default: '',
      placeholder: 'Passphrase (required)',
      help: 'The same passphrase is needed to decrypt. It is never stored or sent anywhere, and it cannot be recovered if forgotten.',
    },
  ],
  examples: [
    {
      title: 'Encrypt a document before emailing it',
      options: { mode: 'encrypt' },
    },
    {
      title: 'Decrypt a file you encrypted earlier',
      options: { mode: 'decrypt' },
    },
    {
      title: 'Encrypt a backup archive with a long passphrase',
      options: { mode: 'encrypt', password: '' },
    },
  ],
  related: ['text-encrypt', 'file-hash', 'checksum-validator'],
  status: 'stable',
  updated: '2026-10-24',
};
