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
        'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAAgQDimgA3WT34Riu5WUXpQGK5r5rULP5BHGHoInHLR/5PXHKfm5YOV05FPrYPjbP/VSGlHku3OjuYJegw85k/VGzXQ9BbjEHmxqm5QV5/MBA9TJ9oEILw2Oe6aXFSU2VWP1HH7dXoKsgLnEpoxQGrV3Vzjk0uekUlwNyI5YlcGAvRxw== deploy@build01',
    },
    {
      title: 'A key pasted without its comment',
      input: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJZ7w0x3J7Z1ZHzqbIrVeg9d3gk5PpUy9oRwWzFdFn',
    },
  ],
  related: ['text-encrypt', 'totp-authenticator', 'secret-scanner', 'passphrase'],
  status: 'stable',
};
