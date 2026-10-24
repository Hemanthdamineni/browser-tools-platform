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
  article: [
    {
      heading: 'Encrypting and decrypting a file',
      body: 'Pick Encrypt to seal a file into a .tbenc container, or Decrypt to open one this tool wrote earlier. A 256-bit key comes from your passphrase through PBKDF2-SHA256 at 600,000 iterations, and the bytes are sealed with AES-256-GCM. The encrypted copy is named after the original with .tbenc appended.',
    },
    {
      heading: 'Inside the .tbenc container',
      body: 'A 40-byte header carries the magic TBFENC, a version, the KDF id, the iteration count, the 64 KiB chunk size, a random salt and a nonce prefix. Records follow, each with a flag byte, a length and GCM ciphertext plus tag. The header and counter are authenticated, so edits or truncation fail.',
    },
    {
      heading: 'Memory and streamed chunks',
      body: 'Files are read and sealed 64 KiB at a time, so peak memory tracks the file rather than doubling it, and there is no hard size limit beyond free RAM. Because the final-chunk flag is authenticated, a cut-short file is rejected instead of decrypting to a silent prefix.',
    },
    {
      heading: 'Options and when to use it',
      body: 'Direction switches between encrypt and decrypt, and the passphrase field is required for both. Reach for it when a file must cross an untrusted channel such as email or a shared drive, or when a backup should rest on disk unreadable by anyone else.',
    },
    {
      heading: 'Privacy and the lost-password rule',
      body: 'The Web Crypto API does the work in your browser tab or worker, the page makes no network requests, and nothing is stored between visits. There is no escrow, so a forgotten passphrase leaves the file permanently unreadable.',
    },
  ],
  faq: [
    {
      q: 'What exactly is inside a .tbenc file?',
      a: 'A 40-byte header (the ASCII magic "TBFENC", a format version, a KDF identifier, the PBKDF2 iteration count, the chunk size, a 16-byte salt and an 8-byte nonce prefix) followed by records of flag byte, length and AES-256-GCM ciphertext with its authentication tag. The header lets the format evolve without breaking files written by older versions.',
    },
    {
      q: 'I forgot the password — can you recover my file?',
      a: 'No. There is no backup, no recovery hint, no key escrow and no server. A lost passphrase means the file is permanently unreadable, by design.',
    },
    {
      q: 'Can another program open a .tbenc file?',
      a: 'No. The container format is specific to this tool, so decrypt with this tool. If you need an interoperable format, use a standards-based tool such as OpenSSL or GPG instead.',
    },
    {
      q: 'Is there a file size limit?',
      a: 'No hard limit. Files are read and encrypted 64 KiB at a time, so peak memory stays close to the file size instead of duplicating it. The practical ceiling is the free RAM of your device.',
    },
    {
      q: 'Does my file or password leave my device?',
      a: 'No. Encryption uses the Web Crypto API in your browser tab or worker, the page makes no network requests, and nothing is stored or remembered between visits.',
    },
  ],
  related: ['text-encrypt', 'file-hash', 'checksum-validator'],
  status: 'stable',
  updated: '2026-10-24',
};
