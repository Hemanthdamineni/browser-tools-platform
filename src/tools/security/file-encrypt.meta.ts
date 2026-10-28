import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'file-encrypt',
  name: 'File Encryption (AES-GCM)',
  category: 'security',
  summary:
    'Encrypt or decrypt any file with a passphrase using AES-256-GCM and PBKDF2, entirely on your device.',
  description:
    'Protect a file of any type with a password. Encryption derives a 256-bit key from your passphrase with PBKDF2-SHA256 (600,000 iterations) and a random salt, then seals the file with AES-256-GCM in chunks using a random IV. Large files are processed chunk by chunk so memory stays low. Nothing is uploaded and there is no key escrow.',
  keywords: [
    'encrypt',
    'decrypt',
    'file encryption',
    'aes',
    'aes-gcm',
    'aes-256',
    'pbkdf2',
    'password',
    'passphrase',
    'cipher',
    'secure file',
    'encrypt file online',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'encrypt',
      choices: [
        { value: 'encrypt', label: 'Encrypt (file → .feenc)' },
        { value: 'decrypt', label: 'Decrypt (.feenc → file)' },
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
      title: 'Encrypt a file',
      options: { mode: 'encrypt', password: 'correct horse battery staple' },
    },
    {
      title: 'Decrypt it again',
      options: { mode: 'decrypt', password: 'correct horse battery staple' },
    },
  ],
  faq: [
    {
      q: 'What does the encrypted file contain?',
      a: 'The output is "FEenc1." followed by base64 of a small JSON header (format version, chunk size, per-chunk metadata) and then AES-256-GCM ciphertext chunks. The key comes from your passphrase via PBKDF2-SHA256 at 600,000 iterations with a random 16-byte salt; each chunk uses a unique random 12-byte IV.',
    },
    {
      q: 'I forgot the password — can you recover my file?',
      a: 'No. There is no backup, no recovery hint and no server. A lost passphrase means the ciphertext is permanently unreadable, by design.',
    },
    {
      q: 'Why is the output bigger than the input?',
      a: 'Every chunk carries a 16-byte GCM authentication tag plus per-chunk header metadata, and the container itself is base64-encoded. On small files this overhead is noticeable; on large files it is a few percent.',
    },
  ],
  related: [  "text-encrypt",
  "file-hash",
  "password",
  "base64"],
  status: 'stable',
};
