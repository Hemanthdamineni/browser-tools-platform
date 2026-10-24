import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'file-encrypt',
  name: 'File Encryption (AES-GCM)',
  category: 'security',
  summary: 'Encrypt or decrypt any file with a password using AES-256-GCM — chunked, with a versioned header.',
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
  article: [
    {
      heading: 'What this tool does',
      body: 'AES-256-GCM encryption for any file, keyed by a password you choose. A random 16-byte salt is stretched into a 256-bit key with PBKDF2-SHA256 at 600,000 iterations — the same derivation as the text encryption tool — and the file is sealed chunk by chunk.',
    },
    {
      heading: 'The .tbenc format',
      body: 'Output begins with a 40-byte header: the ASCII magic "TBFENC", a format version, a KDF identifier, the PBKDF2 iteration count, chunk size, a 16-byte salt and an 8-byte nonce prefix. Each record then holds a flag byte, a 4-byte length, and the ciphertext with its 16-byte GCM tag. A chunk uses the nonce prefix plus a counter as its IV, and the tag covers the header, counter and final-chunk flag.',
    },
    {
      heading: 'Large files',
      body: 'Files are read and encrypted 64 KiB at a time, so peak memory stays close to the file size rather than several times it. Because the final-chunk flag is authenticated, a file that was cut short is rejected instead of quietly decrypting to a prefix.',
    },
    {
      heading: 'When to use it',
      body: 'Reach for it when a file must travel through a channel you do not trust — email, a shared drive, a chat app — or when a backup should sit on disk unreadable by anyone else. The password is the only key: lose it and the file is unrecoverable, so keep it in a password manager.',
    },
    {
      heading: 'Privacy',
      body: 'Everything happens in your browser through the Web Crypto API. The file, the password and the result never touch a network, the page makes no requests, and nothing is stored between visits.',
    },
  ],
  related: ['text-encrypt', 'file-hash', 'checksum-validator'],
  status: 'stable',
  updated: '2026-10-24',
};