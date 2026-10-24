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
  article: [
    {
      heading: 'What this generates',
      body: 'Pick an algorithm from the panel, RSA 2048, 3072 or 4096, ECDSA on P-256 or P-384, or Ed25519, and this calls the Web Crypto generateKey to mint a brand-new pair in memory. The result table shows the algorithm, key size, a SHA-256 fingerprint of the public SPKI bytes, and both keys as PEM blocks you copy out, the private one in PKCS#8 and the public in SPKI.',
    },
    {
      heading: 'Why the sign-and-verify step is there',
      body: 'With Sign the input text on, whatever you typed is signed with the fresh private key and the signature is checked against the public key, so the exported pair is proven coherent before you use it. That catches a mistyped or truncated PEM early rather than at 2 a.m. on a production server.',
    },
    {
      heading: 'How the PEMs behave outside the browser',
      body: 'Private key PKCS#8 and public key SPKI are the plain, unencrypted forms that openssl genpkey and openssl rsa or ec write accept, so the blocks drop straight into key files or OpenSSL pipelines. No passphrase is baked in, so wrap a stored key with something like openssl pkcs8 -topk8 if you need it encrypted at rest.',
    },
    {
      heading: 'Caveats about size and safety',
      body: 'Larger RSA keys must search for ever-bigger primes and can take several seconds, so RSA-4096 feels slow rather than broken. Ed25519 is the smallest and fastest choice here. Because the key lives only in memory and clipboard history, it suits short-lived test and development keys, not long-lived production secrets you would back up on trusted hardware.',
    },
  ],
  faq: [
    {
      q: 'Are the keys stored anywhere?',
      a: 'No. Keys are generated in memory with the browser\u2019s secure random generator, shown once, and discarded when the page reloads. Copy both keys before leaving — they cannot be recovered.',
    },
    {
      q: 'Are the exported PEMs OpenSSL compatible?',
      a: 'Yes. The private key is standard PKCS#8 (no encryption) and the public key is SPKI, the formats openssl genpkey and openssl rsa/ec write. Wrap them in a password with tools like openssl pkcs8 -topk8 if you store them.',
    },
    {
      q: 'Should I generate production keys this way?',
      a: 'For anything long-lived, prefer generating keys on a trusted machine or hardware token and backing them up offline. Browser-generated keys are convenient and cryptographically random, but the private key lives only in your clipboards history.',
    },
    {
      q: 'What does sign-and-verify prove?',
      a: 'It proves the exported pair is coherent: the signature made with the private key verifies against the public key. Useful right after generating keys to catch copy/paste errors.',
    },
    {
      q: 'Why is RSA-4096 slow?',
      a: 'Finding two 2048-bit primes takes a few seconds of computation. If the page seems frozen, it is working — larger keys are safer but slower both here and on every sign/verify.',
    },
  ],
  related: ['ssh-key-fingerprint', 'x509-certificate-inspector', 'hmac', 'base64'],
  status: 'stable',
};
