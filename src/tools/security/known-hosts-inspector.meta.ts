import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'known-hosts-inspector',
  name: 'Known Hosts Inspector',
  category: 'security',
  summary:
    'Audit ~/.ssh/known_hosts: hashed vs plain host entries, host-key fingerprints, duplicates and collisions.',
  description:
    'Paste your ~/.ssh/known_hosts file and read its contents without SSH: which entries are plaintext host patterns and which are OpenSSH |1|salt|hash| records, every embedded host key with its SHA256 and MD5 fingerprint and bit size, and how each key is shared across hosts. The inspector flags the situations that actually matter for security: the same host bound to two different keys (a host-key change or a MITM risk), one key reused across many hosts, hashed entries that can be resolved when you type a hostname, wildcard patterns, negations and bracketed [host]:port forms, and malformed or unreadable lines. Type a hostname in the lookup view and the tool tells you which entries cover it — matching plaintext patterns by wildcard and hashed records by recomputing the HMAC-SHA1 host hash on-device. Nothing leaves your browser.',
  keywords: [
    'ssh',
    'known_hosts',
    'host key',
    'fingerprint',
    'hashed host',
    'ssh-keygen',
    'tofu',
    'mitm',
    'host-key pinning',
    'ssh-keyscan',
    'ecdsa',
    'ed25519',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  accept: '.txt,text/plain,application/octet-stream',
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'entries', label: 'Host entries' },
        { value: 'keys', label: 'Host keys' },
        { value: 'lookup', label: 'Hostname lookup' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'host',
      label: 'Hostname to resolve',
      type: 'text',
      default: '',
      placeholder: 'github.com',
    },
  ],
  examples: [
    {
      title: 'Audit a known_hosts file for host-key changes',
      input:
        'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINtHbxwCJ74gi0/0uaZwOGa5ihllz9REBYdSlEyGVqTd box-a\ngithub.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIyKtEKQ8bmaNhNNMn7fKeHqNePnT3q6abJd4/Zh7hyl box-b',
      options: { format: 'findings' },
    },
    {
      title: 'List every host key with its fingerprint',
      input:
        'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINtHbxwCJ74gi0/0uaZwOGa5ihllz9REBYdSlEyGVqTd box-a\ngitlab.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDRKd1a/9qkOFJ24p60t8u0j',
      options: { format: 'keys' },
    },
    {
      title: 'Look up which entries cover a host',
      input:
        'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINtHbxwCJ74gi0/0uaZwOGa5ihllz9REBYdSlEyGVqTd box-a',
      options: { format: 'lookup', host: 'github.com' },
    },
  ],
  related: ['ssh-key-fingerprint', 'ssh-config-auditor', 'file-metadata', 'binary-file-signature'],
  status: 'stable',
  updated: '2026-10-28',
};
