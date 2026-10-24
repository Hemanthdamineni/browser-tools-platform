import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ssh-config-auditor.meta';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ISSUES = 300;
const CLIP = 140;

/** OpenSSH client keywords (ssh_config, not sshd_config). */
const KEYWORDS = new Set([
  'addkeystoagent',
  'addressfamily',
  'batchmode',
  'bindaddress',
  'bindinterface',
  'canonicaldomains',
  'canonicalizefallbacklocal',
  'canonicalizehostname',
  'canonicalizemaxdots',
  'canonicalizepermittedcnames',
  'casignaturealgorithms',
  'certificatefile',
  'channeltimeout',
  'checkhostip',
  'ciphers',
  'clearallforwardings',
  'compression',
  'connectionattempts',
  'connectiontimeout',
  'controlmaster',
  'controlpath',
  'controlpersist',
  'dynamicforward',
  'enableescapecommandline',
  'enablesshkeysign',
  'escapechar',
  'exitonforwardfailure',
  'fingerprinthash',
  'forkafterauthentication',
  'forwardagent',
  'forwardx11',
  'forwardx11timeout',
  'forwardx11trusted',
  'gatewayports',
  'globalknownhostsfile',
  'gssapiauthentication',
  'gssapidelegatecredentials',
  'hashknownhosts',
  'hostbasedacceptedalgorithms',
  'hostbasedauthentication',
  'hostkeyalgorithms',
  'hostkeyalias',
  'hostname',
  'identitiesonly',
  'identityagent',
  'identityfile',
  'ignoreunknown',
  'ipqos',
  'kbdinteractiveauthentication',
  'kbdinteractivedevices',
  'kexalgorithms',
  'knownhostscommand',
  'localcommand',
  'localforward',
  'loglevel',
  'logverbose',
  'macs',
  'nohostauthenticationforlocalhost',
  'numberofpasswordprompts',
  'obscurekeystroketiming',
  'passwordauthentication',
  'permitlocalcommand',
  'permitremoteopen',
  'pkcs11provider',
  'port',
  'preferredauthentications',
  'proxycommand',
  'proxyjump',
  'proxyusefdpass',
  'pubkeyacceptedalgorithms',
  'pubkeyauthentication',
  'rekeylimit',
  'remotecommand',
  'remoteforward',
  'requesttty',
  'requiredrsasize',
  'revokedhostkeys',
  'securitykeyprovider',
  'sendenv',
  'serveralivecountmax',
  'serveraliveinterval',
  'sessiontype',
  'setenv',
  'stdinnull',
  'streamlocalbindmask',
  'streamlocalbindunlink',
  'stricthostkeychecking',
  'syslogfacility',
  'tcpkeepalive',
  'tag',
  'tunnel',
  'tunneldevice',
  'updatehostkeys',
  'user',
  'userknownhostsfile',
  'verifyhostkeydns',
  'visualhostkey',
  'xauthlocation',
]);

const DEPRECATED = new Map<string, string>([
  ['rsaauthentication', 'Removed; use PubkeyAuthentication.'],
  ['rhostsrsaauthentication', 'Removed; host-based authentication is gone.'],
  ['rhostsauthentication', 'Removed; host-based authentication is gone.'],
  ['usersh', 'Removed; use rsh or ssh explicitly.'],
  ['protocol', 'Removed; SSH protocol 1 is gone, only 2 is supported.'],
  ['challengeresponseauthentication', 'Renamed to KbdInteractiveAuthentication.'],
  ['pubkeyacceptedkeytypes', 'Renamed to PubkeyAcceptedAlgorithms.'],
  ['hostbasedkeytypes', 'Renamed to HostbasedAcceptedAlgorithms.'],
  ['useprivilegedport', 'Renamed to UsePrivilegedPort in server config; the client uses Port.'],
]);

const WEAK_ALGORITHMS = new Map<string, string[]>([
  [
    'ciphers',
    [
      '3des-cbc',
      'des-cbc',
      'des',
      'arcfour',
      'arcfour128',
      'arcfour256',
      'blowfish-cbc',
      'cast128-cbc',
      'aes128-cbc',
      'aes192-cbc',
      'aes256-cbc',
      'none',
    ],
  ],
  ['macs', ['hmac-md5', 'hmac-sha1', 'hmac-ripemd160', 'umac-64', 'none']],
  [
    'kexalgorithms',
    [
      'diffie-hellman-group1-sha1',
      'diffie-hellman-group14-sha1',
      'diffie-hellman-group-exchange-sha1',
      'gss-group1-sha1',
      'none',
    ],
  ],
  ['hostkeyalgorithms', ['ssh-dss', 'ssh-rsa']],
  ['pubkeyacceptedalgorithms', ['ssh-dss', 'ssh-rsa']],
  ['hostbasedacceptedalgorithms', ['ssh-dss', 'ssh-rsa']],
  ['casignaturealgorithms', ['ssh-dss', 'ssh-rsa']],
]);

/** Keywords that are usually meant per host, so hoisting them into Host * shadows later blocks. */
const HOST_SPECIFIC = new Set([
  'user',
  'hostname',
  'port',
  'identityfile',
  'identityagent',
  'proxyjump',
  'proxycommand',
  'userknownhostsfile',
  'stricthostkeychecking',
  'forwardagent',
  'identitiesonly',
  'localforward',
  'remoteforward',
  'dynamicforward',
  'requesttty',
  'remotecommand',
  'certificatefile',
  'controlpath',
  'controlmaster',
  'bindaddress',
  'proxyusefdpass',
  'pkcs11provider',
]);

interface Directive {
  keyword: string;
  value: string;
  line: number;
}

interface Block {
  kind: 'global' | 'host' | 'match';
  patterns: string[];
  condition: string;
  line: number;
  directives: Directive[];
}

interface Finding {
  level: 'error' | 'warning' | 'note';
  where: string;
  problem: string;
  detail: string;
}

const clip = (value: string, max = CLIP): string => {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

function stripComment(line: string): string {
  let quoted = false;
  let out = '';
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    if (character === '#' && !quoted) break;
    out += character;
  }
  return out;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function tokenize(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quoted = false;
  for (const character of value) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && /\s/u.test(character)) {
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

function globToRegExp(pattern: string): RegExp {
  let out = '^';
  for (const character of pattern) {
    if (character === '*') out += '.*';
    else if (character === '?') out += '.';
    else out += character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  }
  return new RegExp(out + '$', 'iu');
}

function hostMatchesPatterns(patterns: string[], host: string): boolean {
  const target = host.toLowerCase();
  const negative = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => pattern.slice(1));
  const positive = patterns.filter((pattern) => !pattern.startsWith('!'));
  if (negative.some((pattern) => globToRegExp(pattern).test(target))) return false;
  if (positive.length === 0) return true;
  return positive.some((pattern) => globToRegExp(pattern).test(target));
}

const isCatchAll = (patterns: string[]): boolean =>
  patterns.some((pattern) => pattern === '*') &&
  !patterns.some((pattern) => pattern.startsWith('!'));

function evaluateMatch(condition: string, host: string): { applies: boolean; evaluable: boolean } {
  const tokens = tokenize(condition);
  let applies = true;
  let evaluable = true;
  let index = 0;
  while (index < tokens.length) {
    const predicate = (tokens[index] ?? '').toLowerCase();
    if (predicate === 'all') {
      index += 1;
      continue;
    }
    const value = tokens[index + 1] ?? '';
    index += 2;
    if (predicate === 'host' || predicate === 'originalhost') {
      const patterns = value.split(/[,\s]+/u).filter((pattern) => pattern !== '');
      if (!hostMatchesPatterns(patterns, host)) applies = false;
    } else {
      evaluable = false;
    }
  }
  return { applies, evaluable };
}

const describeBlock = (block: Block): string => {
  if (block.kind === 'global') return 'global (before the first Host)';
  if (block.kind === 'match') return 'Match ' + block.condition;
  return 'Host ' + block.patterns.join(' ');
};

function parseConfig(text: string): {
  blocks: Block[];
  includeLines: number[];
  malformed: { line: number; text: string }[];
} {
  const blocks: Block[] = [];
  const includeLines: number[] = [];
  const malformed: { line: number; text: string }[] = [];
  let current: Block | null = null;

  text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = stripComment(rawLine).trim();
      if (line === '') return;

      const match = /^([A-Za-z][A-Za-z0-9]*)(?:\s+([\s\S]*))?$/u.exec(line);
      if (match === null) {
        malformed.push({ line: lineNumber, text: line });
        return;
      }
      const keyword = (match[1] ?? '').toLowerCase();
      const rest = (match[2] ?? '').trim();

      if (keyword === 'host') {
        current = {
          kind: 'host',
          patterns: rest === '' ? [] : rest.split(/\s+/u),
          condition: '',
          line: lineNumber,
          directives: [],
        };
        blocks.push(current);
        return;
      }
      if (keyword === 'match') {
        current = {
          kind: 'match',
          patterns: [],
          condition: rest,
          line: lineNumber,
          directives: [],
        };
        blocks.push(current);
        return;
      }
      if (current === null) {
        current = { kind: 'global', patterns: [], condition: '', line: 0, directives: [] };
        blocks.push(current);
      }
      if (keyword === 'include') includeLines.push(lineNumber);
      current.directives.push({ keyword, value: unquote(rest), line: lineNumber });
    });

  return { blocks, includeLines, malformed };
}

function audit(
  blocks: Block[],
  includeLines: number[],
  malformed: { line: number; text: string }[],
  checkPolicy: boolean,
): Finding[] {
  const findings: Finding[] = [];
  const add = (level: Finding['level'], where: string, problem: string, detail: string): void => {
    if (findings.length < MAX_ISSUES) findings.push({ level, where, problem, detail });
  };

  for (const bad of malformed) {
    add(
      'error',
      'line ' + bad.line,
      'Line is not a keyword and a value',
      'Read as: "' + clip(bad.text, 60) + '".',
    );
  }
  for (const line of includeLines) {
    add(
      'note',
      'line ' + line,
      'Include is not followed',
      'Paste the included file as well if you want it audited.',
    );
  }

  for (const block of blocks) {
    const where =
      block.kind === 'global' ? 'global' : describeBlock(block) + ' (line ' + block.line + ')';
    if (block.kind === 'host' && block.patterns.length === 0) {
      add(
        'error',
        where,
        'Host directive without a pattern',
        'OpenSSH rejects this line; add a pattern or remove the block.',
      );
    }
    if (block.kind === 'match') {
      const verdict = evaluateMatch(block.condition, 'example.invalid');
      if (!verdict.evaluable) {
        add(
          'note',
          where,
          'Match block depends on the live session',
          'Predicates other than host and all (user, address, exec, tagged) cannot be evaluated from the file alone.',
        );
      }
    }
    if (checkPolicy && block.kind === 'host' && isCatchAll(block.patterns)) {
      const later = blocks.filter(
        (other) => other.kind === 'host' && other.line > block.line && !isCatchAll(other.patterns),
      );
      const stolen = new Set<string>();
      for (const other of later) {
        for (const directive of other.directives) {
          if (_keywordInBlock(block, directive.keyword) && HOST_SPECIFIC.has(directive.keyword))
            stolen.add(directive.keyword);
        }
      }
      if (stolen.size > 0) {
        add(
          'warning',
          where,
          'Host * shadows later blocks',
          'Because the first value wins, this block supplies ' +
            [...stolen].sort().join(', ') +
            ' for every host, so later Host blocks cannot override ' +
            (stolen.size === 1 ? 'it' : 'them') +
            '. Move the broad block to the end of the file.',
        );
      }
    }

    const seen = new Map<string, Directive>();
    for (const directive of block.directives) {
      const { keyword, value, line } = directive;
      const at =
        'line ' + line + ' (' + (block.kind === 'global' ? 'global' : describeBlock(block)) + ')';

      if (value === '') {
        add(
          'error',
          at,
          'Directive has no value',
          'The ' + keyword + ' keyword needs an argument.',
        );
        continue;
      }
      if (DEPRECATED.has(keyword)) {
        add('warning', at, 'Deprecated keyword: ' + keyword, DEPRECATED.get(keyword) ?? '');
      } else if (!KEYWORDS.has(keyword)) {
        add(
          'warning',
          at,
          'Unrecognised keyword: ' + keyword,
          'Not a client ssh_config keyword; check for a typo or an option that moved to sshd_config.',
        );
      }

      const earlier = seen.get(keyword);
      if (earlier !== undefined && earlier.value !== value) {
        add(
          'note',
          at,
          'Keyword set twice in the same block',
          'Line ' + earlier.line + ' wins because the first value is used.',
        );
      }
      seen.set(keyword, directive);

      if (keyword === 'port' && !/^\d+$/u.test(value)) {
        add('error', at, 'Port is not a number', 'Got "' + clip(value, 30) + '".');
      } else if (keyword === 'port' && (Number(value) < 1 || Number(value) > 65535)) {
        add('error', at, 'Port is outside 1-65535', 'Got ' + value + '.');
      }
      if (keyword === 'hostname' && value.includes(':')) {
        add(
          'warning',
          at,
          'HostName contains a port',
          'Use a separate Port line; some tools treat "host:port" as a literal name.',
        );
      }
      if (checkPolicy) {
        if (keyword === 'stricthostkeychecking' && /^no$/iu.test(value)) {
          add(
            'warning',
            at,
            'Host key checking is disabled',
            'Any server key is accepted, which allows a man-in-the-middle to impersonate the host.',
          );
        }
        if (keyword === 'userknownhostsfile' && /(^|\/)(dev\/null|null)$/iu.test(value.trim())) {
          add(
            'warning',
            at,
            'Known hosts file is discarded',
            'Nothing learns a host key, so verification can never succeed.',
          );
        }
        if (keyword === 'forwardagent' && /^yes$/iu.test(value)) {
          const patterns = block.patterns;
          if (block.kind === 'host' && isCatchAll(patterns)) {
            add(
              'warning',
              at,
              'Agent forwarding is on for every host',
              'Any host you connect to while this applies can use your keys. Enable it only for hosts you trust.',
            );
          }
        }
        if (keyword === 'proxycommand' && /(^|[\s/])(nc|ncat|netcat)(\s|$)/iu.test(value)) {
          add(
            'warning',
            at,
            'ProxyCommand uses plain netcat',
            'The jump connection is not encrypted; ProxyJump or nc with TLS is safer.',
          );
        }
        const weak = WEAK_ALGORITHMS.get(keyword);
        if (weak !== undefined) {
          const items = value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item !== '');
          for (const item of items) {
            const appended = item.startsWith('+');
            const token = (appended ? item.slice(1) : item).toLowerCase().replace(/^-/u, '');
            const isWeak = weak.some(
              (entry) =>
                token === entry || token.startsWith(entry + '-') || token.startsWith(entry + '@'),
            );
            if (!isWeak) continue;
            add(
              'warning',
              at,
              'Weak algorithm in ' + keyword + ': ' + token,
              appended
                ? 'The leading + appends this to the defaults, so it stays available even when OpenSSH drops it.'
                : 'Removed from modern OpenSSH defaults or widely considered weak.',
            );
          }
        }
        if (keyword === 'passwordauthentication' && /^yes$/iu.test(value)) {
          add(
            'note',
            at,
            'Password authentication is enabled',
            'Key-based authentication is usually preferred for this host.',
          );
        }
        if (
          keyword === 'identityfile' &&
          !value.startsWith('~') &&
          !value.startsWith('/') &&
          !value.startsWith('$')
        ) {
          add(
            'note',
            at,
            'IdentityFile is a bare filename',
            'Relative paths resolve under ~/.ssh, which may not be what you meant.',
          );
        }
      }
    }
  }

  const patternSeen = new Map<string, number>();
  for (const block of blocks) {
    if (block.kind !== 'host' || block.patterns.length === 0) continue;
    const key = block.patterns.join(' ');
    const earlier = patternSeen.get(key);
    if (earlier === undefined) patternSeen.set(key, block.line);
    else
      add(
        'note',
        'line ' + block.line,
        'Duplicate Host pattern',
        'The same pattern is already declared on line ' + earlier + '.',
      );
  }

  return findings;
}

function _keywordInBlock(block: Block, keyword: string): boolean {
  return block.directives.some((directive) => directive.keyword === keyword);
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = String(o.format ?? 'audit');
  const wantedHost = String(o.host ?? '').trim();
  const checkPolicy = o.checkPolicy !== false;

  const source = input.files[0];
  let text: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 4 MB.');
    text = await source.text();
  } else {
    text = String(input.text ?? '');
  }
  if (text.trim() === '') {
    throw new ToolError(
      'No SSH config was provided.',
      'Paste the contents of ~/.ssh/config, or drop the file.',
    );
  }
  if (text.length > MAX_BYTES) throw new ToolError('That is more than 4 MB of config.');

  const config = parseConfig(text);
  const blocks = config.blocks;
  if (blocks.length === 0) {
    throw new ToolError(
      'No directives were found.',
      'Expected lines such as "Host prod", "HostName prod.example.com" or "User deploy".',
    );
  }

  const findings = audit(blocks, config.includeLines, config.malformed, checkPolicy);
  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  const notes = findings.filter((finding) => finding.level === 'note').length;

  const hostBlocks = blocks.filter((block) => block.kind === 'host');
  const matchBlocks = blocks.filter((block) => block.kind === 'match');
  const globalBlock = blocks.find((block) => block.kind === 'global');
  const aliases = [
    ...new Set(
      hostBlocks.flatMap((block) => block.patterns).filter((pattern) => !/[*?!]/u.test(pattern)),
    ),
  ];
  const keywordsUsed = [
    ...new Set(blocks.flatMap((block) => block.directives.map((directive) => directive.keyword))),
  ].sort();

  const resultNotes: string[] = [];
  const resultWarnings: string[] = [];
  if (globalBlock !== undefined) {
    resultNotes.push(
      'Directives before the first Host apply to every host and are read first, so they win over later Host blocks.',
    );
  }
  if (config.includeLines.length > 0) {
    resultNotes.push(
      config.includeLines.length + ' Include line(s) were reported but not followed.',
    );
  }
  if (findings.length >= MAX_ISSUES)
    resultNotes.push('The findings list is capped at ' + MAX_ISSUES + ' entries.');
  if (errors > 0) resultWarnings.push(errors + ' configuration error(s) found.');
  if (warnings > 0 && checkPolicy) resultWarnings.push(warnings + ' risky setting(s) found.');

  const stats: Record<string, string | number> = {
    blocks: blocks.length,
    hostBlocks: hostBlocks.length,
    matchBlocks: matchBlocks.length,
    globalDirectives: globalBlock?.directives.length ?? 0,
    errors,
    warnings,
    notes,
  };

  if (format === 'hosts') {
    const rows: string[][] = [];
    blocks.forEach((block, index) => {
      const label = block.kind === 'host' ? 'Host' : block.kind === 'match' ? 'Match' : 'Global';
      const target =
        block.kind === 'host'
          ? block.patterns.join(' ')
          : block.kind === 'match'
            ? block.condition
            : '(applies to all hosts)';
      const evaluable =
        block.kind === 'match' && !evaluateMatch(block.condition, 'example.invalid').evaluable
          ? 'not evaluable here'
          : '';
      rows.push([
        String(index + 1),
        label,
        clip(target, 60),
        block.line === 0 ? 'start of file' : String(block.line),
        String(block.directives.length) + (evaluable === '' ? '' : ' (' + evaluable + ')'),
      ]);
    });
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Type', 'Pattern or condition', 'Line', 'Directives'],
          rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'resolve') {
    if (wantedHost === '') {
      throw new ToolError(
        'No host was given to resolve.',
        'Set the "Host to resolve" option, for example "prod" or "github.com".',
      );
    }
    const resolved = new Map<
      string,
      { keyword: string; value: string; from: string; line: number }
    >();
    let shadowed = 0;
    let skippedMatch = 0;
    for (const block of blocks) {
      if (block.kind === 'match') {
        const verdict = evaluateMatch(block.condition, wantedHost);
        if (!verdict.evaluable) {
          skippedMatch += 1;
          continue;
        }
        if (!verdict.applies) continue;
      } else if (block.kind === 'host' && !hostMatchesPatterns(block.patterns, wantedHost)) {
        continue;
      }
      for (const directive of block.directives) {
        const existing = resolved.get(directive.keyword);
        if (existing === undefined) {
          resolved.set(directive.keyword, {
            keyword: directive.keyword,
            value: directive.value,
            from:
              (block.kind === 'global' ? 'global' : describeBlock(block)) +
              ' line ' +
              directive.line,
            line: directive.line,
          });
        } else if (existing.value !== directive.value) {
          shadowed += 1;
        }
      }
    }
    const resolvable = [...resolved.values()].sort((a, b) => a.line - b.line);
    if (shadowed > 0) {
      resultNotes.push(
        shadowed + ' overridden value(s) were ignored because the first value found wins.',
      );
    }
    if (skippedMatch > 0) {
      resultNotes.push(
        skippedMatch +
          ' Match block(s) could not be evaluated from the file alone and were skipped.',
      );
    }
    if (resolvable.length === 0) {
      resultNotes.push('No block in this file applies to "' + wantedHost + '".');
    }
    stats.settings = resolvable.length;
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Setting', 'Value', 'From'],
          rows:
            resolvable.length === 0
              ? [['-', '-', 'Nothing in this file applies to ' + clip(wantedHost, 40) + '.']]
              : resolvable.map((entry) => [entry.keyword, clip(entry.value, 80), entry.from]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'summary') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Item', 'Value'],
          rows: [
            ['Lines', String(text.replace(/\r\n?/gu, '\n').split('\n').length)],
            ['Blocks', String(blocks.length)],
            ['Host blocks', String(hostBlocks.length)],
            ['Match blocks', String(matchBlocks.length)],
            ['Global directives', String(globalBlock?.directives.length ?? 0)],
            ['Host aliases', aliases.length === 0 ? 'n/a' : clip(aliases.join(', '), 100)],
            [
              'Keywords used',
              keywordsUsed.length === 0 ? 'n/a' : clip(keywordsUsed.join(', '), 120),
            ],
            [
              'Include lines',
              config.includeLines.length === 0 ? 'none' : config.includeLines.join(', '),
            ],
            ['Errors', String(errors)],
            ['Warnings', String(warnings)],
            ['Notes', String(notes)],
          ],
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  const rows =
    findings.length === 0
      ? [
          [
            'ok',
            '-',
            'No problems found',
            checkPolicy
              ? 'The file parses and no risky settings were spotted.'
              : 'The file parses; security auditing was switched off.',
          ],
        ]
      : findings.map((finding) => [finding.level, finding.where, finding.problem, finding.detail]);

  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Level', 'Where', 'Problem', 'Detail'], rows }),
      render: 'table',
    },
    notes: resultNotes,
    warnings: resultWarnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
