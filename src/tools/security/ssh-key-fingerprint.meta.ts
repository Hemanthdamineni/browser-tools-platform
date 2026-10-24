import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ssh-key-fingerprint',
  name: 'SSH Key Fingerprint',
  category: 'security',
  summary: 'Compute the SHA256 and MD5 fingerprints of an SSH public key, with key type and size.',
  description:
    'Paste your SSH public key (the .pub file, authorized_keys line, or GitHub "ssh-rsa AAAA…" block) and get the standard OpenSSH fingerprints — the modern SHA256 base64 form (SHA256:…) and the classic MD5 colon-hex form — plus the key type, bit size and any comment. Useful for verifying that the key you installed matches the one on your server, or checking host keys against printed fingerprints. Everything runs on-device: the key never leaves your browser.',
  keywords: [
    'ssh key fingerprint',
    'ssh fingerprint',
    'public key',
    'authorized_keys',
    'SHA256 fingerprint',
    'MD5 fingerprint',
    'ssh-rsa',
    'ssh-ed25519',
    'ecdsa',
    'key fingerprint check',
    'known_hosts',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  article: [
    {
      heading: 'Two fingerprints for one key',
      body: 'Paste a public key — a .pub file, a line from authorized_keys, or the ssh-rsa AAAA... block — and the tool parses the OpenSSH blob and reports the modern SHA256 base64 fingerprint alongside the classic MD5 colon-hex form, plus the key type, bit size and any trailing comment.',
    },
    {
      heading: 'Confirming the key you installed is the key you meant',
      body: 'After copying a key to a server, compare the fingerprint shown here with the one the server reports: identical fingerprints mean it is the same key. It is the same check when verifying a host key against a printed fingerprint, or comparing a deploy key stored in two places.',
    },
    {
      heading: 'Why there is nothing to configure',
      body: 'A fingerprint is a function of the key, so there are no options. The base64 blob is decoded, the internal key type and modulus are read to derive the bit size, and the blob is hashed with SHA-256 for the modern form and MD5 for the legacy one. For RSA keys the size comes from the modulus; for Ed25519 the type fixes it.',
    },
    {
      heading: 'Caveats',
      body: 'Only the public key is needed; a private key will not work. Supported types are ssh-rsa, ssh-ed25519, the ecdsa-sha2-nistp256/384/521 family, ssh-dss and the sk- variants. Surrounding whitespace is trimmed, and a line that is not a recognisable public key is rejected.',
    },
    {
      heading: 'Computed locally',
      body: 'The blob is decoded and hashed in your browser and the key is never uploaded. Public keys are not secret, but keeping the check local means you can compare fingerprints without pasting them into a third-party service.',
    },
  ],
  examples: [
    {
      title: 'Ed25519 key',
      input:
        'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJZ7w0x3J7Z1ZHzqbIrVeg9d3gk5PpUy9oRwWzFdFn example@host',
    },
    {
      title: 'RSA key',
      input:
        'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDLUDxVLEWAgE0k3F4D5T1JkGfTS8W0V0Zg2kboU7pPnS9fT0i8ZQfbD6E2L5kC8tSxL1kMjQnVmK8dJpM2sO4yZcQ1X2pRfW7cUJ9jH9qBzQ8YzNnE2x3Pk5bwUiMm6eIYGhFjKzLzKey@host',
    },
    {
      title: 'A key pasted without its comment',
      input: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJZ7w0x3J7Z1ZHzqbIrVeg9d3gk5PpUy9oRwWzFdFn',
    },
  ],
  faq: [
    {
      q: 'What does the fingerprint verify?',
      a: 'Two keys produce identical fingerprints only if they are the same key. After copying a key to a server, compare the fingerprint shown here with the one your server reports to confirm they match.',
    },
    {
      q: 'Which fingerprint should I use?',
      a: 'Modern OpenSSH (and GitHub) use the SHA256 form by default — start with that. The MD5 form is the older classic fingerprint and is still shown by some systems.',
    },
    {
      q: 'Is my private key needed?',
      a: 'No. Only the public key (the .pub file or the ssh-rsa/ssh-ed25519/ecdsa line) is required — never paste a private key.',
    },
    {
      q: 'What key types are supported?',
      a: 'ssh-rsa, ssh-ed25519, ecdsa-sha2-nistp256 (and the nistp384/521 variants), ssh-dss, and the sk- prefixed security-key variants.',
    },
  ],
  related: ['text-encrypt', 'totp-authenticator', 'secret-scanner', 'passphrase'],
  status: 'stable',
};
