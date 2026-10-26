import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'ssh-config-auditor',
  name: 'SSH Config Auditor',
  category: 'security',
  summary:
    'Audit an SSH client config: resolve host options, flag risky settings and ordering mistakes.',
  description:
    'Paste an ssh_config file and see what it really does. Resolve any host alias to the settings that will actually apply and which block supplied each one, list every Host and Match block, and get a severity-labelled audit: disabled host key checking, agent forwarding to wildcards, weak or re-enabled algorithms, deprecated keywords, shadowed blocks where a top Host * steals options from later entries, duplicate and valueless directives, and typo keywords.',
  keywords: [
    'ssh config audit',
    'ssh_config',
    'openssh config',
    'strict host key checking',
    'forward agent',
    'proxyjump',
    'ssh hardening',
    'host pattern',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: '.txt,.config,text/plain,application/octet-stream',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'audit', label: 'Audit findings' },
        { value: 'resolve', label: 'Resolved host' },
        { value: 'hosts', label: 'Host and Match blocks' },
        { value: 'summary', label: 'File summary' },
      ],
      default: 'audit',
    },
    {
      key: 'host',
      label: 'Host to resolve',
      type: 'text',
      default: '',
      placeholder: 'prod',
    },
    {
      key: 'checkPolicy',
      label: 'Audit security settings',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'A config with a shadowing Host * block',
      input:
        '# defaults\nHost *\n\tUser deploy\n\tIdentityFile ~/.ssh/id_ed25519\n\tForwardAgent yes\n\nHost prod\n\tHostName prod.example.com:2222\n\tUser root\n\tIdentityFile ~/.ssh/prod_rsa\n\tStrictHostKeyChecking no\n\tCiphers +3des-cbc\n\nHost db\n\tHostName db.internal\n\tPort 2200\n\tProxyCommand nc %h %p',
    },
    {
      title: 'Resolve what applies to a host',
      input:
        'Host *\n\tUser deploy\n\tStrictHostKeyChecking no\n\nHost production\n\tHostName prod.example.com\n\tPort 2222\n\tUser root\n\tForwardAgent yes',
      options: { format: 'resolve', host: 'production' },
    },
    {
      title: 'A clean, hardened config',
      input:
        'Host *\n\tHostKeyAlgorithms ssh-ed25519\n\tMACs hmac-sha2-512\n\tPasswordAuthentication no\n\nHost github\n\tHostName github.com\n\tUser git',
      options: { format: 'audit' },
    },
  ],
  related: ['ssh-key-fingerprint', 'security-headers', 'dotenv', 'editorconfig'],
  status: 'stable',
};
