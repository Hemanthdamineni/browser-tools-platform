import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'pgp-tool',
  name: 'PGP Tool',
  category: 'security',
  summary:
    'Generate OpenPGP keys, and encrypt, decrypt, sign and verify text or files — fully on-device.',
  description:
    'A complete OpenPGP workbench built on openpgp.js: generate an Ed25519, NIST P-256 or RSA key pair, encrypt text or files to a public key, decrypt with a private key and passphrase, sign and verify messages (detached or clearsigned), and import or export keys. Everything runs in this tab; private keys are never uploaded and are only stored if you explicitly opt in to saving them in this browser.',
  keywords: [
    'pgp',
    'openpgp',
    'gpg',
    'encrypt',
    'decrypt',
    'sign',
    'verify',
    'public key',
    'private key',
    'fingerprint',
    'key generation',
    'pgp keygen',
    'armored',
    'clearsign',
    'detached signature',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '',
  acceptsText: true,
  // The PGP flow is multi-step (key generation, import, encrypt/decrypt, sign/verify)
  // with its own per-mode fields, so it opts into the dedicated panel.
  panel: 'pgp-tool',
  options: [
    {
      key: 'mode',
      label: 'Action',
      type: 'select',
      default: 'generate',
      choices: [
        { value: 'generate', label: 'Generate a key pair' },
        { value: 'encrypt', label: 'Encrypt' },
        { value: 'decrypt', label: 'Decrypt' },
        { value: 'sign', label: 'Sign' },
        { value: 'verify', label: 'Verify' },
        { value: 'import', label: 'Import / export keys' },
      ],
    },
    {
      key: 'keyType',
      label: 'Key type',
      type: 'select',
      default: 'ed25519',
      showWhen: { key: 'mode', value: 'generate' },
      choices: [
        { value: 'ed25519', label: 'Ed25519 / Curve25519 (modern, fast)' },
        { value: 'nistp256', label: 'NIST P-256 (ECDSA + ECDH)' },
        { value: 'rsa2048', label: 'RSA 2048-bit' },
        { value: 'rsa4096', label: 'RSA 4096-bit' },
      ],
    },
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      default: '',
      placeholder: 'Ada Lovelace',
      showWhen: { key: 'mode', value: 'generate' },
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      default: '',
      placeholder: 'ada@example.com',
      showWhen: { key: 'mode', value: 'generate' },
    },
    {
      key: 'output',
      label: 'Ciphertext format',
      type: 'select',
      default: 'armored',
      showWhen: { key: 'mode', value: 'encrypt' },
      choices: [
        { value: 'armored', label: 'ASCII-armored text' },
        { value: 'binary', label: 'Binary file (.pgp)' },
      ],
    },
    {
      key: 'signatureStyle',
      label: 'Signature style',
      type: 'select',
      default: 'detached',
      showWhen: { key: 'mode', value: 'sign' },
      choices: [
        { value: 'detached', label: 'Detached signature (.asc)' },
        { value: 'clearsign', label: 'Clearsigned text' },
      ],
    },
  ],
  examples: [
    {
      title: 'Generate an Ed25519 key',
      options: {
        mode: 'generate',
        keyType: 'ed25519',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      },
    },
    {
      title: 'Generate an RSA 4096 key',
      options: { mode: 'generate', keyType: 'rsa4096', name: 'Bob', email: 'bob@example.com' },
    },
    {
      title: 'Generate a NIST P-256 key',
      options: {
        mode: 'generate',
        keyType: 'nistp256',
        name: 'Grace Hopper',
        email: 'grace@example.com',
      },
    },
  ],
  related: ['ssh-key-fingerprint', 'text-encrypt', 'file-encrypt', 'x509-certificate-inspector'],
  credits: [
    {
      name: 'openpgp.js',
      url: 'https://openpgpjs.org/',
      license: 'LGPL-3.0+',
    },
  ],
  status: 'stable',
};
