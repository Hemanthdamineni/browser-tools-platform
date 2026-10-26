import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'keypair-generator',
  name: 'Cryptographic Keypair Generator',
  category: 'crypto',
  summary:
    'Generate RSA, ECDSA or Ed25519 key pairs in the browser and export them as PEM, with an optional sign-and-verify check.',
  description:
    'Create a brand-new public/private key pair entirely on-device with the Web Crypto API. Choose RSA (2048–4096), ECDSA (P-256 or P-384) or Ed25519, copy out the private key (PKCS#8) and public key (SPKI) as PEM, and optionally sign the message in the input box to confirm the pair works.',
  keywords: [
    'keypair',
    'keypair generator',
    'generate rsa key',
    'generate ecdsa key',
    'ed25519',
    'pem export',
    'pkcs8',
    'spki',
    'public key',
    'private key',
    'sign message',
    'verify signature',
    'openssl compatible',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      default: 'rsa-2048',
      choices: [
        { value: 'rsa-2048', label: 'RSA 2048 (SHA-256)' },
        { value: 'rsa-3072', label: 'RSA 3072 (SHA-256)' },
        { value: 'rsa-4096', label: 'RSA 4096 (SHA-256)' },
        { value: 'ecdsa-p256', label: 'ECDSA P-256' },
        { value: 'ecdsa-p384', label: 'ECDSA P-384' },
        { value: 'ed25519', label: 'Ed25519' },
      ],
    },
    {
      key: 'sign',
      label: 'Sign the input text',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'RSA-2048 key pair',
      input: 'Add a message here to sign it with the private key.',
      options: { algorithm: 'rsa-2048' },
    },
    {
      title: 'Ed25519 key pair',
      input: 'ed25519 is compact and fast',
      options: { algorithm: 'ed25519' },
    },
    {
      title: 'ECDSA P-256 without signing',
      input: '',
      options: { algorithm: 'ecdsa-p256', sign: false },
    },
  ],
  related: ['ssh-key-fingerprint', 'x509-certificate-inspector', 'hmac', 'base64'],
  status: 'stable',
};
