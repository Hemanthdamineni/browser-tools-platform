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
