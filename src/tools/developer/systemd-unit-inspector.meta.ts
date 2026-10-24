import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'systemd-unit-inspector',
  name: 'systemd Unit Inspector',
  category: 'developer',
  summary:
    'Inspect and validate systemd unit files: directives, dependencies, ExecStart and hardening.',
  description:
    'Paste or drop a systemd unit file and see what systemd would make of it. The inspector parses sections, comments and backslash continuations, lists every directive with its line number, resolves the ordering and requirement dependencies plus the install targets, tokenises ExecStart the way systemd does, and reports the mistakes systemd refuses to load — a line without an equals sign, a directive outside any section, an unknown key, a service with nothing to run, more than one ExecStart without Type=oneshot, and Restart=always on a oneshot service. It also audits hardening directives and explains the traps that systemd silently tolerates, such as repeated single-value keys and shell syntax that no shell will interpret.',
  keywords: [
    'systemd unit',
    'service file',
    'unit file validator',
    'systemctl',
    'systemd hardening',
    'execstart',
    'wantedby',
    'systemd dependencies',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'summary', label: 'Unit summary' },
        { value: 'directives', label: 'Directives by line' },
        { value: 'dependencies', label: 'Dependencies' },
        { value: 'hardening', label: 'Hardening audit' },
        { value: 'findings', label: 'Findings' },
      ],
      default: 'summary',
    },
    {
      key: 'harden',
      label: 'Audit hardening directives',
      type: 'boolean',
      default: true,
    },
    {
      key: 'name',
      label: 'Unit name (when pasting)',
      type: 'text',
      default: '',
      placeholder: 'e.g. my-app.service',
    },
  ],
  examples: [
    {
      title: 'A small service unit',
      input:
        '[Unit]\nDescription=Example API\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nUser=app\nExecStart=/usr/bin/node /srv/app/server.js\nRestart=on-failure\nNoNewPrivileges=yes\nProtectSystem=strict\nPrivateTmp=yes\n\n[Install]\nWantedBy=multi-user.target',
    },
    {
      title: 'A unit with mistakes',
      input:
        'Description=Outside any section\n\n[Service]\nExecStart=/bin/true\nExecStart=/bin/false\nResatrt=always\nthis line has no equals sign\n',
    },
  ],
  faq: [
    {
      q: 'Does this run systemd or check the live system?',
      a: 'No. The text is parsed on your device and nothing is executed, installed or loaded. The rules it applies are the ones systemd itself applies when it loads a unit file, so the errors it names are the same errors journalctl would show as "ignoring" or "Refusing" lines.',
    },
    {
      q: 'Why is a repeated key only a warning?',
      a: 'Because systemd does not complain about it. Two Description= lines load without any message, and only one value survives. The inspector points the repetition out rather than pretending systemd rejects it, and it knows which directives are meant to repeat, such as ExecStart on a oneshot service, Environment, and the install targets.',
    },
    {
      q: 'What counts as an unknown key?',
      a: "A key in [Unit], [Service], [Socket], [Timer], [Path] or [Install] that is not in the inspector's table of systemd directives. Keys beginning with X- are your own and are never flagged. Because new systemd versions add directives, these are reported as notes rather than errors.",
    },
    {
      q: 'Can it follow dependencies into other unit files?',
      a: 'No, and it says so. A unit named in After=, Requires= or WantedBy= that is not well known and not defined in the pasted text is marked as unresolvable, so you never get a false "missing unit" verdict from a file that was inspected on its own.',
    },
  ],
  related: ['docker-compose', 'dockerfile-generator', 'crontab-generator', 'dotenv'],
  status: 'stable',
};
