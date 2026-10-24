import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'iptables-ruleset-auditor',
  name: 'iptables Ruleset Auditor',
  category: 'security',
  summary:
    'Audit an iptables-save ruleset: chains, policies, reachable ports, shadowed rules and open ports.',
  description:
    'Paste or drop the output of iptables-save and see what the firewall actually does. The auditor parses tables, chains and rules (including -I, -P, -N, -F and -D command lists), then reports each chain with its policy and verdict mix, every rule that can never match because an earlier rule is unconditional, the ports that are accepted from anywhere, log rules that will flood the journal, deprecated matches, jumps to chains that do not exist, chains nothing can reach, and the fail-open combination of a DROP rule under an ACCEPT policy. Rule grammar is checked the way iptables itself checks it, so the errors it quotes are the same ones iptables would print. Nothing is applied, uploaded or executed.',
  keywords: [
    'iptables',
    'firewall audit',
    'iptables-save',
    'netfilter',
    'ruleset analyzer',
    'open ports',
    'linux firewall',
    'chain policy',
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
        { value: 'summary', label: 'Ruleset summary' },
        { value: 'chains', label: 'Chains and policies' },
        { value: 'rules', label: 'Rule inventory' },
        { value: 'ports', label: 'Exposed ports' },
        { value: 'findings', label: 'Findings' },
      ],
      default: 'summary',
    },
    {
      key: 'sensitive',
      label: 'Ports that should not be world-open',
      type: 'text',
      default:
        '22,23,21,25,135,139,445,1433,1521,2049,2375,3306,3389,5432,5601,5900,6379,9200,11211,27017',
      placeholder: '22,3306,6379',
    },
    {
      key: 'top',
      label: 'Ports listed',
      type: 'number',
      default: 15,
      min: 3,
      max: 50,
      step: 1,
    },
  ],
  examples: [
    {
      title: 'A typical server ruleset with a logging chain',
      input:
        '*filter\n:INPUT DROP [0:0]\n:FORWARD DROP [0:0]\n:OUTPUT ACCEPT [0:0]\n:LOG_DROP - [0:0]\n-A INPUT -i lo -j ACCEPT\n-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT\n-A INPUT -p tcp --dport 22 -j ACCEPT\n-A INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT\n-A INPUT -p udp --dport 53 -j ACCEPT\n-A INPUT -j LOG_DROP\n-A LOG_DROP -m limit --limit 5/min -j LOG --log-prefix "iptables denied: "\n-A LOG_DROP -j DROP\nCOMMIT\n*nat\n:PREROUTING ACCEPT [0:0]\n:INPUT ACCEPT [0:0]\n:OUTPUT ACCEPT [0:0]\n:POSTROUTING ACCEPT [0:0]\nCOMMIT\n',
    },
    {
      title: 'Shadowed rule under a blanket ACCEPT',
      input:
        '*filter\n:INPUT ACCEPT [0:0]\n:FORWARD ACCEPT [0:0]\n:OUTPUT ACCEPT [0:0]\n-A INPUT -j ACCEPT\n-A INPUT -p tcp --dport 22 -j DROP\nCOMMIT\n',
    },
    {
      title: 'A leaky chain with a fail-open policy',
      input:
        '*filter\n:INPUT ACCEPT [0:0]\n:FORWARD DROP [0:0]\n:OUTPUT ACCEPT [0:0]\n-A INPUT -p tcp --dport 3306 -j DROP\n-A INPUT -p tcp --dport 22 -j ACCEPT\nCOMMIT\n',
      options: { format: 'findings' },
    },
  ],
  article: [
    {
      heading: 'What the tool reads',
      body: 'The input is iptables-save output \u2014 *table markers, :CHAIN POLICY [packets:bytes] declarations and -A rules \u2014 or a plain list of iptables commands including -A, -P, -N, -F and -D. nftables syntax is detected and refused with an explanation rather than misparsed. Input is capped at 8 MB, and an empty or unrecognisable file is rejected before analysis.',
    },
    {
      heading: 'Choosing the output view',
      body: 'The format option selects the table you get: a ruleset summary, a chain-and-policy listing, a rule inventory, the exposed-port report, or the raw findings list. The analysis underneath is the same whichever you pick, and a note appears once findings exceed the display cap.',
    },
    {
      heading: 'Chain policies and shadowed rules',
      body: 'Each chain is shown with its policy, rule count and verdict mix, and a chain whose policy is ACCEPT but which ends in DROP rules is flagged as fail-open, because anything falling off the end is accepted. A rule is shadowed when an earlier unconditional DROP or REJECT means it can never match, and the report names the shadowing rule number.',
    },
    {
      heading: 'Exposed ports, and where this runs',
      body: 'A port is listed as exposed when an ACCEPT rule in INPUT or FORWARD matches it without restricting source address or interface. Ports on your sensitive list \u2014 SSH, databases, Redis and friends by default \u2014 come first, and a shadowed port is marked when an earlier blanket rule already killed it. Every rule is checked against iptables\u2019 own grammar, so the errors read like iptables\u2019 own. Nothing is executed, applied or uploaded.',
    },
  ],
  faq: [
    {
      q: 'Which firewall formats can it read?',
      a: 'The output of iptables-save (with *table, :CHAIN POLICY [packets:bytes] and -A lines) and a plain list of iptables commands such as -A INPUT -p tcp --dport 22 -j ACCEPT, -P, -N, -F and -D. nftables syntax is recognised and refused with an explanation rather than being misread as iptables, because the two grammars only look alike.',
    },
    {
      q: 'Where do the error messages come from?',
      a: 'Every rule is run through the same grammar iptables uses, so a rule that iptables refuses is reported as an error with the message iptables prints — for example unknown option "--dport" when a port is given without -p tcp, or Can\'t use --out-interface with INPUT. Warnings that need kernel state to confirm, such as a policy name no kernel accepts, are labelled as warnings rather than errors.',
    },
    {
      q: 'What counts as an exposed port?',
      a: 'A port is listed as exposed when an ACCEPT rule in an INPUT or FORWARD chain matches it and that rule does not restrict the source address or interface. Ports on your sensitive list are shown first, and a port is marked shadowed when an earlier unconditional DROP or REJECT rule in the same chain means the ACCEPT can never be reached.',
    },
    {
      q: 'Is anything applied to this machine?',
      a: 'No. The ruleset is read as text in your browser: nothing is uploaded, no iptables command is run, and no network request is made. The analysis is a static reading of the rules you paste.',
    },
  ],
  related: ['ssh-config-auditor', 'systemd-unit-inspector', 'security-headers', 'docker-compose'],
  status: 'stable',
};
