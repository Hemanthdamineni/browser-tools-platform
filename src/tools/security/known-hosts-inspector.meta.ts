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
    { title: 'Audit a known_hosts file for host-key changes' },
    { title: 'Resolve a hashed host entry back to a hostname' },
  ],
  faq: [
    {
      q: 'Is the host key data sent anywhere?',
      a: 'No. The known_hosts contents are parsed entirely in your browser with the Web Crypto API; nothing is transmitted and the tool works fully offline.',
    },
    {
      q: 'What does a |1|salt|hash| entry mean?',
      a: 'OpenSSH hashes hostnames to keep your SSH history private on disk. The stored value is HMAC-SHA1(key=salt, message=hostname) base64-encoded. The inspector recomputes that hash on-device for the hostname you type, so it can tell you whether a hashed entry covers that host without ever revealing which hosts you use.',
    },
    {
      q: 'Why does my known_hosts show the same key for several hosts?',
      a: 'A single host key is often shared across hostnames of the same server (github.com and api.github.com, or a box reachable by several names). That is normal; the inspector only warns when one key is spread suspiciously wide or when the same host maps to two different keys.',
    },
    {
      q: 'What does a host-key change finding mean?',
      a: 'When the same host pattern is bound to two different key blobs, the key changed between the two records. That can be a legitimate key rotation, or it can mean a man-in-the-middle. The inspector shows both fingerprints side by side so you can compare against what your administrator published.',
    },
  ],
  related: ['ssh-key-fingerprint', 'ssh-config-auditor', 'file-metadata', 'binary-file-signature'],
  status: 'stable',
};