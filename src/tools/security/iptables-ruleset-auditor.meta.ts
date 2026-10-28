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
  related: ['ssh-config-auditor', 'systemd-unit-inspector', 'security-headers', 'docker-compose'],
  status: 'stable',
};
