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
  faq: [
    {
      q: 'Which file is this?',
      a: 'The SSH client config: ~/.ssh/config for one user, or /etc/ssh/ssh_config for system-wide settings. Server-side sshd_config uses different keywords and is not what this audits.',
    },
    {
      q: 'How does it decide which block wins?',
      a: 'Exactly as OpenSSH does: the file is read from the top, and the first value found for a keyword is the one that is used. Directives before the first Host line apply to every host and are read first, which is why a Host * block at the top silently beats later, more specific blocks. Put specific hosts first and broad defaults last.',
    },
    {
      q: 'Does it follow Include or evaluate every Match?',
      a: 'Include is reported but not followed, because the included file is not part of what you pasted. Match blocks are evaluated for host and all predicates; blocks that also depend on user, address, exec or tagged are marked as not evaluable here, since those need your live session.',
    },
    {
      q: 'Are the algorithm warnings authoritative?',
      a: 'They flag algorithms that OpenSSH has removed from its defaults or that are widely considered weak, including a leading + that re-appends a weak choice to the defaults. They are a prompt to check your own policy and server versions, not a compliance verdict.',
    },
  ],
  article: [
    {
      heading: 'What an ssh_config audit tells you',
      body: 'Paste a config and the tool resolves any host alias to the settings that will actually apply and which block supplied each one. It lists every Host and Match block as well, and returns a severity-labelled audit covering disabled host key checking, agent forwarding to wildcard hosts, weak or re-enabled algorithms, deprecated keywords and shadowed blocks where an early Host * steals options from later entries.',
    },
    {
      heading: 'A config you are about to rely on',
      body: 'Use it before pushing a config to many machines or when a connection suddenly connects to the wrong host. Resolving a single host shows you the effective value for every keyword, so you can see at a glance whether StrictHostKeyChecking is really off or IdentityFile is pointing where you think it is.',
    },
    {
      heading: 'How the winning block is chosen',
      body: 'Resolution follows OpenSSH exactly: the file is read from the top and the first value found for a keyword wins. Directives before the first Host apply everywhere, which is why a Host * block at the top silently beats later, more specific blocks. The audit flags these shadowing blocks and duplicate or valueless directives.',
    },
    {
      heading: 'The severity labels',
      body: 'Findings are graded by how risky the behaviour is. Disabled host key checking, wildcard agent forwarding and re-enabled weak algorithms rank highest; deprecated keywords, typo directives and shadowed blocks are warnings that the config does not do what it appears to. The resolve view shows the concrete outcome for one host.',
    },
    {
      heading: 'The config never leaves the page',
      body: 'The file is parsed entirely in your browser and nothing is uploaded. The tool works offline, so a config that contains internal hostnames or credentials stays on your machine, and the audit view shows only the resolved settings.',
    },
  ],
  related: ['ssh-key-fingerprint', 'security-headers', 'dotenv', 'editorconfig'],
  status: 'stable',
};
