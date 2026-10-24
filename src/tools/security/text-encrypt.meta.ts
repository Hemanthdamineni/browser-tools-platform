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
  article: [
    {
      heading: 'What the two modes do',
      body: 'Encrypt mode takes plain text from the box and the passphrase from the password field and emits a single opaque token you can paste anywhere. Decrypt mode takes such a token and the same passphrase and returns the original text. The passphrase is required in both directions and is never stored, so the token and the password have to travel separately \u2014 sending both in the same message defeats the point.',
    },
    {
      heading: 'The construction behind the token',
      body: 'A fresh 16-byte salt is generated for every encryption and the passphrase is stretched into a 256-bit key with PBKDF2-SHA256 at 600,000 iterations, which is deliberately slow to make guessing passwords expensive. The text is then sealed with AES-256-GCM using a random 12-byte IV. The token is the literal prefix TBenc1. followed by base64 of salt, then IV, then the ciphertext with its authentication tag, so the parameters needed for decryption travel with the data.',
    },
    {
      heading: 'Why tampering is detected',
      body: 'GCM is authenticated encryption: the tag at the end of the ciphertext is checked before any plaintext is released. A single altered character in the token, or the wrong passphrase, fails that check and the tool reports "Wrong password or corrupted data." without revealing which of the two it was \u2014 a deliberate choice, since distinguishing them would help an attacker. A token without the TBenc1. prefix is refused immediately.',
    },
    {
      heading: 'Limits and honest caveats',
      body: 'There is no key escrow, no recovery hint and no server: a forgotten passphrase means the ciphertext is unreadable forever, by design. Encryption happens in this tab through the Web Crypto API, so the strength of the result rests on the passphrase you choose and the cleanliness of the device you type it on. For high-stakes secrets, treat this as a convenient everyday tool rather than a replacement for audited, dedicated encryption software.',
    },
    {
      heading: 'Nothing is transmitted or kept',
      body: 'The passphrase, the plaintext and the token all stay in this tab. There is no upload, no network request, no logging and no local storage of your password, so closing the page leaves nothing behind.',
    },
  ],
  faq: [
    {
      q: 'What exactly does the encryption do?',
      a: 'A random 16-byte salt is generated and your passphrase is stretched into a 256-bit key with PBKDF2-SHA256 at 600,000 iterations. The text is then encrypted with AES-256-GCM using a random 12-byte IV. The output is "TBenc1." followed by base64 of salt (16 bytes) + IV (12 bytes) + ciphertext with its authentication tag.',
    },
    {
      q: 'I forgot the password — can you recover my text?',
      a: 'No. There is no backup, no recovery hint and no server. A lost passphrase means the ciphertext is permanently unreadable, by design.',
    },
    {
      q: 'Is this safe for highly sensitive data?',
      a: 'The primitives are standard and run locally via the Web Crypto API, but security still depends on a strong, unique passphrase and a trusted device. For high-stakes secrets use dedicated, audited software.',
    },
  ],
  related: ['file-hash', 'uuid', 'base64', 'hex'],
  status: 'stable',
};
