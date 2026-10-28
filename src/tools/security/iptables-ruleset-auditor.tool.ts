import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './iptables-ruleset-auditor.meta';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_RULES = 20000;
const MAX_ROWS = 2000;
const MAX_FINDINGS = 300;
const MAX_LINE = 8192;
const CLIP = 100;

const DEFAULT_SENSITIVE = [
  22, 23, 21, 25, 135, 139, 445, 1433, 1521, 2049, 2375, 3306, 3389, 5432, 5601, 5900, 6379, 9200,
  11211, 27017,
];

/** Well-known /etc/services names, so a service name can still be checked against the sensitive list. */
const SERVICE_PORTS: Record<string, number> = {
  ftp: 21,
  ssh: 22,
  telnet: 23,
  smtp: 25,
  domain: 53,
  dns: 53,
  http: 80,
  pop3: 110,
  sunrpc: 111,
  ntp: 123,
  imap: 143,
  snmp: 161,
  ldap: 389,
  https: 443,
  smb: 445,
  ldaps: 636,
  imaps: 993,
  pop3s: 995,
  'ms-sql-s': 1433,
  nfs: 2049,
  mysql: 3306,
  'ms-wbt-server': 3389,
  postgresql: 5432,
  redis: 6379,
  elasticsearch: 9200,
  memcache: 11211,
  mongodb: 27017,
  docker: 2375,
};

/** Targets that end chain evaluation when they match unconditionally. */
const TERMINAL_NAMES = new Set(['ACCEPT', 'DROP', 'REJECT', 'RETURN']);
/** Extension targets, which are not chain references. */
const TARGETS = new Set([
  'ACCEPT',
  'DROP',
  'REJECT',
  'RETURN',
  'QUEUE',
  'NFQUEUE',
  'LOG',
  'ULOG',
  'MARK',
  'CONNMARK',
  'CONNSECMARK',
  'SECMARK',
  'TEE',
  'TPROXY',
  'MASQUERADE',
  'SNAT',
  'DNAT',
  'REDIRECT',
  'NETMAP',
  'SET',
  'CLUSTERIP',
  'NOTRACK',
  'CT',
  'CHECKSUM',
  'TCPMSS',
  'TOS',
  'TTL',
  'HL',
  'CLASSIFY',
  'DSCP',
  'ECN',
  'HMARK',
  'IDLETIMER',
  'LED',
  'RATEEST',
  'TRACE',
  'SYNPROXY',
  'AUDIT',
  'NFLOG',
  'OSF',
  'CHAOS',
]);
/** Match modules this auditor knows; anything else is a note, never a rejection. */
const MATCHES = new Set([
  'conntrack',
  'state',
  'multiport',
  'limit',
  'comment',
  'icmp',
  'icmp6',
  'tcp',
  'udp',
  'udplite',
  'sctp',
  'dccp',
  'addrtype',
  'mac',
  'iprange',
  'mark',
  'owner',
  'recent',
  'set',
  'time',
  'string',
  'hashlimit',
  'length',
  'physdev',
  'pkttype',
  'policy',
  'quota',
  'rpfilter',
  'socket',
  'statistic',
  'tos',
  'ttl',
  'hbh',
  'frag',
  'ah',
  'esp',
  'esp6',
  'ipv6header',
  'mh',
  'rt',
  'hl',
  'ecn',
  'dscp',
  'helper',
  'connbytes',
  'connlimit',
  'connlabel',
  'ct',
  'cgroup',
  'bpf',
]);
const PORT_PROTOCOLS = new Set(['tcp', 'udp', 'sctp', 'dccp', 'udplite']);
const NUMERIC_PROTOCOLS: Record<string, string> = {
  '6': 'tcp',
  '17': 'udp',
  '33': 'dccp',
  '132': 'sctp',
  '136': 'udplite',
};
const VALID_STATES = new Set([
  'NEW',
  'ESTABLISHED',
  'RELATED',
  'INVALID',
  'UNTRACKED',
  'SNAT',
  'DNAT',
]);
const BUILT_IN: Record<string, string[]> = {
  filter: ['INPUT', 'FORWARD', 'OUTPUT'],
  nat: ['PREROUTING', 'INPUT', 'OUTPUT', 'POSTROUTING'],
  mangle: ['PREROUTING', 'INPUT', 'FORWARD', 'OUTPUT', 'POSTROUTING'],
  raw: ['PREROUTING', 'OUTPUT'],
  security: ['INPUT', 'FORWARD', 'OUTPUT'],
};
const NO_INTERFACE: Record<string, string> = {
  OUTPUT: "Can't use --in-interface with OUTPUT",
  POSTROUTING: "Can't use --in-interface with POSTROUTING",
};
const NO_OUT_INTERFACE: Record<string, string> = {
  INPUT: "Can't use --out-interface with INPUT",
  PREROUTING: "Can't use --out-interface with PREROUTING",
};
/** Options that consume the following token. */
const TAKES_ARGUMENT = new Set([
  '-s',
  '--source',
  '-d',
  '--destination',
  '-i',
  '--in-interface',
  '-o',
  '--out-interface',
  '-p',
  '--protocol',
  '-j',
  '--jump',
  '-g',
  '--goto',
  '-m',
  '--match',
  '--dport',
  '--sport',
  '--dports',
  '--sports',
  '--destination-ports',
  '--source-ports',
  '--ctstate',
  '--state',
  '--icmp-type',
  '--icmpv6-type',
  '--to-destination',
  '--to-source',
  '--to-ports',
  '--reject-with',
  '--log-prefix',
  '--log-level',
  '--log-tcp-sequence',
  '--log-tcp-options',
  '--log-ip-options',
  '--limit',
  '--limit-burst',
  '--comment',
  '--tcp-flags',
  '--mark',
  '--set-mark',
  '--set-xmark',
  '--physdev-in',
  '--physdev-out',
  '--uid-owner',
  '--gid-owner',
  '--mac-source',
  '--src-range',
  '--dst-range',
  '--name',
  '--set',
  '--string',
  '--hex-string',
  '--hashlimit-name',
  '--hashlimit-above',
  '--hashlimit-burst',
  '--hashlimit-mode',
  '--hashlimit-upto',
  '--hitcount',
  '--seconds',
  '--ttl-set',
  '--ttl-eq',
  '--ttl-lt',
  '--ttl-gt',
  '--ttl-dec',
  '--tos',
  '--dscp',
  '--dscp-class',
  '--set-mss',
  '--gateway',
  '--mode',
  '--tunnel-src',
  '--tunnel-dst',
  '--proto',
  '--helper',
  '--connbytes',
  '--connlimit-above',
  '--connlimit-mask',
  '--connlabel',
  '--cgroup',
  '--object',
  '--object-name',
  '--realms',
  '--ahspi',
  '--espspi',
  '--length',
  '--pkt-type',
  '--u32',
  '--quota',
  '--rateest1',
  '--rateest2',
  '--rateest-bps',
  '--rateest-pps',
  '--rateest-interval',
  '--radix',
  '-W',
  '--wait-interval',
  '--reap',
  '--set-counters',
  '--zone',
  '--dst-type',
  '--src-type',
  '--idletimer',
  '--led-trigger-id',
  '--led-delay',
  '--rateest-name',
  '--rateest-ewmalog',
  '--nflog-group',
  '--nflog-prefix',
  '--nflog-range',
  '--nflog-threshold',
  '--ulog-nlgroup',
  '--ulog-prefix',
  '--ulog-qthreshold',
  '--audit-type',
]);
/** Flags that stand alone; the parser accepts them without a value. */
const FLAG_OPTIONS = new Set([
  '--syn',
  '-n',
  '--numeric',
  '--random',
  '-w',
  '--wait',
  '-v',
  '--verbose',
  '-f',
  '--fragment',
  '--physdev-is-in',
  '--physdev-is-out',
  '--physdev-is-bridged',
  '--rttl',
  '--update',
  '--ecn-tcp-remove',
  '--line-numbers',
  '--fragment',
  '--checksum-fill',
  '--tcp-option',
  '--clamp-mss-to-pmtu',
]);

interface PortSpec {
  text: string;
  kind: 'dport' | 'sport';
  first: number;
  last: number;
  service: string;
}

interface Rule {
  number: number;
  line: number;
  table: string;
  chain: string;
  operation: string;
  raw: string;
  tokens: string[];
  matchText: string;
  targetText: string;
  target: string;
  proto: string;
  ports: PortSpec[];
  source: string;
  sourceNegated: boolean;
  destination: string;
  inInterface: string;
  outInterface: string;
  states: string[];
  modules: string[];
  unknownModules: string[];
  unconditional: boolean;
  comment: string;
  inserted: boolean;
  errors: string[];
  notes: string[];
}

interface ChainInfo {
  name: string;
  table: string;
  policy: string;
  user: boolean;
  rules: Rule[];
}

interface Finding {
  level: 'error' | 'warning' | 'note';
  problem: string;
  detail: string;
}

const clip = (value: string, max = CLIP): string => {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

const isNumber = (value: string): boolean => /^\d+$/u.test(value);

/** Splits a command line into words, honouring quotes and trailing comments. */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote = '';
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? '';
    if (quote !== '') {
      if (character === '\\' && index + 1 < line.length) {
        current += line[index + 1] ?? '';
        index += 1;
        continue;
      }
      if (character === quote) {
        quote = '';
        continue;
      }
      current += character;
      continue;
    }
    if (character === '#' && current === '') break;
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '\\' && index + 1 < line.length) {
      current += line[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (/\s/u.test(character)) {
      if (current !== '') {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += character;
  }
  if (current !== '') tokens.push(current);
  return tokens;
}

/** Parses one port, port range or multiport element, quoting the same message iptables uses. */
function parsePortSpec(
  text: string,
  kind: 'dport' | 'sport',
): { spec: PortSpec | null; error: string } {
  const trimmed = text.trim();
  if (trimmed === '') return { spec: null, error: "invalid port/service `' specified" };
  const bad = { spec: null, error: 'invalid port/service `' + trimmed + "' specified" };
  const parts = trimmed.split(':');
  if (parts.length > 2) return bad;
  const first = parts[0] ?? '';
  const last = parts.length === 2 ? (parts[1] ?? '') : first;
  const name = /^[A-Za-z][A-Za-z0-9-]*$/u;
  if (first !== '' && !isNumber(first) && !name.test(first)) return bad;
  if (last !== '' && !isNumber(last) && !name.test(last)) return bad;
  const firstNumber = first === '' ? 0 : isNumber(first) ? Number.parseInt(first, 10) : null;
  const lastNumber = last === '' ? 65535 : isNumber(last) ? Number.parseInt(last, 10) : null;
  for (const value of [firstNumber, lastNumber]) {
    if (value !== null && (value < 0 || value > 65535)) return bad;
  }
  return {
    spec: {
      text: trimmed,
      kind,
      first: firstNumber ?? 0,
      last: lastNumber ?? 65535,
      service: firstNumber === null ? first.toLowerCase() : '',
    },
    error: '',
  };
}

interface ParseState {
  saveMode: boolean;
  currentTable: string;
  tables: Map<string, Map<string, ChainInfo>>;
  rules: Rule[];
  findings: Finding[];
  deletions: number;
}

function parseRule(tokens: string[], chain: ChainInfo, line: number, operation: string): Rule {
  const errors: string[] = [];
  const ports: PortSpec[] = [];
  const modules: string[] = [];
  const unknownModules: string[] = [];
  const states: string[] = [];
  let proto = '';
  let source = '';
  let sourceNegated = false;
  let destination = '';
  let inInterface = '';
  let outInterface = '';
  let target = '';
  let jumped = false;
  let comment = '';
  let pendingNegation = false;
  const startIndex =
    operation === '-I' || operation === '--insert' ? (isNumber(tokens[2] ?? '') ? 3 : 2) : 2;
  let targetStart = tokens.length;

  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    if (token === '') continue;
    if (token === '!') {
      pendingNegation = true;
      continue;
    }
    let option = token;
    let negated = pendingNegation;
    pendingNegation = false;
    if (option.startsWith('!') && option.length > 1) {
      negated = true;
      option = option.slice(1);
    }
    if (!option.startsWith('-')) {
      errors.push('unknown option "' + option + '"');
      continue;
    }
    let value = '';
    if (TAKES_ARGUMENT.has(option)) {
      const next = tokens[index + 1];
      if (next === undefined) {
        errors.push('option "' + option + '" requires an argument');
        continue;
      }
      if (next === '!') {
        value = tokens[index + 2] ?? '';
        index += 2;
      } else {
        value = next;
        index += 1;
      }
    }
    switch (option) {
      case '-s':
      case '--source':
        source = value;
        sourceNegated = negated;
        break;
      case '-d':
      case '--destination':
        destination = value;
        break;
      case '-i':
      case '--in-interface':
        inInterface = value;
        break;
      case '-o':
      case '--out-interface':
        outInterface = value;
        break;
      case '-p':
      case '--protocol': {
        const lower = value.toLowerCase();
        proto = NUMERIC_PROTOCOLS[lower] ?? lower;
        break;
      }
      case '-m':
      case '--match':
        if (MATCHES.has(value)) modules.push(value);
        else unknownModules.push(value);
        break;
      case '-j':
      case '--jump':
      case '-g':
      case '--goto':
        if (jumped) errors.push('multiple --jump options not allowed');
        jumped = true;
        target = value;
        targetStart = Math.min(targetStart, index - 1);
        break;
      case '--dport':
      case '--sport':
      case '--dports':
      case '--sports':
      case '--destination-ports':
      case '--source-ports': {
        const sport = option === '--sport' || option === '--sports' || option === '--source-ports';
        if (!PORT_PROTOCOLS.has(proto)) {
          errors.push('unknown option "' + option + '"');
          break;
        }
        for (const element of value.split(',')) {
          const parsed = parsePortSpec(element, sport ? 'sport' : 'dport');
          if (parsed.error !== '') errors.push(parsed.error);
          else if (parsed.spec !== null) ports.push(parsed.spec);
        }
        break;
      }
      case '--ctstate':
      case '--state': {
        if (option === '--state') modules.push('state');
        for (const element of value.split(',')) {
          const upper = element.trim().toUpperCase();
          if (upper === '') continue;
          if (!VALID_STATES.has(upper)) errors.push('Bad ctstate "' + element.trim() + '"');
          else states.push(upper);
        }
        break;
      }
      case '--comment':
      case '--log-prefix':
        comment = value;
        break;
      case '--tcp-flags':
        index += 1;
        break;
      default:
        if (!TAKES_ARGUMENT.has(option) && !FLAG_OPTIONS.has(option))
          errors.push('unknown option "' + option + '"');
        break;
    }
  }

  if (inInterface !== '' && chain.name in NO_INTERFACE) errors.push(NO_INTERFACE[chain.name] ?? '');
  if (outInterface !== '' && chain.name in NO_OUT_INTERFACE)
    errors.push(NO_OUT_INTERFACE[chain.name] ?? '');

  const matchTokens = tokens.slice(startIndex, Math.min(targetStart, tokens.length));
  const targetTokens = targetStart < tokens.length ? tokens.slice(targetStart) : [];
  return {
    number: 0,
    line,
    table: chain.table,
    chain: chain.name,
    operation,
    raw: tokens.join(' '),
    tokens,
    matchText: matchTokens.join(' '),
    targetText: targetTokens.join(' '),
    target: target.toUpperCase(),
    proto: proto === '' ? 'all' : proto,
    ports,
    source,
    sourceNegated,
    destination,
    inInterface,
    outInterface,
    states,
    modules,
    unknownModules,
    unconditional: matchTokens.length === 0,
    comment,
    inserted: operation === '-I' || operation === '--insert',
    errors: errors.filter((error) => error !== ''),
    notes: [],
  };
}

/** True when the text is nftables syntax rather than iptables. */
function looksLikeNft(text: string): boolean {
  return text.split('\n').some((line) => {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('#') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith(':') ||
      trimmed.startsWith('-')
    )
      return false;
    return (
      /^table\s+(ip|ip6|inet|bridge|arp|netdev)\s/u.test(trimmed) ||
      /^chain\s+\S+/u.test(trimmed) ||
      /^(add|flush|delete)\s+(table|chain|rule|set|map)\s/u.test(trimmed)
    );
  });
}

const isEstablishedAccept = (rule: Rule): boolean =>
  rule.target === 'ACCEPT' &&
  (rule.states.includes('ESTABLISHED') || rule.states.includes('RELATED'));

function analyze(state: ParseState): Finding[] {
  const findings = state.findings;
  const push = (level: Finding['level'], problem: string, detail: string): void => {
    if (findings.length < MAX_FINDINGS) findings.push({ level, problem, detail });
  };
  const chains: ChainInfo[] = [];
  for (const tableChains of state.tables.values())
    for (const chain of tableChains.values()) chains.push(chain);
  const declared = new Set(chains.map((chain) => chain.name));
  const seen = new Map<string, Rule>();

  for (const chain of chains) {
    let dead = '';
    for (const rule of chain.rules) {
      for (const error of rule.errors) {
        push(
          'error',
          'A rule is not valid iptables grammar',
          'Line ' + rule.line + ': ' + error + ' — ' + clip(rule.raw, 80),
        );
      }
      if (rule.errors.length > 0) {
        // iptables refuses a ruleset containing an invalid rule, so it cannot shadow anything.
      } else if (dead !== '') {
        rule.notes.push('unreachable, rule ' + dead + ' matches everything');
        push(
          'warning',
          'A rule can never match',
          'Line ' +
            rule.line +
            ' sits after rule ' +
            dead +
            ' in ' +
            chain.name +
            ', which has no match conditions. iptables stops at the first match, so this rule is dead.',
        );
      } else if (rule.unconditional && TERMINAL_NAMES.has(rule.target)) {
        dead = String(rule.number);
      }
      if (rule.target !== '' && !TARGETS.has(rule.target) && !declared.has(rule.target)) {
        push(
          'error',
          'A rule jumps to a chain that does not exist',
          'Line ' +
            rule.line +
            ' targets ' +
            rule.target +
            ', which no table creates (iptables: No chain/target/match by that name).',
        );
      }
      if (rule.modules.includes('state')) {
        push(
          'warning',
          'A deprecated match module is used',
          'Line ' +
            rule.line +
            ' uses -m state; -m conntrack --ctstate is the current spelling and understands more states.',
        );
      }
      if (rule.unknownModules.length > 0) {
        push(
          'note',
          'A match module this auditor does not know',
          'Line ' +
            rule.line +
            ' loads ' +
            rule.unknownModules.join(', ') +
            '. It is kept as written; only your kernel can say whether the module exists.',
        );
      }
      if (rule.target === 'LOG' && !rule.modules.includes('limit')) {
        push(
          'warning',
          'A log rule has no rate limit',
          'Line ' +
            rule.line +
            ' logs every packet; without -m limit --limit N/min a port scan fills the journal.',
        );
      }
      if (rule.ports.some((port) => port.text === '0')) {
        push(
          'note',
          'A rule matches port 0',
          'Line ' +
            rule.line +
            ' matches port 0, which iptables accepts but no service listens on.',
        );
      }
      if (
        rule.target === 'ACCEPT' &&
        rule.proto === 'tcp' &&
        rule.ports.length > 0 &&
        !rule.tokens.includes('--syn')
      ) {
        rule.notes.push('no --syn');
        push(
          'note',
          'A TCP port is accepted without --syn',
          'Line ' +
            rule.line +
            ' accepts every TCP flag combination on port ' +
            rule.ports.map((port) => port.text).join('/') +
            '; adding --syn accepts connection attempts only.',
        );
      }
      const key = chain.name + ' ' + rule.raw;
      const previous = seen.get(key);
      if (previous !== undefined) {
        rule.notes.push('duplicate of rule ' + previous.number);
        push(
          'warning',
          'A duplicate rule',
          'Lines ' +
            previous.line +
            ' and ' +
            rule.line +
            ' are identical and always match together.',
        );
      } else {
        seen.set(key, rule);
      }
    }
    const droppers = chain.rules.filter(
      (rule) => rule.target === 'DROP' || rule.target === 'REJECT',
    );
    if (droppers.length > 0 && chain.policy === 'ACCEPT') {
      push(
        'warning',
        'A drop rule sits under an ACCEPT policy',
        chain.name +
          ' ends by accepting whatever its explicit DROP and REJECT rules miss. A policy of DROP is the fail-closed choice.',
      );
    }
    const effectiveDrop =
      chain.policy === 'DROP' ||
      chain.rules.some(
        (rule) => rule.unconditional && (rule.target === 'DROP' || rule.target === 'REJECT'),
      );
    if (
      effectiveDrop &&
      chain.rules.length > 0 &&
      (chain.name === 'INPUT' || chain.name === 'FORWARD') &&
      !chain.rules.some(isEstablishedAccept)
    ) {
      push(
        'warning',
        'Nothing accepts established connections',
        chain.name +
          ' drops by default but has no -m conntrack --ctstate ESTABLISHED,RELATED rule, so replies to connections this host started can be dropped.',
      );
    }
  }

  const referenced = new Set<string>();
  for (const chain of chains)
    for (const rule of chain.rules)
      if (rule.target !== '' && !TARGETS.has(rule.target)) referenced.add(rule.target);
  for (const chain of chains) {
    if (chain.user && !referenced.has(chain.name)) {
      push(
        'note',
        'A user chain is never referenced',
        chain.name + ' is created but no rule jumps to it, so its rules never run.',
      );
    }
  }

  for (const chain of chains) {
    if (chain.policy !== '' && chain.policy !== 'ACCEPT' && chain.policy !== 'DROP') {
      push(
        'warning',
        'A policy name no kernel accepts',
        chain.name +
          ' in table ' +
          chain.table +
          ' has policy ' +
          chain.policy +
          '. The iptables-save parser accepts any word here; the kernel only knows ACCEPT and DROP.',
      );
    }
  }

  if (findings.some((finding) => finding.level === 'error')) {
    push(
      'note',
      'The ruleset would be refused before it does anything',
      'iptables-restore applies a table only after parsing all of it, so while an error is present the rules below describe intent rather than a running firewall.',
    );
  }
  if (state.saveMode && state.currentTable !== '') {
    push(
      'error',
      'A table is not closed',
      'Table ' +
        state.currentTable +
        ' has no COMMIT, so iptables-restore stops with "COMMIT expected" and applies nothing.',
    );
  }
  return findings;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const top = Math.max(3, Math.min(50, Number(options.top ?? 15) || 15));
  const sensitiveRaw = String(options.sensitive ?? '');
  const sensitive = new Set(
    (sensitiveRaw.trim() === '' ? DEFAULT_SENSITIVE.map(String) : sensitiveRaw.split(/[,\s]+/u))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0 && value < 65536),
  );

  const source = (input.files ?? [])[0];
  let text: string;
  let sourceLabel: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES)
      throw new ToolError(
        'That file is larger than 8 MB.',
        'A ruleset is normally a few kilobytes.',
      );
    text = new TextDecoder('utf-8', { fatal: false }).decode(
      new Uint8Array(await source.arrayBuffer()),
    );
    sourceLabel = source.name === '' ? 'uploaded file' : source.name;
  } else {
    text = String(input.text ?? '');
    if (text.trim() === '')
      throw new ToolError(
        'No ruleset was provided.',
        'Paste the output of iptables-save or a list of iptables -A commands.',
      );
    sourceLabel = 'pasted text';
  }
  if (text.length > MAX_BYTES) throw new ToolError('That is more than 8 MB of input.');
  if (looksLikeNft(text)) {
    throw new ToolError(
      'This looks like an nftables ruleset, not iptables.',
      'nft syntax (table ip filter, chain input { ... }) is a different grammar; paste the output of iptables-save instead.',
    );
  }

  const lines = text.split('\n');
  const saveMode = lines.some((line) => line.trim().startsWith('*'));
  const state: ParseState = {
    saveMode,
    currentTable: saveMode ? '' : 'filter',
    tables: new Map(),
    rules: [],
    findings: [],
    deletions: 0,
  };
  if (!saveMode) {
    const chains = new Map<string, ChainInfo>();
    for (const name of BUILT_IN['filter'] ?? []) {
      chains.set(name, { name, table: 'filter', policy: 'ACCEPT', user: false, rules: [] });
    }
    state.tables.set('filter', chains);
  }

  let comments = 0;
  let truncated = 0;
  let ruleCapHit = false;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index] ?? '';
    if (rawLine.length > MAX_LINE) truncated += 1;
    const trimmed = rawLine.slice(0, MAX_LINE).replace(/\r$/u, '').trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('#')) {
      comments += 1;
      continue;
    }
    if (trimmed.startsWith('*')) {
      if (!saveMode) continue;
      if (state.currentTable !== '') {
        state.findings.push({
          level: 'error',
          problem: 'A table starts before the previous one is closed',
          detail:
            'Line ' +
            lineNumber +
            ' opens table ' +
            trimmed.slice(1) +
            ' while table ' +
            state.currentTable +
            ' is still open without COMMIT.',
        });
      }
      state.currentTable = trimmed.slice(1).trim();
      if (!state.tables.has(state.currentTable)) state.tables.set(state.currentTable, new Map());
      continue;
    }
    if (trimmed === 'COMMIT') {
      if (!saveMode) continue;
      if (state.currentTable === '') {
        state.findings.push({
          level: 'error',
          problem: 'COMMIT outside a table',
          detail: 'Line ' + lineNumber + ' commits nothing because no table is open.',
        });
      } else {
        state.currentTable = '';
      }
      continue;
    }
    if (trimmed.startsWith(':')) {
      if (!saveMode) {
        state.findings.push({
          level: 'error',
          problem: 'A line is neither a rule nor a table directive',
          detail:
            'Line ' +
            lineNumber +
            ' looks like an iptables-save chain declaration ("' +
            clip(trimmed, 40) +
            '") but the file has no *table header, so it cannot be applied.',
        });
        continue;
      }
      const parts = trimmed.slice(1).split(/\s+/u);
      const name = parts[0] ?? '';
      const policy = (parts[1] ?? '').toUpperCase();
      if (state.currentTable === '') {
        state.findings.push({
          level: 'error',
          problem: 'A chain is declared before the first table',
          detail:
            'Line ' +
            lineNumber +
            ' declares ' +
            name +
            ' with no table open. iptables-restore fails here.',
        });
        continue;
      }
      const tableChains = state.tables.get(state.currentTable);
      if (tableChains === undefined) continue;
      const user = policy === '-' || policy === '';
      const builtin = (BUILT_IN[state.currentTable] ?? []).includes(name);
      const existing = tableChains.get(name);
      if (existing !== undefined) {
        existing.policy = user ? '' : policy;
        continue;
      }
      tableChains.set(name, {
        name,
        table: state.currentTable,
        policy: user ? '' : policy,
        user: user || !builtin,
        rules: [],
      });
      continue;
    }

    const tokens = tokenize(trimmed);
    if (tokens.length === 0) continue;
    const operation = tokens[0] ?? '';
    const table = state.currentTable;
    const tableChains = state.tables.get(table);

    if (
      operation === '-A' ||
      operation === '--append' ||
      operation === '-I' ||
      operation === '--insert'
    ) {
      if (table === '' || tableChains === undefined) {
        state.findings.push({
          level: 'error',
          problem: 'A rule appears before the first table',
          detail:
            'Line ' +
            lineNumber +
            ' is a rule with no table open. iptables-restore reports "line ' +
            lineNumber +
            ' failed".',
        });
        continue;
      }
      const chainName = tokens[1] ?? '';
      let chain = tableChains.get(chainName);
      if (chain === undefined) {
        const builtin = (BUILT_IN[table] ?? []).includes(chainName);
        const builtinAnywhere = Object.values(BUILT_IN).some((names) => names.includes(chainName));
        if (!builtin && !builtinAnywhere) {
          state.findings.push({
            level: 'error',
            problem: 'A rule is added to a chain that no table declares',
            detail:
              'Line ' +
              lineNumber +
              ' adds to ' +
              chainName +
              ' in table ' +
              table +
              ', but nothing creates that chain (iptables: No chain/target/match by that name).',
          });
        }
        chain = {
          name: chainName,
          table,
          policy: builtin ? 'ACCEPT' : '',
          user: !builtin,
          rules: [],
        };
        tableChains.set(chainName, chain);
      }
      if (state.rules.length >= MAX_RULES) {
        ruleCapHit = true;
        continue;
      }
      const rule = parseRule(tokens, chain, lineNumber, operation);
      rule.number = state.rules.length + 1;
      state.rules.push(rule);
      if (rule.inserted) {
        const candidate = tokens[2] ?? '';
        const position = isNumber(candidate) ? Number.parseInt(candidate, 10) : 1;
        chain.rules.splice(Math.max(0, position - 1), 0, rule);
        rule.notes.push('inserted at position ' + position);
      } else {
        chain.rules.push(rule);
      }
      continue;
    }

    if (!saveMode) {
      if (operation === '-P' || operation === '--policy') {
        const name = tokens[1] ?? '';
        const policy = (tokens[2] ?? '').toUpperCase();
        const chains = state.tables.get('filter');
        const chain = chains?.get(name) ?? {
          name,
          table: 'filter',
          policy,
          user: false,
          rules: [],
        };
        chain.policy = policy;
        chains?.set(name, chain);
        continue;
      }
      if (operation === '-N' || operation === '--new-chain') {
        const name = tokens[1] ?? '';
        const chains = state.tables.get('filter');
        if (name !== '' && chains !== undefined && !chains.has(name)) {
          chains.set(name, { name, table: 'filter', policy: '', user: true, rules: [] });
        }
        continue;
      }
      if (operation === '-F' || operation === '--flush') {
        const name = tokens[1];
        const chain = name === undefined ? undefined : state.tables.get('filter')?.get(name);
        if (chain !== undefined) chain.rules = [];
        continue;
      }
      if (
        operation === '-X' ||
        operation === '--delete-chain' ||
        operation === '-Z' ||
        operation === '--zero' ||
        operation === '-E' ||
        operation === '--rename-chain'
      ) {
        continue;
      }
    }

    if (
      operation === '-D' ||
      operation === '--delete' ||
      operation === '-C' ||
      operation === '--check' ||
      operation === '-R' ||
      operation === '--replace'
    ) {
      state.deletions += 1;
      state.findings.push({
        level: 'note',
        problem: 'The file changes rules it does not show',
        detail:
          'Line ' +
          lineNumber +
          ' uses ' +
          operation +
          '. A static reading cannot follow it, so the effective ruleset may differ from what is listed.',
      });
      continue;
    }

    state.findings.push({
      level: 'error',
      problem: 'A line is neither a rule nor a table directive',
      detail:
        'Line ' +
        lineNumber +
        ' starts with "' +
        clip(operation, 30) +
        '", which iptables-save never writes and iptables-restore rejects.',
    });
  }

  if (state.rules.length === 0 && state.tables.size === (saveMode ? 0 : 1)) {
    throw new ToolError(
      'No iptables rules were found.',
      'Paste the output of iptables-save (starting with *filter) or a list of iptables -A commands.',
    );
  }

  const findings = analyze(state);
  const chains: ChainInfo[] = [];
  for (const tableChains of state.tables.values())
    for (const chain of tableChains.values()) chains.push(chain);
  chains.sort((a, b) =>
    a.table === b.table ? a.name.localeCompare(b.name) : a.table.localeCompare(b.table),
  );

  const acceptRules = state.rules.filter((rule) => rule.target === 'ACCEPT');
  const dropRules = state.rules.filter(
    (rule) => rule.target === 'DROP' || rule.target === 'REJECT',
  );
  const jumpRules = state.rules.filter((rule) => rule.target !== '' && !TARGETS.has(rule.target));

  /** Earliest unconditional DROP or REJECT per chain, so shadow checks stay linear. */
  const shadow: Record<string, number> = {};
  for (const rule of state.rules) {
    if (
      rule.unconditional &&
      (rule.target === 'DROP' || rule.target === 'REJECT') &&
      shadow[rule.chain] === undefined
    ) {
      shadow[rule.chain] = rule.number;
    }
  }

  interface Exposure {
    port: string;
    first: number;
    proto: string;
    source: string;
    chain: string;
    rule: number;
    dead: number;
    sensitive: boolean;
    unrestricted: boolean;
  }
  const list: Exposure[] = [];
  const exposed = new Set<string>();
  const sensitiveOpen = new Set<string>();
  for (const rule of acceptRules) {
    const unrestricted = rule.source === '' && rule.inInterface === '';
    for (const port of rule.ports) {
      if (port.kind !== 'dport') continue;
      exposed.add(rule.proto + '/' + port.text);
      const resolved = port.service === '' ? undefined : SERVICE_PORTS[port.service];
      let isSensitive = false;
      if (port.service === '') {
        for (let value = port.first; value <= port.last && value - port.first < 4096; value += 1) {
          if (sensitive.has(value)) isSensitive = true;
        }
      } else if (resolved !== undefined) {
        isSensitive = sensitive.has(resolved);
      }
      const dead =
        shadow[rule.chain] !== undefined && (shadow[rule.chain] ?? 0) < rule.number
          ? (shadow[rule.chain] ?? 0)
          : 0;
      if (isSensitive && unrestricted && dead === 0)
        sensitiveOpen.add(port.service !== '' ? port.service : port.text);
      list.push({
        port: port.text,
        first: port.first,
        proto: rule.proto,
        source:
          rule.source === ''
            ? rule.inInterface === ''
              ? 'any'
              : 'if ' + rule.inInterface
            : rule.source + (rule.sourceNegated ? ' (not)' : ''),
        chain: rule.chain,
        rule: rule.number,
        dead,
        sensitive: isSensitive,
        unrestricted,
      });
    }
  }
  list.sort(
    (a, b) =>
      (a.sensitive === b.sensitive ? 0 : a.sensitive ? -1 : 1) ||
      a.first - b.first ||
      a.proto.localeCompare(b.proto),
  );

  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  const notes = findings.filter((finding) => finding.level === 'note').length;
  const resultNotes: string[] = [];
  const resultWarnings: string[] = [];
  if (ruleCapHit) resultNotes.push('Only the first ' + MAX_RULES + ' rules were analyzed.');
  if (findings.length >= MAX_FINDINGS)
    resultNotes.push('Only the first ' + MAX_FINDINGS + ' findings are shown.');
  if (comments > 0) resultNotes.push(comments + ' comment line(s) were skipped.');
  if (truncated > 0)
    resultNotes.push(
      truncated + ' line(s) were longer than ' + MAX_LINE + ' characters and were cut.',
    );
  if (errors > 0)
    resultWarnings.push(errors + ' problem(s) would make iptables refuse this ruleset.');
  if (sensitiveOpen.size > 0)
    resultWarnings.push(sensitiveOpen.size + ' sensitive port(s) are accepted from anywhere.');

  const stats: Record<string, string | number> = {
    bytes: text.length,
    lines: lines.length,
    tables: state.tables.size,
    chains: chains.length,
    rules: state.rules.length,
    exposedPorts: exposed.size,
    sensitiveOpen: sensitiveOpen.size,
    findings: findings.length,
    errors,
    warnings,
    notes,
  };

  if (format === 'chains') {
    const rows = chains.slice(0, MAX_ROWS).map((chain) => {
      const accepts = chain.rules.filter((rule) => rule.target === 'ACCEPT').length;
      const drops = chain.rules.filter(
        (rule) => rule.target === 'DROP' || rule.target === 'REJECT',
      ).length;
      const jumps = chain.rules.filter(
        (rule) => rule.target !== '' && !TARGETS.has(rule.target),
      ).length;
      const marks: string[] = [];
      if (chain.user) marks.push('user chain');
      if (chain.rules.length === 0) marks.push('no rules');
      if (chain.policy === 'ACCEPT' && drops > 0) marks.push('fail-open policy');
      const effectiveDrop =
        chain.policy === 'DROP' ||
        chain.rules.some(
          (rule) => rule.unconditional && (rule.target === 'DROP' || rule.target === 'REJECT'),
        );
      if (
        effectiveDrop &&
        chain.rules.length > 0 &&
        (chain.name === 'INPUT' || chain.name === 'FORWARD') &&
        !chain.rules.some(isEstablishedAccept)
      )
        marks.push('drops replies');
      if (chain.rules.some((rule) => rule.notes.some((note) => note.startsWith('unreachable'))))
        marks.push('has dead rules');
      return [
        chain.name,
        chain.table,
        chain.policy === '' ? 'return' : chain.policy,
        String(chain.rules.length),
        'A:' + accepts + ' D:' + drops + ' J:' + jumps,
        marks.length === 0 ? '-' : marks.join(', '),
      ];
    });
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Chain', 'Table', 'Policy', 'Rules', 'Verdicts', 'Notes'],
          rows: rows.length === 0 ? [['-', '-', '-', '0', '-', '(no chains)']] : rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'rules') {
    const rows = state.rules
      .slice(0, MAX_ROWS)
      .map((rule) => [
        String(rule.number),
        String(rule.line),
        rule.chain,
        clip(rule.matchText === '' ? '(no match conditions)' : rule.matchText, 44),
        clip(rule.targetText === '' ? '(counts only)' : rule.targetText, 24),
        rule.errors.length > 0
          ? 'invalid'
          : rule.notes.length === 0
            ? '-'
            : clip(rule.notes.join(', '), 40),
      ]);
    if (state.rules.length > rows.length)
      resultNotes.push('Only the first ' + MAX_ROWS + ' rules are listed.');
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Line', 'Chain', 'Match', 'Target', 'Notes'],
          rows: rows.length === 0 ? [['-', '-', '-', '(no rules)', '-', '-']] : rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'ports') {
    const rows = list
      .slice(0, top)
      .map((entry, index) => [
        String(index + 1),
        entry.port,
        entry.proto,
        clip(entry.source, 22),
        entry.chain,
        '#' + entry.rule,
        entry.dead !== 0
          ? 'shadowed by #' + entry.dead
          : entry.sensitive
            ? entry.unrestricted
              ? 'sensitive, open to the world'
              : 'sensitive, but restricted'
            : '-',
      ]);
    if (list.length > rows.length)
      resultNotes.push(
        'Showing ' +
          rows.length +
          ' of ' +
          list.length +
          ' accepted ports; raise the Ports listed option to see more.',
      );
    if (list.length === 0)
      resultNotes.push(
        'No ACCEPT rule matches a destination port, so nothing is opened by this ruleset.',
      );
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Port', 'Proto', 'Source', 'Chain', 'Rule', 'Note'],
          rows: rows.length === 0 ? [['-', '-', '-', '-', '-', '-', '(no ports accepted)']] : rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'findings') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Level', 'Problem', 'Detail'],
          rows:
            findings.length === 0
              ? [
                  [
                    'ok',
                    'Nothing to flag',
                    'Every rule parses, every jump resolves, and no chain drops traffic it cannot return.',
                  ],
                ]
              : findings.map((finding) => [finding.level, finding.problem, finding.detail]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  const closed = chains.filter(
    (chain) => !chain.user && chain.policy !== '' && chain.policy !== 'ACCEPT',
  );
  const openPolicies = chains.filter((chain) => !chain.user && chain.policy === 'ACCEPT').length;
  const summaryRows: string[][] = [
    ['Source', sourceLabel],
    ['Size', text.length + ' bytes in ' + lines.length + ' lines'],
    ['Format', saveMode ? 'iptables-save' : 'iptables command list (table filter assumed)'],
    ['Tables', state.tables.size === 0 ? 'none' : [...state.tables.keys()].join(', ')],
    [
      'Chains',
      String(chains.length) + ' (' + chains.filter((chain) => chain.user).length + ' user)',
    ],
    [
      'Rules',
      String(state.rules.length) +
        (state.deletions > 0 ? ' (' + state.deletions + ' delete/check line(s) not replayed)' : ''),
    ],
    [
      'Policies',
      (closed.length === 0
        ? 'no chain is fail-closed'
        : closed.map((chain) => chain.name + '=' + chain.policy).join(', ')) +
        (openPolicies === 0 ? '' : ' (' + openPolicies + ' chain(s) accept by default)'),
    ],
    [
      'Verdicts',
      acceptRules.length +
        ' accept, ' +
        dropRules.length +
        ' drop/reject, ' +
        jumpRules.length +
        ' jump',
    ],
    [
      'Exposed ports',
      exposed.size === 0
        ? 'none accepted'
        : String(exposed.size) +
          ': ' +
          clip(
            [...exposed]
              .sort((a, b) => {
                const [protoA = '', portA = ''] = a.split('/');
                const [protoB = '', portB = ''] = b.split('/');
                return protoA === protoB
                  ? (Number.parseInt(portA, 10) || 0) - (Number.parseInt(portB, 10) || 0)
                  : protoA.localeCompare(protoB);
              })
              .join(', '),
            70,
          ),
    ],
    [
      'Sensitive ports open',
      sensitiveOpen.size === 0
        ? 'none from any source'
        : [...sensitiveOpen].sort((a, b) => Number(a) - Number(b)).join(', '),
    ],
    ['Established-connection rule', state.rules.some(isEstablishedAccept) ? 'present' : 'missing'],
    [
      'Interface-limited rules',
      String(
        state.rules.filter((rule) => rule.inInterface !== '' || rule.outInterface !== '').length,
      ),
    ],
    ['Source-limited rules', String(state.rules.filter((rule) => rule.source !== '').length)],
    ['Inserted rules', String(state.rules.filter((rule) => rule.inserted).length)],
    ['Findings', errors + ' error, ' + warnings + ' warning, ' + notes + ' note'],
  ];
  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }),
      render: 'table',
    },
    notes: resultNotes,
    warnings: resultWarnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
