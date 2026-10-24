import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './sudoers-auditor.meta';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SPECS = 20000;
const MAX_ROWS = 2000;
const MAX_FINDINGS = 300;
const MAX_LINE = 8192;
const CLIP = 100;

const DEFAULT_SHELLS = [
  'sh', 'bash', 'dash', 'zsh', 'ksh', 'csh', 'tcsh', 'fish', 'env', 'python', 'python2', 'python3', 'perl', 'ruby', 'node',
  'npm', 'npx', 'php', 'lua', 'awk', 'gawk', 'mawk', 'sed', 'ed', 'vi', 'vim', 'nvim', 'nano', 'emacs', 'less', 'more',
  'man', 'find', 'tar', 'zip', 'unzip', 'rsync', 'git', 'screen', 'tmux', 'docker', 'podman', 'kubectl', 'mount', 'umount',
  'fdisk', 'dd', 'chroot', 'su', 'sudo', 'strace', 'ltrace', 'gdb', 'make', 'ssh', 'scp', 'tee', 'chmod', 'chown',
  'setfacl', 'passwd', 'apt', 'apt-get', 'dnf', 'yum', 'pacman', 'pip', 'pip3', 'systemctl',
];

/** Environment variables that can load code or configuration into the privileged process. */
const CODE_LOADING_ENV = [
  /^LD_/u, /^PYTHON/u, /^PERL/u, /^RUBY/u, /^GEM_/u, /^NODE_/u, /^JAVA/u, /^_JAVA/u, /^CLASSPATH$/u, /^BASH_ENV$/u,
  /^ENV$/u, /^SHELLOPTS$/u, /^BASHOPTS$/u, /^PS4$/u, /^TERMINFO/u, /^LOCALDOMAIN$/u, /^RES_OPTIONS$/u, /^HOSTALIASES$/u,
  /^NLSPATH$/u, /^GCONV_PATH$/u, /^IFS$/u, /^EDITOR$/u, /^VISUAL$/u, /^SUDO_EDITOR$/u, /^PAGER$/u, /^LESSOPEN$/u,
  /^GIT_CONFIG/u, /^GIT_EXTERNAL_DIFF$/u, /^XDG_CONFIG/u,
];

/** Commands that stay a shell escape even when their arguments are pinned, because they read commands interactively. */
const INTERACTIVE = new Set(['vi', 'vim', 'nvim', 'nano', 'emacs', 'less', 'more', 'man', 'ed', 'screen', 'tmux', 'pico', 'joe']);

const TAGS = new Set([
  'NOPASSWD', 'PASSWD', 'NOEXEC', 'EXEC', 'SETENV', 'NOSETENV', 'LOG_INPUT', 'NOLOG_INPUT', 'LOG_OUTPUT', 'NOLOG_OUTPUT',
  'MAIL', 'NOMAIL', 'FOLLOW', 'NOFOLLOW', 'INTERCEPT', 'NOINTERCEPT',
]);

type DefaultsType = 'bool' | 'int' | 'float' | 'octal' | 'enum' | 'list' | 'text';

const DEFAULTS_TYPES: Record<string, DefaultsType> = {
  rlimit_as: 'int',
  rlimit_core: 'int',
  rlimit_cpu: 'int',
  rlimit_data: 'int',
  rlimit_fsize: 'int',
  rlimit_memlock: 'int',
  rlimit_nofile: 'int',
  rlimit_nproc: 'int',
  rlimit_rss: 'int',
  rlimit_stack: 'int',
  rlimit_locks: 'int',
  sudoedit_checkdir: 'bool',
  sudoedit_follow: 'bool',
  intercept_verify: 'bool',
  iolog_flush: 'bool',
  log_server_verify: 'bool',
  pam_session: 'bool',
  pam_setcred: 'bool',
  log_server_timeout: 'int',
  authenticate: 'bool', env_reset: 'bool', env_editor: 'bool', mail_badpass: 'bool', mail_no_user: 'bool',
  mail_no_host: 'bool', mail_no_perms: 'bool', mail_always: 'bool', mail_all_cmnds: 'bool', tty_tickets: 'bool',
  requiretty: 'bool', visiblepw: 'bool', set_home: 'bool', always_set_home: 'bool',
  rootpw: 'bool', runaspw: 'bool', targetpw: 'bool', fqdn: 'bool', insults: 'bool', umask_override: 'bool',
  ignore_dot: 'bool', ignore_local_sudoers: 'bool', intercept: 'bool',
  intercept_allow_setid: 'bool', log_host: 'bool', log_year: 'bool', shell_noargs: 'bool', stay_setuid: 'bool',
  preserve_groups: 'bool', closefrom_override: 'bool', noexec: 'bool', set_logname: 'bool',
 use_pty: 'bool', log_input: 'bool',
  log_output: 'bool', match_group_by_gid: 'bool', use_netgroups: 'bool', netgroup_tuple: 'bool', path_info: 'bool',
 log_subcmds: 'bool', passprompt_override: 'bool',
  fast_glob: 'bool',
  log_server_keepalive: 'bool',
  command_timeout: 'int', passwd_timeout: 'int', passwd_tries: 'int', closefrom: 'int', maxseq: 'int',

  timestamp_timeout: 'float',
  umask: 'octal', iolog_mode: 'octal',
  lecture: 'enum', listpw: 'enum', verifypw: 'enum', timestamp_type: 'enum', syslog: 'enum',
  syslog_goodpri: 'enum', syslog_badpri: 'enum', intercept_type: 'enum',
  mailerflags: 'text', mailerpath: 'text', mailto: 'text', mailfrom: 'text', mailsub: 'text', editor: 'text',
  env_file: 'text', secure_path: 'text', lecture_file: 'text', lecture_status_dir: 'text', timestampdir: 'text',
  timestampowner: 'text', runas_default: 'text', logfile: 'text', passprompt: 'text', role: 'text', type: 'text',
  privs: 'text', limitprivs: 'text', iolog_dir: 'text', iolog_file: 'text', iolog_group: 'text',
  iolog_user: 'text', pam_service: 'text', pam_login_service: 'text',
  group_plugin: 'text', log_server_peer_key: 'text',
  log_server_peer_cert: 'text', log_server_cabundle: 'text', apparmor_profile: 'text',
  env_keep: 'list', env_check: 'list', env_delete: 'list', log_servers: 'list',
};

const DEFAULTS_ENUMS: Record<string, string[]> = {
  lecture: ['never', 'once', 'always'],
  listpw: ['never', 'any', 'all', 'always'],
  verifypw: ['never', 'any', 'all', 'always'],
  timestamp_type: ['global', 'tty', 'ppid', 'kernel'],
  intercept_type: ['dso', 'trace'],
  syslog: ['auth', 'authpriv', 'daemon', 'user', 'local0', 'local1', 'local2', 'local3', 'local4', 'local5', 'local6', 'local7'],
  syslog_goodpri: ['alert', 'crit', 'debug', 'emerg', 'err', 'info', 'notice', 'warn'],
  syslog_badpri: ['alert', 'crit', 'debug', 'emerg', 'err', 'info', 'notice', 'warn'],
};

const DIGEST_LENGTHS: Record<string, number> = { sha224: 56, sha256: 64, sha384: 96, sha512: 128 };
const ALIAS_TYPES = ['User_Alias', 'Runas_Alias', 'Host_Alias', 'Cmnd_Alias'] as const;
type AliasType = (typeof ALIAS_TYPES)[number];

interface CmdEntry {
  raw: string;
  negated: boolean;
  digest: string;
  path: string;
  args: string;
  base: string;
  isAll: boolean;
  sudoedit: boolean;
  wildcard: boolean;
  tags: string[];
}

interface Spec {
  line: number;
  raw: string;
  users: string[];
  hosts: string[];
  runas: string[];
  runasGroups: string[];
  tags: string[];
  commands: CmdEntry[];
  errors: string[];
  notes: string[];
  riskShell: boolean;
  riskWildcard: boolean;
}

interface AliasInfo {
  type: AliasType;
  name: string;
  members: string[];
  line: number;
  raw: string;
  used: boolean;
  note: string;
}

interface DefaultsInfo {
  line: number;
  scope: string;
  option: string;
  operator: string;
  value: string;
  enabled: boolean;
  note: string;
}

interface IncludeInfo {
  line: number;
  kind: string;
  path: string;
}

interface Finding {
  level: 'error' | 'warning' | 'note';
  problem: string;
  detail: string;
}

type Prepared =
  | { kind: 'alias'; line: number; type: AliasType; rest: string; raw: string }
  | { kind: 'defaults'; line: number; rest: string }
  | { kind: 'spec'; line: number; rest: string };

const clip = (value: string, max = CLIP): string => {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

const isCaps = (value: string): boolean => /^[A-Z][A-Z0-9_]*$/u.test(value);
/** ALL is a keyword; only another all-caps word is an alias reference (sudo's own rule). */
const isAliasRef = (value: string): boolean => {
  const bare = value.replace(/^!/u, '').trim();
  return bare !== 'ALL' && isCaps(bare);
};
const isOctal = (value: string): boolean => /^0?[0-7]{1,4}$/u.test(value);
const baseName = (path: string): string => {
  const parts = path.replace(/\/+$/u, '').split('/');
  return (parts[parts.length - 1] ?? '').toLowerCase();
};

/** Removes a trailing comment, keeping `#uid` tokens and backslash escapes. */
function stripComment(line: string): string {
  let quote = '';
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? '';
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote !== '') {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '#') {
      const uidToken = /^#\d+/u.test(line.slice(index)) && (index === 0 || /[,\s]/u.test(line[index - 1] ?? ''));
      if (!uidToken) return line.slice(0, index);
    }
  }
  return line;
}

/** Splits on commas, honouring backslash escapes (sudoers does not treat quotes as special in command lists). */
function splitOnCommas(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (character === '\\' && index + 1 < text.length) {
      current += character + (text[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (character === ',') {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current.trim());
  return parts;
}

const unquote = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
};

interface EntryResult {
  entry: CmdEntry | null;
  error: string;
  aliasRef: string;
}

/** Parses one command-list entry: [!][tag:]*[digest]path or alias or ALL. */
function parseCommandEntry(raw: string, inAlias: boolean, declared: Set<string>, deferAlias = false): EntryResult {
  let text = raw.trim();
  const tags: string[] = [];
  let negated = false;
  const fail = (error: string, aliasRef = ''): EntryResult => ({ entry: null, error, aliasRef });
  if (text.startsWith('!')) {
    negated = true;
    text = text.slice(1).trim();
  }
  if (text === '') return fail('syntax error (empty command)');
  if (text === '""') return fail('empty string');
  for (;;) {
    const match = /^([A-Z][A-Z_]*):\s*(.*)$/su.exec(text);
    if (match === null) break;
    const candidate = match[1] ?? '';
    if (!TAGS.has(candidate)) break;
    if (inAlias) return fail('syntax error (a tag is not allowed inside a Cmnd_Alias)');
    tags.push(candidate);
    text = (match[2] ?? '').trim();
    if (text === '') return fail('syntax error (a tag needs a command after it)');
  }
  let digest = '';
  const digestMatch = /^(sha224|sha256|sha384|sha512|md5):([0-9a-fA-F]*)\s*(.*)$/su.exec(text);
  if (digestMatch !== null) {
    const algorithm = (digestMatch[1] ?? '').toLowerCase();
    const hex = digestMatch[2] ?? '';
    const rest = (digestMatch[3] ?? '').trim();
    digest = algorithm + ':' + hex;
    if (algorithm === 'md5') return fail('syntax error (md5 digests are no longer supported)');
    if (hex.length !== (DIGEST_LENGTHS[algorithm] ?? 0)) {
      return fail('syntax error (a ' + algorithm + ' digest needs ' + (DIGEST_LENGTHS[algorithm] ?? 0) + ' hexadecimal digits)');
    }
    if (rest === '') return fail('syntax error (a digest must be followed by the command it protects)');
    text = rest;
  }
  let path = text;
  let args = '';
  let sudoedit = false;
  if (/^sudoedit(\s|$)/u.test(text)) {
    sudoedit = true;
    const rest = text.slice('sudoedit'.length).trim();
    if (rest === '') return fail('expected a fully-qualified path name (sudoedit needs a path)');
    const split = rest.split(/\s+/u);
    path = split[0] ?? '';
    args = split.slice(1).join(' ');
    if (!path.startsWith('/')) return fail('expected a fully-qualified path name (found "' + clip(path, 30) + '")');
  } else if (text === 'ALL') {
    path = 'ALL';
  } else if (isCaps(text)) {
    if (!deferAlias && !declared.has(text)) return fail('Cmnd_Alias "' + text + '" referenced but not defined', text);
    path = text;
  } else if (text.startsWith('/')) {
    const split = text.split(/\s+/u);
    path = split[0] ?? '';
    args = split.slice(1).join(' ');
  } else {
    return fail('expected a fully-qualified path name (found "' + clip(text, 30) + '")');
  }
  return {
    entry: {
      raw: raw.trim(),
      negated,
      digest,
      path,
      args,
      base: path === 'ALL' ? '' : baseName(path),
      isAll: path === 'ALL',
      sudoedit,
      wildcard: path.includes('*') || args.includes('*'),
      tags,
    },
    error: '',
    aliasRef: '',
  };
}

/** True when the basename pattern of a wildcard path could match one of the shell-escape commands. */
function wildcardCovers(path: string, shells: Set<string>): string[] {
  const pattern = path.split('/').pop() ?? '';
  if (!pattern.includes('*')) return [];
  const expression = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/gu, '\\$&').replace(/\*/gu, '.*') + '$', 'u');
  return [...shells].filter((name) => expression.test(name));
}

function parseDefaultsLine(rest: string, line: number, findings: Finding[], info: DefaultsInfo[]): void {
  let text = rest.trim();
  let scope = 'global';
  const scopeMatch = /^([>@:]\S*)\s*(.*)$/su.exec(text);
  if (scopeMatch !== null) {
    scope = scopeMatch[1] ?? 'global';
    text = (scopeMatch[2] ?? '').trim();
  }
  if (text === '') {
    findings.push({ level: 'error', problem: 'A Defaults line has no entry', detail: 'Line ' + line + ': Defaults needs an option name (visudo: syntax error).' });
    return;
  }
  for (const element of splitOnCommas(text)) {
    if (element === '') continue;
    const match = /^(!?)([A-Za-z_][A-Za-z0-9_]*)\s*(?:\+?=|-=|\+|-)?\s*(.*)$/su.exec(element);
    if (match === null) {
      findings.push({ level: 'error', problem: 'A Defaults entry is not valid', detail: 'Line ' + line + ': "' + clip(element, 40) + '" is not an option name with an optional value (visudo: syntax error).' });
      continue;
    }
    const negated = (match[1] ?? '') === '!';
    const option = match[2] ?? '';
    const rawValue = (match[3] ?? '').trim();
    const operatorMatch = /\s*(\+=|-=|=|\+|-)\s*$/u.exec(element.slice(0, element.length - rawValue.length));
    const value = unquote(rawValue);
    const entry: DefaultsInfo = {
      line,
      scope,
      option,
      operator: operatorMatch?.[1] ?? (value === '' ? '' : '='),
      value,
      enabled: !negated,
      note: negated ? 'disabled' : '',
    };
    info.push(entry);
    const known = DEFAULTS_TYPES[option];
    if (known === undefined) {
      const family = /^(rlimit_|sudoedit_|iolog_|log_server_|intercept_|pam_|selinux_)/u.test(option);
      if (family) {
        findings.push({ level: 'warning', problem: 'A Defaults entry this sudo build may not know', detail: 'Line ' + line + ': "' + option + '" is not an option in the sudo this auditor was calibrated against. Newer versions added options in that family, so it is shown as a warning: on an older sudo, visudo says unknown defaults entry "' + option + '".' });
      } else {
        findings.push({ level: 'error', problem: 'An unknown Defaults entry', detail: 'Line ' + line + ': sudo does not know the option "' + option + '" (visudo: unknown defaults entry "' + option + '").' });
        continue;
      }
    }
    const type = known ?? 'text';
    if (type === 'bool') {
      if (value !== '' || entry.operator !== '') {
        findings.push({ level: 'error', problem: 'A boolean Defaults option was given a value', detail: 'Line ' + line + ': option "' + option + '" does not take a value (visudo: option "' + option + '" does not take a value).' });
      }
      if (option === 'authenticate' && negated) {
        findings.push({ level: 'warning', problem: 'Authentication is switched off', detail: 'Line ' + line + ': Defaults !authenticate lets sudo run the allowed commands without checking a password.' });
      }
      if (option === 'env_reset' && negated) {
        findings.push({ level: 'warning', problem: 'The environment is not reset', detail: 'Line ' + line + ': Defaults !env_reset passes the caller environment into every sudo command.' });
      }
      if (option === 'visiblepw') {
        findings.push({ level: 'warning', problem: 'The password may be echoed', detail: 'Line ' + line + ': Defaults visiblepw lets sudo prompt even when the password cannot be hidden, so it can appear on screen and in logs.' });
      }
      if (option === 'targetpw' || option === 'rootpw') {
        findings.push({ level: 'note', problem: 'A shared password is requested', detail: 'Line ' + line + ': Defaults ' + option + ' asks for that account password instead of the caller own, which means sharing it.' });
      }
      continue;
    }
    if (value === '') {
      findings.push({ level: 'error', problem: 'A Defaults option needs a value', detail: 'Line ' + line + ': no value specified for "' + option + '" (visudo: no value specified for "' + option + '").' });
      continue;
    }
    const invalid = (reason: string): void => {
      findings.push({ level: 'error', problem: reason, detail: 'Line ' + line + ': value "' + value + '" is invalid for option "' + option + '" (visudo: value "' + value + '" is invalid for option "' + option + '").' });
    };
    if (type === 'int' && !/^-?\d+(,-?\d+)*$/u.test(value)) {
      invalid('A Defaults value is not a number');
      continue;
    }
    if (type === 'float' && !/^-?\d+(\.\d+)?$/u.test(value)) {
      invalid('A Defaults value is not a number');
      continue;
    }
    if (type === 'octal' && !isOctal(value)) {
      invalid('A Defaults value is not a valid octal mode');
      continue;
    }
    const allowed = DEFAULTS_ENUMS[option];
    if (type === 'enum' && allowed !== undefined && !allowed.includes(value.toLowerCase())) {
      findings.push({ level: 'error', problem: 'A Defaults value is not one of the accepted names', detail: 'Line ' + line + ': value "' + value + '" is invalid for option "' + option + '"; expected one of ' + allowed.join(', ') + ' (visudo: value "' + value + '" is invalid for option "' + option + '").' });
      continue;
    }
    if (option === 'env_keep' || option === 'env_check') {
      const names = value.split(/[\s,]+/u).filter((name) => name !== '');
      const risky = names.filter((name) => CODE_LOADING_ENV.some((pattern) => pattern.test(name.replace(/^[-+]/u, ''))));
      if (risky.length > 0) {
        entry.note = 'keeps ' + risky.join(', ');
        findings.push({
          level: 'warning',
          problem: 'An environment variable that can load code is preserved',
          detail: 'Line ' + line + ': ' + option + ' keeps ' + risky.join(', ') + '. A caller who sets it can influence the privileged process, so these variables belong in env_delete rather than in the whitelist.',
        });
      }
      if (names.includes('*')) {
        findings.push({ level: 'warning', problem: 'Every environment variable is preserved', detail: 'Line ' + line + ': ' + option + ' uses a wildcard, which keeps the whole caller environment.' });
      }
    }
    if (option === 'env_keep' && value.split(/[\s,]+/u).includes('PATH')) {
      findings.push({ level: 'warning', problem: 'The caller PATH is preserved', detail: 'Line ' + line + ': env_keep keeps PATH, so a command resolved by name can come from a directory the caller controls.' });
    }
  }
}

function parseAliasLine(rest: string, type: AliasType, line: number, raw: string, result: ParseResult): void {
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/su.exec(rest);
  if (match === null) {
    result.findings.push({ level: 'error', problem: 'An alias declaration is malformed', detail: 'Line ' + line + ': ' + type + ' needs a NAME followed by = and its members (visudo: syntax error).' });
    return;
  }
  const name = match[1] ?? '';
  let members = (match[2] ?? '').trim();
  if (members === '' || members === '""') {
    result.findings.push({ level: 'error', problem: 'An alias declares no members', detail: 'Line ' + line + ': ' + type + ' ' + name + (members === '""' ? ' contains ""' : '') + ' (visudo: ' + (members === '""' ? 'empty string' : 'syntax error') + ').' });
    return;
  }
  if (!isCaps(name)) {
    result.findings.push({ level: 'error', problem: 'An alias name is not all capitals', detail: 'Line ' + line + ': "' + name + '" must be all capitals, because sudo treats an upper-case name in a rule as an alias reference (visudo: syntax error).' });
    return;
  }
  if (members.startsWith('"') && members.endsWith('"')) members = members.slice(1, -1);
  const list = splitOnCommas(members);
  if (list.some((member) => member === '')) {
    result.findings.push({ level: 'error', problem: 'An alias member list has an empty entry', detail: 'Line ' + line + ': ' + type + ' ' + name + ' has a trailing or empty member (visudo: syntax error).' });
    return;
  }
  const existing = result.aliases.find((candidate) => candidate.name === name && candidate.type === type);
  if (existing !== undefined) {
    result.findings.push({ level: 'error', problem: 'An alias is defined twice', detail: 'Line ' + line + ': duplicate ' + type + ' "' + name + '", previously defined at line ' + existing.line + ' (visudo: duplicate ' + type + ' "' + name + '").' });
    existing.note = 'duplicate';
    return;
  }
  const alias: AliasInfo = { type, name, members: list, line, raw: clip(raw, 80), used: false, note: '' };
  if (type === 'Cmnd_Alias') {
    for (const member of list) {
      const parsed = parseCommandEntry(member, true, new Set(), true);
      if (parsed.error !== '') {
        result.findings.push({ level: 'error', problem: 'A command alias member is not valid', detail: 'Line ' + line + ': ' + parsed.error + ' — ' + clip(member, 60) + ' (visudo: ' + (parsed.error.startsWith('empty string') ? 'empty string' : 'syntax error') + ').' });
        return;
      }
    }
  } else {
    for (const member of list) {
      if (member.startsWith('%')) {
        const group = member.slice(1).replace(/^#/u, '');
        if (group === '') result.findings.push({ level: 'error', problem: 'A group name is empty', detail: 'Line ' + line + ': "' + member + '" names no group (visudo: empty group).' });
      }
      if (member.startsWith('#') && !/^#\d+$/u.test(member)) {
        result.findings.push({ level: 'error', problem: 'A numeric id is not a number', detail: 'Line ' + line + ': "' + member + '" must be a numeric uid or escaped (visudo: syntax error).' });
      }
    }
  }
  result.aliases.push(alias);
}

function parseSpecLine(text: string, line: number, result: ParseResult, declared: Set<string>, declaredTypes: Map<string, Set<AliasType>>): void {
  let equals = -1;
  let quote = '';
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote !== '') {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '=') {
      equals = index;
      break;
    }
  }
  if (equals === -1) {
    result.findings.push({ level: 'error', problem: 'A user spec has no = sign', detail: 'Line ' + line + ': a spec is written users hosts = (runas) commands (visudo: syntax error).' });
    return;
  }
  const left = text.slice(0, equals).trim();
  const spec: Spec = { line, raw: clip(text, 100), users: [], hosts: [], runas: [], runasGroups: [], tags: [], commands: [], errors: [], notes: [], riskShell: false, riskWildcard: false };
  const fields: string[][] = [[], []];
  let fieldIndex = 0;
  let current = '';
  for (let position = 0; position < left.length; position += 1) {
    const character = left[position] ?? '';
    if (character === '\\' && position + 1 < left.length) {
      current += character + (left[position + 1] ?? '');
      position += 1;
      continue;
    }
    if (character === ',') {
      if (current.trim() !== '') fields[fieldIndex]?.push(current.trim());
      current = '';
      continue;
    }
    if (/\s/u.test(character) && fieldIndex === 0 && current.trim() !== '') {
      fields[0]?.push(current.trim());
      current = '';
      fieldIndex = 1;
      continue;
    }
    current += character;
  }
  if (current.trim() !== '') fields[fieldIndex]?.push(current.trim());
  spec.users = (fields[0] ?? []).filter((value) => value !== '');
  spec.hosts = (fields[1] ?? []).filter((value) => value !== '');
  if (spec.users.length === 0 || spec.hosts.length === 0) {
    result.findings.push({ level: 'error', problem: 'A user spec is missing its users or hosts field', detail: 'Line ' + line + ': a spec needs both a user list and a host list before the = sign (visudo: syntax error).' });
    return;
  }

  let rest = text.slice(equals + 1).trim();
  if (rest.startsWith('(')) {
    let depth = 0;
    let end = -1;
    for (let position = 0; position < rest.length; position += 1) {
      const character = rest[position] ?? '';
      if (character === '\\') {
        position += 1;
        continue;
      }
      if (character === '(') depth += 1;
      if (character === ')') {
        depth -= 1;
        if (depth === 0) {
          end = position;
          break;
        }
      }
    }
    if (end === -1) {
      result.findings.push({ level: 'error', problem: 'A runas list is not closed', detail: 'Line ' + line + ': the (runas) list has no closing bracket (visudo: syntax error).' });
      return;
    }
    const runasText = rest.slice(1, end);
    const colon = runasText.indexOf(':');
    spec.runas = splitOnCommas(colon === -1 ? runasText : runasText.slice(0, colon)).filter((value) => value !== '');
    spec.runasGroups = colon === -1 ? [] : splitOnCommas(runasText.slice(colon + 1)).filter((value) => value !== '');
    rest = rest.slice(end + 1).trim();
  }
  for (;;) {
    const tagMatch = /^([A-Z][A-Z_]*):\s*(.*)$/su.exec(rest);
    if (tagMatch === null) break;
    const candidate = tagMatch[1] ?? '';
    if (!TAGS.has(candidate)) {
      result.findings.push({ level: 'error', problem: 'A tag is not one sudo knows', detail: 'Line ' + line + ': "' + candidate + '" is not a sudoers tag (visudo: syntax error).' });
      return;
    }
    spec.tags.push(candidate);
    rest = (tagMatch[2] ?? '').trim();
  }
  if (rest === '') {
    result.findings.push({ level: 'error', problem: 'A user spec has no command', detail: 'Line ' + line + ': the command list after the = sign is empty (visudo: syntax error).' });
    return;
  }
  const entries = splitOnCommas(rest);
  if (entries.some((entry) => entry === '')) {
    result.findings.push({ level: 'error', problem: 'A command list has an empty entry', detail: 'Line ' + line + ': a trailing comma leaves an empty command (visudo: syntax error).' });
    return;
  }
  const declaredCommands = new Set([...declaredTypes.keys()].filter((name) => declaredTypes.get(name)?.has('Cmnd_Alias') ?? false));
  for (const entry of entries) {
    const parsed = parseCommandEntry(entry, false, declaredCommands);
    if (parsed.entry !== null) {
      spec.commands.push(parsed.entry);
      continue;
    }
    spec.errors.push(parsed.error);
    if (parsed.aliasRef !== '') {
      result.findings.push({ level: 'error', problem: 'A rule refers to an alias that is not defined', detail: 'Line ' + line + ': Cmnd_Alias "' + parsed.aliasRef + '" referenced but not defined. visudo prints this without failing the parse, but the entry can never match.' });
    } else {
      result.findings.push({ level: 'error', problem: 'A command is not valid sudoers syntax', detail: 'Line ' + line + ': ' + parsed.error + ' — ' + clip(text, 80) + ' (visudo: syntax error).' });
    }
  }
  const checkAlias = (values: string[], field: 'User_Alias' | 'Host_Alias' | 'Runas_Alias'): void => {
    for (const value of values) {
      const member = value.replace(/^!/u, '').trim();
      if (isAliasRef(member) && !declared.has(member)) {
        result.findings.push({ level: 'error', problem: 'A rule refers to an alias that is not defined', detail: 'Line ' + line + ': ' + field + ' "' + member + '" referenced but not defined. visudo prints this without failing the parse, but the rule grants nothing.' });
      } else if (isAliasRef(member) && !(declaredTypes.get(member)?.has(field) ?? false)) {
        const actual = [...(declaredTypes.get(member) ?? [])].join(' and ');
        result.findings.push({ level: 'error', problem: 'A rule uses an alias of the wrong type', detail: 'Line ' + line + ': "' + member + '" is declared as ' + actual + ', but that field needs a ' + field + ' (visudo: ' + field + ' "' + member + '" referenced but not defined). sudo keeps a separate namespace for every alias type.' });
      }
      if (member.startsWith('%') && member.slice(1).replace(/^#/u, '') === '') {
        result.findings.push({ level: 'error', problem: 'A group name is empty', detail: 'Line ' + line + ': "' + member + '" names no group (visudo: empty group).' });
      }
      if (member.startsWith('#') && !/^#\d+$/u.test(member)) {
        result.findings.push({ level: 'error', problem: 'A numeric id is not a number', detail: 'Line ' + line + ': "' + member + '" must be a numeric uid (visudo: syntax error).' });
      }
    }
  };
  checkAlias(spec.users, 'User_Alias');
  checkAlias(spec.hosts, 'Host_Alias');
  checkAlias([...spec.runas, ...spec.runasGroups], 'Runas_Alias');
  result.specs.push(spec);
}

function detectCycles(aliases: AliasInfo[], onCycle: (alias: AliasInfo, path: string[]) => void): void {
  const byName = new Map(aliases.map((alias) => [alias.name, alias]));
  const state = new Map<string, number>();
  const visit = (name: string, path: string[]): void => {
    const alias = byName.get(name);
    if (alias === undefined) return;
    const current = state.get(name);
    if (current === 2) return;
    if (current === 1) {
      onCycle(alias, [...path, name]);
      return;
    }
    state.set(name, 1);
    for (const member of alias.members) {
      const bare = member.replace(/^!/u, '').trim();
      if (byName.has(bare)) visit(bare, [...path, name]);
    }
    state.set(name, 2);
  };
  for (const alias of aliases) visit(alias.name, []);
}

interface ParseResult {
  specs: Spec[];
  aliases: AliasInfo[];
  defaults: DefaultsInfo[];
  includes: IncludeInfo[];
  findings: Finding[];
  comments: number;
  truncated: number;
  continued: number;
  capped: boolean;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const shellsRaw = String(options.shells ?? '');
  const shells = new Set(
    (shellsRaw.trim() === '' ? DEFAULT_SHELLS : shellsRaw.split(/[,\s]+/u)).map((value) => value.trim().toLowerCase()).filter((value) => value !== ''),
  );

  const source = (input.files ?? [])[0];
  let text: string;
  let sourceLabel: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 8 MB.', 'A sudoers file is normally a few kilobytes.');
    text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(await source.arrayBuffer()));
    sourceLabel = source.name === '' ? 'uploaded file' : source.name;
  } else {
    text = String(input.text ?? '');
    if (text.trim() === '') throw new ToolError('No sudoers policy was provided.', 'Paste /etc/sudoers, or a drop-in from /etc/sudoers.d.');
    sourceLabel = 'pasted text';
  }
  if (text.length > MAX_BYTES) throw new ToolError('That is more than 8 MB of input.');

  const result: ParseResult = { specs: [], aliases: [], defaults: [], includes: [], findings: [], comments: 0, truncated: 0, continued: 0, capped: false };
  const physical = text.split('\n');
  const logical: { line: number; text: string }[] = [];
  let pending = '';
  let pendingLine = 0;
  for (let index = 0; index < physical.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = (physical[index] ?? '').replace(/\r$/u, '');
    if (rawLine.length > MAX_LINE) result.truncated += 1;
    const clipped = rawLine.length > MAX_LINE ? rawLine.slice(0, MAX_LINE) : rawLine;
    if (pending === '') pendingLine = lineNumber;
    if (/\\$/u.test(clipped)) {
      result.continued += 1;
      pending += clipped.replace(/\\$/u, ' ');
      continue;
    }
    logical.push({ line: pendingLine, text: pending + clipped });
    pending = '';
  }
  if (pending !== '') logical.push({ line: pendingLine, text: pending });

  const prepared: Prepared[] = [];
  for (const entry of logical) {
    const trimmed = entry.text.trim();
    if (trimmed === '') continue;
    const includeMatch = /^[@#]include(dir)?\s+(.*)$/u.exec(trimmed);
    if (includeMatch !== null) {
      result.includes.push({ line: entry.line, kind: (includeMatch[1] ?? '') === 'dir' ? 'include directory' : 'include file', path: (includeMatch[2] ?? '').trim() });
      continue;
    }
    if (trimmed.startsWith('#')) {
      result.comments += 1;
      continue;
    }
    const stripped = stripComment(entry.text);
    if (stripped.trim() === '') {
      result.comments += 1;
      continue;
    }
    const body = stripped.trim();
    const aliasType = ALIAS_TYPES.find((type) => body.startsWith(type) && (/^\s*[A-Za-z_]/u.test(body.slice(type.length)) || body.slice(type.length).trim() === ''));
    if (aliasType !== undefined) {
      prepared.push({ kind: 'alias', line: entry.line, type: aliasType, rest: body.slice(aliasType.length), raw: body });
      continue;
    }
    if (body.startsWith('Defaults')) {
      prepared.push({ kind: 'defaults', line: entry.line, rest: body.slice('Defaults'.length) });
      continue;
    }
    prepared.push({ kind: 'spec', line: entry.line, rest: body });
  }

  for (const entry of prepared) {
    if (entry.kind === 'alias') parseAliasLine(entry.rest, entry.type, entry.line, entry.raw, result);
  }
  const declared = new Set(result.aliases.map((alias) => alias.name));
  const declaredTypes = new Map<string, Set<AliasType>>();
  for (const alias of result.aliases) {
    const set = declaredTypes.get(alias.name) ?? new Set<AliasType>();
    set.add(alias.type);
    declaredTypes.set(alias.name, set);
  }

  // Build the transitive set of aliases a spec's own references reach, so an undefined alias
  // that is only reached through another alias is still caught.
  const aliasByName = new Map(result.aliases.map((alias) => [alias.name, alias]));
  /** Every alias name reachable from one alias, walked iteratively so alias cycles cannot recurse forever. */
  const reachableFrom = (name: string): Set<string> => {
    const out = new Set<string>();
    const visited = new Set<string>([name]);
    const stack: string[] = [name];
    while (stack.length > 0) {
      const alias = aliasByName.get(stack.pop() as string);
      if (alias === undefined) continue;
      for (const member of alias.members) {
        const bare = member.replace(/^!/u, '').trim();
        if (!isCaps(bare)) continue;
        out.add(bare);
        if (!visited.has(bare)) {
          visited.add(bare);
          stack.push(bare);
        }
      }
    }
    return out;
  };

  const cycles: { alias: AliasInfo; path: string[] }[] = [];
  detectCycles(result.aliases, (alias, path) => cycles.push({ alias, path }));
  for (const alias of result.aliases) {
  }
  for (const entry of prepared) {
    if (entry.kind === 'defaults') {
      parseDefaultsLine(entry.rest, entry.line, result.findings, result.defaults);
      continue;
    }
    if (entry.kind === 'alias') continue;
    if (result.specs.length >= MAX_SPECS) {
      result.capped = true;
      continue;
    }
    parseSpecLine(entry.rest, entry.line, result, declared, declaredTypes);
  }

  const seen = new Map<string, number>();
  for (const spec of result.specs) {
    const key = spec.raw.replace(/\s+/gu, ' ').trim();
    const first = seen.get(key);
    if (first !== undefined) {
      spec.notes.push('duplicate of line ' + first);
      result.findings.push({ level: 'warning', problem: 'The same grant appears twice', detail: 'Lines ' + first + ' and ' + spec.line + ' are identical, so one of them can be deleted.' });
    } else {
      seen.set(key, spec.line);
    }
  }

  const cmndMembers = new Map<string, CmdEntry[]>();
  for (const alias of result.aliases) {
    if (alias.type !== 'Cmnd_Alias') continue;
    const entries: CmdEntry[] = [];
    for (const member of alias.members) {
      const parsed = parseCommandEntry(member, true, new Set(), true);
      if (parsed.entry !== null) entries.push(parsed.entry);
    }
    cmndMembers.set(alias.name, entries);
  }
  /** Resolves a command through Cmnd_Alias definitions, with a depth cap against cycles. */
  const expandCommand = (command: CmdEntry, depth: number): CmdEntry[] => {
    if (depth >= 6 || command.isAll) return [command];
    const members = cmndMembers.get(command.path);
    if (members === undefined || members.length === 0) return [command];
    return members.flatMap((member) => expandCommand(member, depth + 1));
  };

  const specReferenced = new Set<string>();
  for (const spec of result.specs) {
    for (const value of [...spec.users, ...spec.hosts, ...spec.runas, ...spec.runasGroups]) {
      const bare = value.replace(/^!/u, '').trim();
      if (declared.has(bare)) specReferenced.add(bare);
    }
    for (const command of spec.commands) if (declared.has(command.path)) specReferenced.add(command.path);
  }
  for (const cycle of cycles) {
    if (specReferenced.has(cycle.alias.name)) {
      result.findings.push({ level: 'error', problem: 'An alias refers to itself', detail: 'Line ' + cycle.alias.line + ': cycle in ' + cycle.alias.type + ' "' + cycle.alias.name + '" (' + cycle.path.join(' → ') + '). visudo reports this without failing the parse, but the alias can never be resolved.' });
      cycle.alias.note = 'cycle';
    } else {
      cycle.alias.note = 'cycle (no rule uses it)';
    }
  }

  const usedAliases = new Set<string>();
  for (const spec of result.specs) {
    for (const value of [...spec.users, ...spec.hosts, ...spec.runas, ...spec.runasGroups]) {
      const bare = value.replace(/^!/u, '').trim();
      if (declared.has(bare)) usedAliases.add(bare);
    }
    for (const command of spec.commands) if (declared.has(command.path)) usedAliases.add(command.path);
  }
  for (const alias of result.aliases) {
    if (usedAliases.has(alias.name)) {
      for (const name of reachableFrom(alias.name)) {
        if (!declared.has(name)) {
          result.findings.push({ level: 'error', problem: 'A used alias refers to an alias that is not defined', detail: 'Line ' + alias.line + ': ' + alias.type + ' ' + alias.name + ' reaches "' + name + '", which no alias defines. visudo accepts the declaration but refuses the rule that uses ' + alias.name + '.' });
        }
      }
    }
    for (const member of alias.members) {
      const bare = member.replace(/^!/u, '').trim();
      if (declared.has(bare)) usedAliases.add(bare);
    }
    if (usedAliases.has(alias.name)) alias.used = true;
    else if (alias.note === '') {
      alias.note = 'never referenced';
      result.findings.push({ level: 'note', problem: 'An alias is never referenced', detail: 'Line ' + alias.line + ': ' + alias.type + ' ' + alias.name + ' is defined but no rule or alias uses it.' });
    }
    if (alias.type === 'Cmnd_Alias' && alias.members.some((member) => member.replace(/^!/u, '').trim() === 'ALL')) {
      result.findings.push({ level: 'warning', problem: 'A command alias permits every command', detail: 'Line ' + alias.line + ': ' + alias.name + ' contains ALL, so any rule naming it grants every command.' });
    }
  }
  for (const include of result.includes) {
    result.findings.push({
      level: 'note',
      problem: 'An include directive is not expanded',
      detail: 'Line ' + include.line + ': ' + include.kind + ' ' + include.path + ' cannot be read from a pasted file, so the rules it holds are missing from this analysis.',
    });
  }

  let nopasswd = 0;
  let shellGrants = 0;
  let allUserGrants = 0;
  let allHostGrants = 0;
  let wildcardCommands = 0;
  const risky: { line: number; reason: string }[] = [];

  for (const spec of result.specs) {
    const has = (command: CmdEntry, tag: string): boolean => spec.tags.includes(tag) || command.tags.includes(tag);
    const usersAll = spec.users.some((user) => user.replace(/^!/u, '').trim() === 'ALL');
    const hostsAll = spec.hosts.some((host) => host.replace(/^!/u, '').trim() === 'ALL');
    const runasAll = spec.runas.some((user) => user.replace(/^!/u, '').trim() === 'ALL');
    if (usersAll) {
      allUserGrants += 1;
      result.findings.push({ level: 'warning', problem: 'A rule applies to every user', detail: 'Line ' + spec.line + ': the user field is ALL, so every account on the host is covered, service accounts included.' });
    }
    if (hostsAll) {
      allHostGrants += 1;
      spec.notes.push('every host');
    }
    if (runasAll) spec.notes.push('run as anyone');
    if (spec.commands.length > 0 && spec.commands.every((command) => command.negated)) {
      spec.notes.push('only negations');
      result.findings.push({ level: 'warning', problem: 'A command list has only negated entries', detail: 'Line ' + spec.line + ': sudoers reads a list whose first entry is negated as everything except the listed commands, so this grant is much wider than it looks.' });
    }
    for (const command of spec.commands) {
      for (const target of expandCommand(command, 0)) {
        if (target.wildcard) {
          wildcardCommands += 1;
          spec.riskWildcard = true;
          result.findings.push({ level: 'note', problem: 'A command rule uses a wildcard', detail: 'Line ' + spec.line + ': "' + clip(target.raw, 60) + '" contains a wildcard, which matches more than the author usually expects, especially in argument positions.' });
          // A sudoedit path is a file to edit, not a command to run, so it cannot be widened into one.
          const covered = target.sudoedit ? [] : wildcardCovers(target.path, shells);
          if (covered.length > 0) {
            spec.riskShell = true;
            result.findings.push({ level: 'warning', problem: 'A wildcard command can be widened into a shell', detail: 'Line ' + spec.line + ': ' + target.path + ' also matches ' + clip(covered.slice(0, 6).join(', '), 70) + ' among the commands treated as a shell escape, so the rule can run a shell as the target user.' });
          }
        }
        if (target.negated && target.isAll) {
          result.findings.push({ level: 'note', problem: 'A command list excludes everything', detail: 'Line ' + spec.line + ': "!ALL" removes every command, so this entry permits nothing.' });
        }
        if (target.isAll) {
          if (has(command, 'NOPASSWD')) {
            nopasswd += 1;
            spec.riskShell = true;
            result.findings.push({ level: 'warning', problem: 'A passwordless grant covers every command', detail: 'Line ' + spec.line + ': NOPASSWD with ALL is equivalent to root for the listed users' + (usersAll ? ', and the user field is ALL' : '') + '.' });
            if (usersAll) risky.push({ line: spec.line, reason: 'every user, passwordless, all commands' });
          }
          continue;
        }
        // A shell with its arguments pinned runs exactly those arguments; an interactive editor does not.
        const escape = target.args === '' && !target.wildcard ? shells.has(target.base) : INTERACTIVE.has(target.base) && shells.has(target.base);
        if (has(command, 'NOPASSWD')) {
          nopasswd += 1;
          if (escape) {
            shellGrants += 1;
            spec.riskShell = true;
            result.findings.push({ level: 'warning', problem: 'A passwordless grant reaches a shell', detail: 'Line ' + spec.line + ': NOPASSWD on ' + target.path + (target.args === '' ? '' : ' ' + clip(target.args, 30)) + ' is a root shell, because ' + target.base + ' can run commands of its own and no password is asked for.' });
            risky.push({ line: spec.line, reason: 'passwordless ' + target.base });
          } else if (target.sudoedit) {
            spec.notes.push('passwordless sudoedit');
            result.findings.push({ level: 'note', problem: 'An editor is reachable without a password', detail: 'Line ' + spec.line + ': sudoedit is allowed with NOPASSWD, so the caller only needs to influence which editor runs (SUDO_EDITOR or the env_keep list) to run code as the target user.' });
          }
        }
        if (has(command, 'SETENV') && escape) {
          result.findings.push({ level: 'note', problem: 'A shell grant also accepts environment variables', detail: 'Line ' + spec.line + ': SETENV on ' + target.path + ' lets the caller pass arbitrary variables into the privileged command.' });
        }
      }
    }
  }

  const envKeep = result.defaults.filter((entry) => entry.note.startsWith('keeps '));
  if (!result.defaults.some((entry) => entry.option === 'env_reset')) {
    result.findings.push({ level: 'note', problem: 'Environment handling is not set explicitly', detail: 'No Defaults env_reset (or !env_reset) entry was found, so the compiled default of that sudo build applies, which is normally env_reset.' });
  }
  if (!result.defaults.some((entry) => entry.option === 'secure_path') && result.specs.length > 0) {
    result.findings.push({ level: 'note', problem: 'No secure_path is set', detail: 'Without Defaults secure_path, commands are looked up with the PATH of the calling user, which the caller can influence.' });
  }

  const errors = result.findings.filter((finding) => finding.level === 'error').length;
  const warnings = result.findings.filter((finding) => finding.level === 'warning').length;
  const notes = result.findings.filter((finding) => finding.level === 'note').length;
  const risk = errors > 0 ? 'cannot be applied' : risky.length > 0 ? 'high' : warnings > 0 ? 'medium' : notes > 0 ? 'low' : 'clean';

  const resultNotes: string[] = [];
  const resultWarnings: string[] = [];
  if (result.capped) resultNotes.push('Only the first ' + MAX_SPECS + ' user specs were analyzed.');
  if (result.findings.length >= MAX_FINDINGS) resultNotes.push('Only the first ' + MAX_FINDINGS + ' findings are shown.');
  if (result.comments > 0) resultNotes.push(result.comments + ' comment line(s) were skipped.');
  if (result.continued > 0) resultNotes.push(result.continued + ' line(s) were joined by a trailing backslash.');
  if (result.truncated > 0) resultNotes.push(result.truncated + ' line(s) were longer than ' + MAX_LINE + ' characters and were cut.');
  if (errors > 0) resultWarnings.push(errors + ' line(s) would make sudo refuse this file.');
  if (shellGrants > 0) resultWarnings.push(shellGrants + ' passwordless rule(s) reach a shell.');

  const stats: Record<string, string | number> = {
    bytes: text.length,
    lines: physical.length,
    specs: result.specs.length,
    aliases: result.aliases.length,
    defaults: result.defaults.length,
    includes: result.includes.length,
    nopasswd,
    shellGrants,
    wildcardCommands,
    unusedAliases: result.aliases.filter((alias) => !alias.used).length,
    findings: result.findings.length,
    errors,
    warnings,
    notes,
    risk,
  };

  if (format === 'specs') {
    const rows = result.specs.slice(0, MAX_ROWS).map((spec) => {
      const commands = spec.commands.map((command) => (command.negated ? '!' : '') + (command.isAll ? 'ALL' : command.path)).join(', ');
      const marks: string[] = [];
      if (spec.notes.includes('every host')) marks.push('every host');
      if (spec.notes.includes('run as anyone')) marks.push('run as anyone');
      if (spec.notes.includes('only negations')) marks.push('only negations');
      if (spec.commands.some((command) => spec.tags.includes('NOPASSWD') || command.tags.includes('NOPASSWD'))) marks.push('NOPASSWD');
      if (spec.riskShell) marks.push('shell');
      if (spec.riskWildcard) marks.push('wildcard');
      if (spec.notes.some((note) => note.startsWith('duplicate'))) marks.push('duplicate');
      if (spec.errors.length > 0) marks.push('invalid');
      const runas = spec.runas.join(', ') + (spec.runasGroups.length > 0 ? ':' + spec.runasGroups.join(', ') : '');
      return [spec.users.join(', '), spec.hosts.join(', '), runas === '' ? '-' : runas, spec.tags.join(' ') === '' ? '-' : spec.tags.join(' '), clip(commands, 46), marks.length === 0 ? '-' : clip(marks.join(', '), 34)];
    });
    if (result.specs.length > rows.length) resultNotes.push('Only the first ' + MAX_ROWS + ' user specs are listed.');
    return {
      outputs: [],
      report: { output: JSON.stringify({ headers: ['Users', 'Hosts', 'Runas', 'Tags', 'Commands', 'Risk'], rows: rows.length === 0 ? [['-', '-', '-', '-', '(no user specs)', '-']] : rows }), render: 'table' },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'aliases') {
    const rows = result.aliases.slice(0, MAX_ROWS).map((alias) => [alias.type.replace('_Alias', ''), alias.name, clip(alias.members.join(', '), 60), String(alias.members.length), alias.used ? 'used' : 'unused', alias.note === '' ? '-' : alias.note]);
    if (result.aliases.length > rows.length) resultNotes.push('Only the first ' + MAX_ROWS + ' aliases are listed.');
    return {
      outputs: [],
      report: { output: JSON.stringify({ headers: ['Type', 'Name', 'Members', 'Count', 'Status', 'Notes'], rows: rows.length === 0 ? [['-', '-', '(no aliases)', '0', '-', '-']] : rows }), render: 'table' },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'defaults') {
    const rows = result.defaults.slice(0, MAX_ROWS).map((entry) => [entry.scope, entry.option + (entry.enabled ? '' : ' (negated)'), entry.operator === '' ? '-' : entry.operator, clip(entry.value === '' ? '-' : entry.value, 50), entry.note === '' ? '-' : entry.note]);
    if (result.defaults.length > rows.length) resultNotes.push('Only the first ' + MAX_ROWS + ' Defaults entries are listed.');
    return {
      outputs: [],
      report: { output: JSON.stringify({ headers: ['Scope', 'Option', 'Operator', 'Value', 'Notes'], rows: rows.length === 0 ? [['-', '(no Defaults entries)', '-', '-', '-']] : rows }), render: 'table' },
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
          rows: result.findings.length === 0 ? [['ok', 'Nothing to flag', 'Every line parses, no grant is passwordless, and no alias is unused or undefined.']] : result.findings.map((finding) => [finding.level, finding.problem, finding.detail]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  const summaryRows: string[][] = [
    ['Source', sourceLabel],
    ['Size', text.length + ' bytes in ' + physical.length + ' lines'],
    ['Policy', 'sudoers (' + (result.includes.length > 0 ? result.includes.length + ' include directive(s) not expanded' : 'self-contained') + ')'],
    ['User specs', String(result.specs.length)],
    ['Aliases', result.aliases.length + ' (' + result.aliases.filter((alias) => alias.used).length + ' used, ' + result.aliases.filter((alias) => !alias.used).length + ' unused)'],
    ['Defaults entries', String(result.defaults.length)],
    ['Passwordless grants', String(nopasswd)],
    ['Grants reaching a shell', String(shellGrants)],
    ['Grants for every user', String(allUserGrants)],
    ['Grants valid on every host', String(allHostGrants)],
    ['Wildcard commands', String(wildcardCommands)],
    ['Environment kept', envKeep.length === 0 ? 'nothing that loads code' : envKeep.map((entry) => entry.note.replace('keeps ', '')).join('; ')],
    ['Risk', risk],
    ['Findings', errors + ' error, ' + warnings + ' warning, ' + notes + ' note'],
  ];
  if (risky.length > 0) {
    summaryRows.push(['Worst grants', clip(risky.slice(0, 4).map((entry) => 'line ' + entry.line + ': ' + entry.reason).join('; '), 80)]);
  }
  return {
    outputs: [],
    report: { output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }), render: 'table' },
    notes: resultNotes,
    warnings: resultWarnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
