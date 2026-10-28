import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'sudoers-auditor',
  name: 'sudoers Auditor',
  category: 'security',
  summary:
    'Audit a sudoers file for NOPASSWD shells, wildcard commands, env_keep leaks and unused aliases.',
  description:
    'Paste or drop /etc/sudoers (or a drop-in from /etc/sudoers.d) and see what it really grants. The auditor parses Defaults entries and their scopes, aliases, user specs, runas lists, tags and command lists, then reports every grant that is passwordless, that reaches a shell, editor or interpreter (each of which spawns root), that is valid on every host or for every user, that leans on a wildcard, that keeps an environment variable which can load code, or that lists only negated commands and therefore allows everything else. Syntax is checked the way sudo checks it, so the messages it quotes are the ones visudo prints, and includes, unreachable aliases and duplicate specs are reported alongside. Nothing is uploaded, resolved or executed.',
  keywords: [
    'sudoers',
    'sudo',
    'visudo',
    'privilege escalation',
    'nopasswd',
    'sudo policy',
    'linux security',
    'sudoers.d',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'Output',
      type: 'select',
      choices: [
        { value: 'summary', label: 'Policy summary' },
        { value: 'specs', label: 'User specs' },
        { value: 'aliases', label: 'Aliases' },
        { value: 'defaults', label: 'Defaults entries' },
        { value: 'findings', label: 'Findings' },
      ],
      default: 'summary',
    },
    {
      key: 'shells',
      label: 'Commands that count as a shell escape',
      type: 'text',
      default:
        'sh,bash,dash,zsh,ksh,csh,tcsh,fish,env,python,python2,python3,perl,ruby,node,npm,npx,php,lua,awk,gawk,mawk,sed,ed,vi,vim,nvim,nano,emacs,less,more,man,find,tar,zip,unzip,rsync,git,screen,tmux,docker,podman,kubectl,mount,umount,fdisk,dd,chroot,su,sudo,strace,ltrace,gdb,make,ssh,scp,tee,chmod,chown,setfacl,passwd,apt,apt-get,dnf,yum,pacman,pip,pip3,systemctl',
      placeholder: 'sh,bash,python,vim,systemctl',
    },
  ],
  examples: [
    {
      title: 'A typical /etc/sudoers with aliases, tags and a drop-in directory',
      input:
        'Defaults        env_reset\n' +
        'Defaults        secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\n' +
        'Defaults        env_keep += "LD_PRELOAD"\n' +
        'Defaults        mail_badpass, logfile="/var/log/sudo.log"\n' +
        'Defaults>root   env_keep += "HOME"\n' +
        'Defaults:%sudo  !requiretty\n' +
        'User_Alias      ADMINS = alice, bob\n' +
        'Runas_Alias     OP = root, operator\n' +
        'Host_Alias      WEB = web1, web2\n' +
        'Cmnd_Alias      SERVICES = /usr/bin/systemctl restart nginx, /usr/bin/systemctl status nginx\n' +
        'Cmnd_Alias      SITEEDIT = sudoedit /etc/nginx/*\n' +
        'root            ALL=(ALL:ALL) ALL\n' +
        'ADMINS          WEB=(OP) SERVICES, SITEEDIT\n' +
        '%sudo           ALL=(ALL:ALL) ALL\n' +
        'deploy          WEB=(root) NOPASSWD: /usr/bin/systemctl restart nginx, /bin/sh\n' +
        'backup          ALL=(ALL) NOPASSWD: ALL\n' +
        '#includedir /etc/sudoers.d\n',
    },
  ],
  faq: [
    {
      q: 'Is it safe to paste a sudoers file here?',
      a: 'Yes. Everything is parsed as text in your browser: nothing is uploaded, no sudo command is run and no network request is made. That matters more than usual with sudoers, because the file describes exactly which accounts can become root on which hosts.',
    },
    {
      q: 'Where do the syntax messages come from?',
      a: 'The parser follows the same grammar sudo does, so a line sudo refuses is reported as an error with the wording visudo prints, such as unknown defaults entry "bogus_option", value "abc" is invalid for option "passwd_timeout", syntax error, or User_Alias "BADALL" referenced but not defined. Note that visudo reports undefined alias references without failing the parse, so this auditor counts them as errors while still showing the rest of the file.',
    },
    {
      q: 'What can a browser not check?',
      a: 'Include directives (#include and @includedir) are listed but never followed, because the auditor cannot read /etc/sudoers.d from a dropped file. Group, user and host names are not resolved either, so a rule naming a group that does not exist is accepted rather than guessed at. Those limits are reported as notes, and the effective policy is the one written in the text you paste.',
    },
    {
      q: 'What makes a grant risky?',
      a: 'A passwordless grant that reaches a shell, editor or interpreter, because any of those can run arbitrary commands as the target user. Also: a grant covering ALL commands, a wildcard that can be widened, an env_keep variable such as LD_PRELOAD that loads code into the privileged process, a command list of only negated entries (sudoers then allows everything else), and Defaults !authenticate.',
    },
  ],
  related: [  "iptables-ruleset-auditor",
  "ssh-config-auditor",
  "systemd-unit-inspector",
  "docker-compose"],
  status: 'stable',
};
