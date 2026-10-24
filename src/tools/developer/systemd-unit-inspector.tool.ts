import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './systemd-unit-inspector.meta';

const MAX_LENGTH = 2 * 1024 * 1024;
const MAX_LINES = 20_000;
const MAX_FINDINGS = 300;
const MAX_ROWS = 2000;
const CLIP = 100;

/**
 * Directives accepted by systemd, grouped by section. Every entry here was checked against
 * the systemd on the development machine: a generated unit holding all of them must produce
 * no "Unknown key" line from `systemd-analyze verify`. Keys beginning with X- are the user's own.
 */
const KEYS: Record<string, string[]> = {
  Unit: [
    'Description', 'Documentation', 'Requires', 'Requisite', 'Wants', 'BindsTo', 'PartOf', 'Upholds', 'Conflicts',
    'Before', 'After', 'OnFailure', 'OnSuccess', 'PropagatesReloadTo', 'ReloadPropagatedFrom', 'StopPropagatedFrom',
    'JoinsNamespaceOf', 'RequiresMountsFor', 'ConditionPathExists', 'ConditionPathExistsGlob', 'ConditionPathIsDirectory',
    'ConditionPathIsSymbolicLink', 'ConditionPathIsMountPoint', 'ConditionPathIsReadWrite', 'ConditionDirectoryNotEmpty',
    'ConditionFileNotEmpty', 'ConditionFileIsExecutable', 'ConditionNeedsUpdate', 'ConditionFirstBoot', 'ConditionArchitecture',
    'ConditionVirtualization', 'ConditionHost', 'ConditionKernelCommandLine', 'ConditionKernelVersion', 'ConditionSecurity',
    'ConditionCapability', 'ConditionACPower', 'ConditionUser', 'ConditionGroup', 'ConditionControlGroupController',
    'ConditionMemory', 'ConditionCPUs', 'ConditionEnvironment', 'ConditionPathIsEncrypted',
    'AssertPathExists', 'AssertPathExistsGlob', 'AssertPathIsDirectory', 'AssertPathIsSymbolicLink', 'AssertPathIsMountPoint',
    'AssertPathIsReadWrite', 'AssertDirectoryNotEmpty', 'AssertFileNotEmpty', 'AssertFileIsExecutable', 'AssertNeedsUpdate',
    'AssertFirstBoot', 'AssertArchitecture', 'AssertVirtualization', 'AssertHost', 'AssertKernelCommandLine',
    'AssertKernelVersion', 'AssertSecurity', 'AssertCapability', 'AssertACPower', 'AssertUser', 'AssertGroup',
    'AssertControlGroupController', 'AssertMemory', 'AssertCPUs', 'AssertEnvironment',
    'StartLimitIntervalSec', 'StartLimitBurst', 'StartLimitAction', 'RebootArgument', 'FailureAction', 'SuccessAction',
    'AllowIsolate', 'DefaultDependencies', 'IgnoreOnIsolate', 'JobTimeoutSec', 'JobRunningTimeoutSec', 'JobTimeoutAction',
    'JobTimeoutRebootArgument', 'SourcePath', 'CollectMode', 'RefuseManualStart', 'RefuseManualStop',
  ],
  Service: [
    'Type', 'ExecStart', 'ExecStartPre', 'ExecStartPost', 'ExecCondition', 'ExecReload', 'ExecStop', 'ExecStopPost',
    'RemainAfterExit', 'GuessMainPID', 'PIDFile', 'BusName', 'NotifyAccess', 'Sockets', 'FileDescriptorStoreMax',
    'FileDescriptorStorePreserve', 'USBFunctionDescriptors', 'WatchdogSec', 'WatchdogSignal', 'Restart', 'RestartSec',
    'RestartPreventExitStatus', 'RestartForceExitStatus', 'SuccessExitStatus', 'RootDirectory', 'RootImage',
    'RootImagePolicy', 'MountAPIVFS', 'RootDirectoryStartOnly', 'NonBlocking', 'WorkingDirectory', 'RuntimeDirectory',
    'RuntimeDirectoryMode', 'RuntimeDirectoryPreserve', 'RuntimeDirectorySymlink', 'StateDirectory', 'StateDirectoryMode',
    'StateDirectorySymlink', 'CacheDirectory', 'CacheDirectoryMode', 'CacheDirectorySymlink', 'LogsDirectory',
    'LogsDirectoryMode', 'LogsDirectorySymlink', 'ConfigurationDirectory', 'ConfigurationDirectoryMode',
    'ConfigurationDirectorySymlink', 'User', 'Group', 'DynamicUser', 'SupplementaryGroups', 'SetLoginEnvironment',
    'RemoveIPC', 'Environment', 'EnvironmentFile', 'PassEnvironment', 'UnsetEnvironment', 'StandardInput', 'StandardOutput',
    'StandardError', 'StandardInputText', 'StandardInputData', 'LogLevel', 'LogExtraFields', 'LogNamespace',
    'LogRateLimitIntervalSec', 'LogRateLimitBurst', 'SyslogIdentifier', 'SyslogFacility', 'SyslogLevel',
    'SyslogLevelPrefix', 'SyslogTimestamping', 'TTYPath', 'TTYReset', 'TTYVHangup', 'TTYVTDisallocate', 'TTYColumns',
    'TTYRows', 'TTYMode', 'PrivateTmp', 'PrivateDevices', 'PrivateNetwork', 'PrivateUsers', 'PrivateMounts', 'PrivateIPC',
    'ProtectSystem', 'ProtectHome', 'ProtectKernelTunables', 'ProtectKernelModules', 'ProtectKernelLogs',
    'ProtectControlGroups', 'ProtectClock', 'ProtectHostname', 'ProtectProc', 'ProcSubset', 'RestrictAddressFamilies',
    'RestrictNamespaces', 'RestrictRealtime', 'RestrictSUIDSGID', 'LockPersonality', 'MemoryDenyWriteExecute',
    'SystemCallArchitectures', 'SystemCallFilter', 'SystemCallErrorNumber', 'SystemCallLog', 'NoNewPrivileges',
    'CapabilityBoundingSet', 'AmbientCapabilities', 'SecureBits', 'KeyringMode', 'OOMScoreAdjust', 'Nice', 'OOMPolicy',
    'CPUSchedulingPolicy', 'CPUSchedulingPriority', 'CPUSchedulingResetOnFork', 'CPUAffinity', 'CPUQuota', 'CPUWeight',
    'CPUAccounting', 'IOSchedulingClass', 'IOSchedulingPriority', 'IOWeight', 'IOReadBandwidthMax', 'IOWriteBandwidthMax',
    'IOReadIOPSMax', 'IOWriteIOPSMax', 'IODeviceWeight', 'IODeviceLatencyTargetSec', 'MemoryMin', 'MemoryLow',
    'MemoryHigh', 'MemoryMax', 'MemorySwapMax', 'MemoryZSwapMax', 'MemoryAccounting', 'TasksMax', 'TasksAccounting',
    'LimitNOFILE', 'LimitNOFILESoft', 'LimitNPROC', 'LimitCORE', 'LimitFSIZE', 'LimitSTACK', 'LimitAS', 'LimitDATA',
    'LimitRSS', 'LimitMEMLOCK', 'LimitLOCKS', 'LimitSIGPENDING', 'LimitMSGQUEUE', 'LimitNICE', 'LimitRTPRIO',
    'LimitRTTIME', 'UMask', 'KillMode', 'KillSignal', 'KillSignalRestartSec', 'SendSIGKILL', 'SendSIGHUP',
    'TimeoutStartSec', 'TimeoutStopSec', 'TimeoutSec', 'TimeoutAbortSec', 'TimeoutStartFailureMode',
    'TimeoutStopFailureMode', 'RuntimeMaxSec', 'RuntimeRandomizedExtraSec', 'DevicePolicy', 'DeviceAllow', 'Delegate',
    'DelegateSubgroup', 'Slice', 'ManagedOOMSwap', 'ManagedOOMMemoryPressure', 'ManagedOOMMemoryPressureLimit',
    'ManagedOOMPreference',
  ],
  Socket: [
    'ListenStream', 'ListenDatagram', 'ListenSequentialPacket', 'ListenFIFO', 'ListenSpecial', 'ListenNetlink',
    'ListenMessageQueue', 'ListenUSBFunction', 'SocketProtocol', 'BindIPv6Only', 'Backlog', 'BindToDevice', 'ExecStartPre',
    'ExecStartPost', 'ExecStopPre', 'ExecStopPost', 'Accept', 'MaxConnections', 'MaxConnectionsPerSource', 'KeepAlive',
    'KeepAliveTimeSec', 'KeepAliveIntervalSec', 'KeepAliveProbes', 'DeferAcceptSec', 'NoDelay', 'Priority',
    'ReceiveBuffer', 'SendBuffer', 'IPTOS', 'IPTTL', 'Mark', 'ReusePort', 'SmackLabel', 'SmackLabelIPIn',
    'SmackLabelIPOut', 'SELinuxContextFromNet', 'PipeSize', 'MessageQueueMaxMessages', 'MessageQueueMessageSize',
    'FreeBind', 'Transparent', 'Broadcast', 'TriggerLimitIntervalSec', 'TriggerLimitBurst', 'Symlinks',
  ],
  Timer: [
    'OnActiveSec', 'OnBootSec', 'OnStartupSec', 'OnUnitActiveSec', 'OnUnitInactiveSec', 'OnCalendar', 'OnClockChange',
    'OnTimezoneChange', 'AccuracySec', 'RandomizedDelaySec', 'FixedRandomDelay', 'RemainAfterElapse', 'Persistent',
    'WakeSystem', 'Unit',
  ],
  Path: [
    'PathExists', 'PathExistsGlob', 'PathChanged', 'PathModified', 'DirectoryNotEmpty', 'MakeDirectory', 'DirectoryMode',
    'TriggerLimitIntervalSec', 'TriggerLimitBurst', 'Unit',
  ],
  Install: ['WantedBy', 'RequiredBy', 'Alias', 'Also', 'DefaultInstance'],
};

/** Directives that are explicitly allowed to appear more than once. */
const REPEATABLE = new Set([
  'ExecStart', 'ExecStartPre', 'ExecStartPost', 'ExecCondition', 'ExecReload', 'ExecStop', 'ExecStopPost',
  'Environment', 'EnvironmentFile', 'PassEnvironment', 'UnsetEnvironment', 'SupplementaryGroups', 'Documentation',
  'OnFailure', 'OnSuccess', 'ListenStream', 'ListenDatagram', 'ListenSequentialPacket', 'ListenFIFO', 'ListenSpecial',
  'ListenNetlink', 'ListenMessageQueue', 'ListenUSBFunction', 'OnCalendar', 'PathExists', 'PathExistsGlob', 'PathChanged',
  'PathModified', 'DirectoryNotEmpty', 'WantedBy', 'RequiredBy', 'Alias', 'Also', 'Sockets', 'CapabilityBoundingSet',
  'AmbientCapabilities', 'DeviceAllow', 'SecurityBindings',
]);

const ORDER_KEYS = new Set(['After', 'Before']);
const REQUIREMENT_KEYS = new Set(['Requires', 'Requisite', 'Wants', 'BindsTo', 'PartOf', 'Upholds', 'Conflicts']);
const EVENT_KEYS = new Set(['OnFailure', 'OnSuccess']);
const INSTALL_KEYS = new Set(['WantedBy', 'RequiredBy']);

/** Sections each unit type may contain; anything else is "Unknown section" to systemd. */
const ALLOWED_SECTIONS: Record<string, string[]> = {
  service: ['Unit', 'Service', 'Install'], socket: ['Unit', 'Socket', 'Install'], timer: ['Unit', 'Timer', 'Install'],
  path: ['Unit', 'Path', 'Install'], mount: ['Unit', 'Mount', 'Install'], automount: ['Unit', 'Automount', 'Install'],
  swap: ['Unit', 'Swap', 'Install'], target: ['Unit', 'Install'], slice: ['Unit', 'Slice', 'Install'],
  scope: ['Unit', 'Scope'], device: ['Unit'],
};

const WELL_KNOWN =
  /^(multi-user|graphical|basic|sysinit|rescue|emergency|default|shutdown|reboot|halt|poweroff|network|network-online|network-pre|local-fs|local-fs-pre|remote-fs|remote-fs-pre|swap|sockets|timers|paths|slices|getty|systemd-fsck|systemd-journald|systemd-logind|systemd-udevd|dbus|systemd-tmpfiles-setup)\.(target|service|socket|slice|device)$|^-.slice$|^systemd-[a-z0-9@.-]+\.(service|socket|target|slice)$/u;

/** The section that tells a pasted unit file what kind of unit it is, in source order. */
const TYPE_SECTIONS: Record<string, string> = {
  Service: 'service', Socket: 'socket', Timer: 'timer', Path: 'path', Mount: 'mount', Automount: 'automount',
  Swap: 'swap', Slice: 'slice', Scope: 'scope',
};

const UNIT_TYPES: Record<string, string> = {
  service: 'service', socket: 'socket', timer: 'timer', path: 'path', mount: 'mount', automount: 'automount',
  swap: 'swap', target: 'target', slice: 'slice', scope: 'scope', device: 'device',
};

interface Directive {
  line: number;
  endLine: number;
  section: string;
  key: string;
  value: string;
  continuous: boolean;
}

interface Finding {
  level: 'error' | 'warning' | 'note';
  problem: string;
  detail: string;
}

interface Parsed {
  directives: Directive[];
  sectionOrder: string[];
  sectionCounts: Map<string, number>;
  comments: number;
  blanks: number;
  noEquals: number[];
  outsideSection: { line: number; text: string }[];
  continuations: number;
  crlf: boolean;
  unknownSections: { name: string; line: number }[];
  sectionLines: Map<string, number[]>;
  duplicateKeys: { key: string; lines: number[] }[];
  unknownKeys: { key: string; line: number; section: string }[];
  splitAt: number;
}

const clip = (value: string, max = CLIP): string => {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

/** systemd's comment rule: only a whole line is a comment, # or ; after leading whitespace. */
const isComment = (line: string): boolean => /^\s*[#;]/u.test(line);

/** Trailing backslash continues the directive onto the next line; systemd joins with a space. */
const continues = (line: string): boolean => {
  const trimmed = line.replace(/\s+$/u, '');
  let backslashes = 0;
  for (let index = trimmed.length - 1; index >= 0 && trimmed[index] === '\\'; index -= 1) backslashes += 1;
  return backslashes % 2 === 1;
};

function parseUnit(text: string): Parsed {
  const parsed: Parsed = {
    directives: [], sectionOrder: [], sectionCounts: new Map(), comments: 0, blanks: 0, noEquals: [],
    outsideSection: [], continuations: 0, crlf: /\r\n/u.test(text), unknownSections: [], duplicateKeys: [],
    unknownKeys: [], sectionLines: new Map(), splitAt: 0,
  };
  const rawLines = text.split(/\r\n|\n|\r/u);
  parsed.splitAt = rawLines.length;
  const lines = rawLines.slice(0, MAX_LINES);
  let section = '';
  const seen = new Map<string, number[]>();

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const line = raw.trim();
    if (line === '') {
      parsed.blanks += 1;
      continue;
    }
    if (isComment(line)) {
      parsed.comments += 1;
      continue;
    }
    const header = /^\[([^\]]*)\]$/u.exec(line);
    if (header !== null) {
      const name = (header[1] ?? '').trim();
      if (!parsed.sectionOrder.includes(name)) parsed.sectionOrder.push(name);
      const headerLines = parsed.sectionLines.get(name);
      if (headerLines === undefined) parsed.sectionLines.set(name, [index + 1]);
      else headerLines.push(index + 1);
      parsed.sectionCounts.set(name, parsed.sectionCounts.get(name) ?? 0);
      if (!(name in KEYS) && name !== 'Exec' && !name.startsWith('X-')) {
        parsed.unknownSections.push({ name, line: index + 1 });
      }
      section = name;
      continue;
    }

    let value = line;
    const firstLine = index + 1;
    let endLine = firstLine;
    let continuous = false;
    while (continues(value) && index + 1 < lines.length) {
      value = value.replace(/\\\s*$/u, '') + ' ' + (lines[index + 1] ?? '').replace(/^\s+/u, '');
      index += 1;
      endLine = index + 1;
      continuous = true;
      parsed.continuations += 1;
    }

    const startLine = firstLine;
    // systemd decides on the section first: outside one, a line is an assignment even without '='.
    if (section === '') {
      parsed.outsideSection.push({ line: startLine, text: clip(value) });
      continue;
    }
    const equals = value.indexOf('=');
    if (equals < 0) {
      parsed.noEquals.push(startLine);
      continue;
    }
    const key = value.slice(0, equals).trim();
    const setting = value.slice(equals + 1).trim();
    const directive: Directive = { line: startLine, endLine, section, key, value: setting, continuous };
    parsed.directives.push(directive);

    parsed.sectionCounts.set(section, (parsed.sectionCounts.get(section) ?? 0) + 1);
    const list = seen.get(section + '\u0000' + key);
    if (list === undefined) seen.set(section + '\u0000' + key, [startLine]);
    else list.push(startLine);
    if (!knownIn(section, key)) {
      parsed.unknownKeys.push({ key, line: startLine, section });
    }
  }

  for (const [compound, lineList] of seen) {
    if (lineList.length > 1) {
      const key = compound.split('\u0000')[1] ?? compound;
      if (!REPEATABLE.has(key)) parsed.duplicateKeys.push({ key, lines: lineList });
    }
  }
  return parsed;
}

function knownIn(section: string, key: string): boolean {
  if (key.startsWith('X-')) return true;
  const list = KEYS[section];
  if (list === undefined) return true; // sections without a table are not checked
  return list.includes(key);
}

interface Tokenized {
  words: string[];
  error: string | null;
}

/** systemd splits Exec lines itself: whitespace separates, quotes group, backslash escapes. */
function tokenize(command: string): Tokenized {
  const words: string[] = [];
  let current = '';
  let active = false;
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index] ?? '';
    if (quote === '"') {
      if (character === '\\' && index + 1 < command.length) {
        const next = command[index + 1] ?? '';
        const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r', a: '\u0007', b: '\b', f: '\f', v: '\v', '\\': '\\', '"': '"', "'": "'", s: ' ' };
        if (next === 'x') {
          const hex = command.slice(index + 2, index + 4);
          if (/^[0-9a-fA-F]{2}$/u.test(hex)) {
            current += String.fromCharCode(Number.parseInt(hex, 16));
            index += 3;
            continue;
          }
        }
        current += escapes[next] ?? next;
        index += 1;
        continue;
      }
      if (character === '"') {
        quote = null;
        continue;
      }
      current += character;
      continue;
    }
    if (quote === "'") {
      if (character === "'") {
        quote = null;
        continue;
      }
      current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      active = true;
      continue;
    }
    if (character === '\\' && index + 1 < command.length) {
      current += command[index + 1] ?? '';
      index += 1;
      active = true;
      continue;
    }
    if (/\s/u.test(character)) {
      if (active || current !== '') {
        words.push(current);
        current = '';
        active = false;
      }
      continue;
    }
    current += character;
    active = true;
  }
  if (active || current !== '') words.push(current);
  return { words, error: quote === null ? null : 'a quote is never closed' };
}

/** Finds metacharacters a shell would act on but systemd passes through literally. */
function unquotedTraps(command: string): string[] {
  const found = new Set<string>();
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index] ?? '';
    if (quote !== null) {
      if (character === quote) quote = null;
      else if (quote === '"' && character === '\\') index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (';|&'.includes(character)) found.add('a shell operator (' + character + ')');
    else if (character === '<' || character === '>') found.add('shell redirection (' + character + ')');
    else if (character === '*' || character === '?') found.add('a glob character (' + character + ')');
    else if (character === '`') found.add('command substitution');
    else if (character === '$' && command[index + 1] === '(') found.add('command substitution');
    else if (character === '$' && /[A-Za-z_{]/u.test(command[index + 1] ?? '')) found.add('variable expansion');
  }
  return [...found];
}

interface HardeningRule {
  key: string;
  label: string;
  strong?: RegExp;
  partial?: RegExp;
  missing: string;
}

const HARDENING: HardeningRule[] = [
  { key: 'User', label: 'User=', strong: /^(?!root$).+/u, missing: 'the service runs as root, so every process it starts can do anything on the system' },
  { key: 'DynamicUser', label: 'DynamicUser=', strong: /^(yes|true|1)$/u, missing: 'no transient user is allocated for the service' },
  { key: 'NoNewPrivileges', label: 'NoNewPrivileges=', strong: /^(yes|true|1)$/u, missing: 'setuid binaries and file capabilities can still raise privileges' },
  { key: 'ProtectSystem', label: 'ProtectSystem=', strong: /^(strict|full)$/u, partial: /^(yes|true|1)$/u, missing: 'the whole filesystem stays writable' },
  { key: 'ProtectHome', label: 'ProtectHome=', strong: /^(yes|true|1|read-only|tmpfs)$/u, partial: /^(read-only|tmpfs)$/u, missing: 'home directories stay visible and writable' },
  { key: 'PrivateTmp', label: 'PrivateTmp=', strong: /^(yes|true|1)$/u, missing: 'the service shares /tmp and /var/tmp with everything else' },
  { key: 'PrivateDevices', label: 'PrivateDevices=', strong: /^(yes|true|1)$/u, missing: 'the service can reach raw devices such as disks and the kernel memory device' },
  { key: 'PrivateNetwork', label: 'PrivateNetwork=', strong: /^(yes|true|1)$/u, missing: 'the service keeps the host network stack' },
  { key: 'ProtectKernelTunables', label: 'ProtectKernelTunables=', strong: /^(yes|true|1)$/u, missing: 'kernel tunables under /proc and /sys stay writable' },
  { key: 'ProtectKernelModules', label: 'ProtectKernelModules=', strong: /^(yes|true|1)$/u, missing: 'the service could load kernel modules' },
  { key: 'ProtectControlGroups', label: 'ProtectControlGroups=', strong: /^(yes|true|1)$/u, missing: 'the cgroup tree stays writable' },
  { key: 'RestrictAddressFamilies', label: 'RestrictAddressFamilies=', strong: /./u, missing: 'every socket family is available' },
  { key: 'RestrictNamespaces', label: 'RestrictNamespaces=', strong: /^(yes|true|1|~)/u, missing: 'the service can create new namespaces' },
  { key: 'MemoryDenyWriteExecute', label: 'MemoryDenyWriteExecute=', strong: /^(yes|true|1)$/u, missing: 'memory can be written and executed at the same time, which helps exploit code' },
  { key: 'SystemCallFilter', label: 'SystemCallFilter=', strong: /./u, missing: 'the full system call table is reachable' },
  { key: 'SystemCallArchitectures', label: 'SystemCallArchitectures=', strong: /./u, missing: 'system calls from every architecture are accepted' },
  { key: 'CapabilityBoundingSet', label: 'CapabilityBoundingSet=', strong: /.*/u, missing: 'the service keeps the default capability set' },
];

const typeOf = (name: string): string => {
  const suffix = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return UNIT_TYPES[suffix] ?? '';
};

function collectFindings(parsed: Parsed, unitType: string, name: string, harden: boolean, source: string): Finding[] {
  const findings: Finding[] = [];
  const push = (level: Finding['level'], problem: string, detail: string): void => {
    if (findings.length < MAX_FINDINGS) findings.push({ level, problem, detail });
  };
  const directives = parsed.directives;
  const last = (key: string): Directive | undefined => [...directives].reverse().find((directive) => directive.key === key);
  const values = (key: string): string[] => directives.filter((directive) => directive.key === key && directive.section === 'Service').map((directive) => directive.value);
  /** An empty assignment resets the list, so later lines are the only commands systemd keeps. */
  const effective = (key: string): string[] => {
    const kept: string[] = [];
    for (const directive of directives) {
      if (directive.section !== 'Service' || directive.key !== key) continue;
      if (directive.value === '') kept.length = 0;
      else kept.push(directive.value);
    }
    return kept;
  };
  const setting = (key: string): string => last(key)?.value ?? '';

  for (const line of parsed.noEquals) {
    push(
      'warning',
      'A line has no equals sign',
      'Line ' + line + ' is neither a section header nor a Key=Value pair. systemd reports "Missing \'=\', ignoring line."',
    );
  }
  for (const entry of parsed.outsideSection) {
    push(
      'warning',
      'A directive sits outside any section',
      'Line ' + entry.line + ' reads "' + entry.text + '" before the first [Section]. systemd reports "Assignment outside of section. Ignoring."',
    );
  }
  for (const entry of parsed.unknownKeys) {
    push(
      'note',
      'Unknown key in [' + entry.section + ']: ' + entry.key,
      'Line ' + entry.line + '. systemd would report "Unknown key \'' + entry.key + '\' in section [' + entry.section + '], ignoring." Check the spelling or put it in the right section; newer systemd versions also add keys this list may not know yet.',
    );
  }
  for (const entry of parsed.unknownSections) {
    push('note', 'Unknown section [' + entry.name + ']', 'Line ' + entry.line + '. systemd reports "Unknown section \'' + entry.name + '\'. Ignoring." so everything inside it has no effect.');
  }
  if (name !== '') {
    for (const directive of directives) {
      if (!ORDER_KEYS.has(directive.key)) continue;
      if (directive.value.split(/\s+/u).includes(name)) {
        push(
          'note',
          'A dependency on itself in ' + directive.key + '=' + name,
          'Line ' + directive.line + '. A unit cannot be ordered relative to itself, so systemd drops the entry and reports "Dependency ' + directive.key + '=' + name + ' is dropped."',
        );
      }
    }
  }
  const allowed = ALLOWED_SECTIONS[unitType];
  if (allowed !== undefined) {
    for (const section of parsed.sectionOrder) {
      if (allowed.includes(section) || !(section in KEYS)) continue;
      const at = parsed.sectionLines.get(section)?.[0];
      push(
        'note',
        'Unknown section [' + section + ']',
        (at === undefined ? '' : 'Line ' + at + '. ') + 'A ' + unitType + ' unit cannot contain [' + section + '], so systemd reports "Unknown section \'' + section + '\'. Ignoring." and every directive inside it has no effect.',
      );
    }
  }
  for (const entry of parsed.duplicateKeys) {
    push(
      'warning',
      'Repeated key: ' + entry.key,
      'Lines ' + entry.lines.join(', ') + '. ' + entry.key + ' holds a single value, so only one assignment survives. systemd does not warn about this, which is exactly why it is easy to miss.',
    );
  }

  const isService = unitType === 'service' || (unitType === '' && parsed.sectionOrder.includes('Service'));
  if (isService) {
    const startLines = effective('ExecStart');
    const type = (setting('Type') || 'simple').toLowerCase();
    const runs = startLines.length + effective('ExecStop').length + effective('SuccessAction').length;
    if (runs === 0) {
      push(
        'error',
        'A service has nothing to run',
        'There is no non-empty ExecStart=, ExecStop= or SuccessAction=. systemd refuses the unit with "Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing." An empty assignment such as ExecStart= resets the list of commands.',
      );
    }
    if (startLines.length > 1 && type !== 'oneshot') {
      push(
        'error',
        'More than one ExecStart on a non-oneshot service',
        startLines.length + ' ExecStart= lines were found while Type=' + type + '. systemd refuses the unit: more than one command is only allowed when Type=oneshot.',
      );
    }
    if (type === 'oneshot' && /^(always|on-success)$/u.test(setting('Restart'))) {
      push(
        'error',
        'Restart=' + setting('Restart') + ' on a oneshot service',
        'systemd refuses the unit: Restart= may not be always or on-success for Type=oneshot. Use Type=simple, or Restart=on-failure.',
      );
    }
    if (type === 'simple' && values('ExecStart').some((value) => /(^|\s)-([fdb]|background)(\s|$)/u.test(value))) {
      push('warning', 'Type=simple with a self-backgrounding command', 'The command line asks the process to fork into the background while Type=simple tells systemd to follow the process it started. Use Type=forking (with PIDFile=) or drop the flag.');
    }
    for (const directive of directives.filter((entry) => entry.key.startsWith('Exec'))) {
      const tokens = tokenize(directive.value);
      if (tokens.error !== null) {
        push(
          'error',
          'A command line has an unclosed quote',
          'Line ' + directive.line + ' (' + directive.key + '): ' + tokens.error + '. systemd cannot split the command into arguments, and it refuses the whole unit with "Unbalanced quoting, ignoring" followed by "Unit configuration has fatal error, unit will not be started."',
        );
        continue;
      }
      const traps = unquotedTraps(directive.value);
      if (traps.length > 0) {
        push(
          'note',
          'Shell syntax in ' + directive.key + ' is not interpreted',
          'Line ' + directive.line + ' contains ' + traps.join(', ') + '. systemd runs no shell, so these characters reach the program literally instead of being expanded or chained. Wrap the command in sh -c if you need them.',
        );
      }
      if (directive.value === '' && directive.key === 'ExecStart') {
        push('note', 'ExecStart= is empty', 'Line ' + directive.line + ' resets the list of commands instead of running nothing.');
      }
    }
  }

  if (parsed.sectionOrder.includes('Install')) {
    const targets = directives.filter((directive) => directive.section === 'Install' && INSTALL_KEYS.has(directive.key));
    if (targets.length === 0) {
      push('note', '[Install] has no target', 'Without WantedBy= or RequiredBy= the unit cannot be enabled with systemctl enable.');
    }
  } else {
    push('note', 'There is no [Install] section', 'The unit cannot be enabled with systemctl enable; it can only be started manually or pulled in by another unit.');
  }
  if (setting('Description') === '' && parsed.directives.some((directive) => directive.section === 'Unit')) {
    push('note', 'No Description=', 'The unit is listed by name alone in systemctl output.');
  }
  if (parsed.continuations > 0) {
    push('note', parsed.continuations + ' line continuation(s)', 'A trailing backslash joins the directive to the next line, and systemd replaces the break with a single space.');
  }
  if (parsed.crlf) {
    push('note', 'The file uses CRLF line endings', 'systemd accepts them, but a carriage return inside a quoted value becomes part of the value.');
  }
  const instance = /^([^@]+)@/.test(name);
  if (!instance && /%[iI]/u.test(source)) {
    push('note', '%i is used outside a template unit', 'Instance specifiers only resolve for units whose name contains @, such as ' + (name === '' ? 'my-app@.service' : name.replace(/\.service$/u, '@.service')) + '.');
  }
  if (harden) {
    const service = unitType === 'service' || (unitType === '' && parsed.sectionOrder.includes('Service'));
    if (service) {
      const user = setting('User');
      const dynamic = /^(yes|true|1)$/u.test(setting('DynamicUser'));
      if (!dynamic && (user === '' || user === 'root')) {
        push('note', 'The service runs as root', 'Neither User= nor DynamicUser= moves it to an unprivileged account.');
      }
      const gaps = ['NoNewPrivileges', 'ProtectSystem', 'PrivateTmp'].filter((key) => setting(key) === '');
      if (gaps.length === 3) {
        push(
          'note',
          'No filesystem or privilege hardening at all',
          'None of NoNewPrivileges=, ProtectSystem= or PrivateTmp= is set. These three are the cheapest lines to add to almost any service.',
        );
      }
      if (setting('Restart') === '' && typeOf(name) === 'service' && (setting('Type') || 'simple').toLowerCase() !== 'oneshot') {
        push('note', 'Restart= is not set', 'A crash leaves the unit inactive; Restart=on-failure is the usual choice for a long-running service.');
      }
    }
  }
  return findings;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const harden = options.harden !== false;
  const provided = String(options.name ?? '').trim();

  const text = String(input.text ?? '');
  if (text.trim() === '') throw new ToolError('No unit file was provided.', 'Paste a unit file or drop one from /etc/systemd/system.');
  if (text.length > MAX_LENGTH) throw new ToolError('That is more than 2 MB of unit file text.');
  if (!text.includes('=') && !text.includes('[')) {
    throw new ToolError('That does not look like a systemd unit file.', 'A unit file contains [Section] headers and Key=Value directives.');
  }

  const name = provided;

  const parsed = parseUnit(text);
  const fromSections = parsed.sectionOrder.map((section) => TYPE_SECTIONS[section]).find((type) => type !== undefined) ?? '';
  const unitType = typeOf(name) || fromSections;
  const findings = collectFindings(parsed, unitType, name, harden, text);
  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  const notes = findings.filter((finding) => finding.level === 'note').length;
  const setting = (key: string): string => [...parsed.directives].reverse().find((directive) => directive.key === key)?.value ?? '';

  const notesOut: string[] = [];
  const warningsOut: string[] = [];
  if (parsed.splitAt > MAX_LINES) notesOut.push('Only the first ' + MAX_LINES + ' lines were read.');
  if (errors > 0) warningsOut.push(errors + ' problem(s) would stop systemd from loading this unit.');
  if (errors === 0 && warnings > 0) notesOut.push('Nothing here stops systemd from loading the unit, but it would ignore part of it.');

  const stats: Record<string, string | number> = {
    lines: parsed.splitAt,
    directives: parsed.directives.length,
    sections: parsed.sectionOrder.length,
    errors,
    warnings,
    notes,
    dependencies: parsed.directives.filter((directive) => ORDER_KEYS.has(directive.key) || REQUIREMENT_KEYS.has(directive.key) || EVENT_KEYS.has(directive.key) || INSTALL_KEYS.has(directive.key)).length,
    continuations: parsed.continuations,
  };

  if (format === 'directives') {
    const rows = parsed.directives.slice(0, MAX_ROWS).map((directive) => {
      const isExec = directive.key.startsWith('Exec') && directive.value !== '';
      const tokens = isExec ? tokenize(directive.value) : null;
      let note = directive.continuous ? 'continues to line ' + directive.endLine : '';
      if (tokens !== null && tokens.error === null) {
        note = (note === '' ? '' : note + '; ') + tokens.words.length + ' argument' + (tokens.words.length === 1 ? '' : 's') + ': ' + clip(tokens.words.join(' '), 80);
      } else if (tokens !== null && tokens.error !== null) {
        note = (note === '' ? '' : note + '; ') + 'unclosed quote';
      }
      return [String(directive.line), directive.section, directive.key, clip(directive.value), note];
    });
    if (parsed.directives.length > rows.length) notesOut.push('Only the first ' + MAX_ROWS + ' directives are listed.');
    if (rows.length === 0) {
      return {
        output: JSON.stringify({ headers: ['Line', 'Section', 'Key', 'Value', 'Notes'], rows: [['-', '-', '(none)', 'No directives were found.', '-']] }), render: 'table', notes: notesOut.length > 0 ? notesOut : undefined, warnings: warningsOut.length > 0 ? warningsOut : undefined, stats,
      };
    }
    return {
      output: JSON.stringify({ headers: ['Line', 'Section', 'Key', 'Value', 'Notes'], rows }), render: 'table', notes: notesOut.length > 0 ? notesOut : undefined, warnings: warningsOut.length > 0 ? warningsOut : undefined, stats,
    };
  }

  if (format === 'dependencies') {
    const rows: string[][] = [];
    for (const directive of parsed.directives) {
      const kind = ORDER_KEYS.has(directive.key)
        ? (directive.key === 'After' ? 'Ordering: start after' : 'Ordering: start before')
        : REQUIREMENT_KEYS.has(directive.key)
          ? (directive.key === 'Wants' ? 'Weak requirement' : 'Requirement: ' + directive.key)
          : EVENT_KEYS.has(directive.key)
            ? 'Trigger on ' + (directive.key === 'OnFailure' ? 'failure' : 'success')
            : INSTALL_KEYS.has(directive.key)
              ? 'Install target (' + directive.key + ')'
              : directive.key === 'JoinsNamespaceOf'
                ? 'Shared namespace'
                : directive.key === 'PropagatesReloadTo' || directive.key === 'ReloadPropagatedFrom'
                  ? 'Reload propagation'
                  : null;
      if (kind === null) continue;
      for (const target of directive.value.split(/\s+/u).filter((part) => part !== '')) {
        const note = target === name && name !== ''
          ? 'this unit itself'
          : WELL_KNOWN.test(target)
            ? 'provided by systemd'
            : 'not defined in this file, so it cannot be resolved here';
        rows.push([kind, target, 'line ' + directive.line, note]);
      }
    }
    if (rows.length === 0) {
      rows.push(['(none)', '-', '-', 'This unit declares no ordering, requirement or install relationships.']);
    }
    return {
      output: JSON.stringify({ headers: ['Kind', 'Unit', 'Where', 'Note'], rows }), render: 'table', notes: notesOut.length > 0 ? notesOut : undefined, warnings: warningsOut.length > 0 ? warningsOut : undefined, stats,
    };
  }

  if (format === 'hardening') {
    const rows = HARDENING.map((rule) => {
      const directive = [...parsed.directives].reverse().find((entry) => entry.key === rule.key);
      const value = directive?.value ?? '';
      let assessment: string;
      if (directive === undefined) {
        assessment = 'missing — ' + rule.missing;
      } else if (rule.strong !== undefined && rule.strong.test(value)) {
        assessment = 'strong — ' + rule.label + value;
      } else if (rule.partial !== undefined && rule.partial.test(value)) {
        assessment = 'partial — ' + value + ' covers less than the strict setting';
      } else {
        assessment = 'weak — set to "' + value + '", which does not restrict much';
      }
      return [rule.key, directive === undefined ? '(not set)' : clip(value), assessment];
    });
    const strong = rows.filter((row) => (row[2] ?? '').startsWith('strong')).length;
    notesOut.push(strong + ' of ' + rows.length + ' hardening directives are set to their strong value.');
    return {
      output: JSON.stringify({ headers: ['Directive', 'Setting', 'Assessment'], rows }), render: 'table', notes: notesOut.length > 0 ? notesOut : undefined, warnings: warningsOut.length > 0 ? warningsOut : undefined, stats,
    };
  }

  if (format === 'findings') {
    return {
      output: JSON.stringify({
        headers: ['Level', 'Problem', 'Detail'],
        rows: findings.length === 0
          ? [['ok', 'Nothing to flag', 'The unit parses cleanly and has no findings.']]
          : findings.map((finding) => [finding.level, finding.problem, finding.detail]),
      }),
      render: 'table',
      notes: notesOut.length > 0 ? notesOut : undefined,
      warnings: warningsOut.length > 0 ? warningsOut : undefined,
      stats,
    };
  }

  const summaryRows: string[][] = [
    ['Unit name', name === '' ? '(unknown — pasted text)' : name],
    ['Unit type', unitType === '' ? '(not determined from the name)' : unitType],
    ['Lines', String(parsed.splitAt)],
    ['Directives', String(parsed.directives.length)],
    ['Sections', parsed.sectionOrder.length === 0 ? '(none)' : parsed.sectionOrder.map((section) => '[' + section + '] × ' + (parsed.sectionCounts.get(section) ?? 0)).join(', ')],
    ['Comments', String(parsed.comments)],
    ['Blank lines', String(parsed.blanks)],
    ['Line continuations', String(parsed.continuations)],
    ['Description', setting('Description') === '' ? '(none)' : clip(setting('Description'))],
    ['Type', setting('Type') === '' ? '(default: simple)' : setting('Type')],
    ['ExecStart', parsed.directives.filter((directive) => directive.key === 'ExecStart' && directive.value !== '').length === 0 ? '(none)' : clip(setting('ExecStart'))],
    ['User', setting('User') === '' ? (setting('DynamicUser') === 'yes' ? '(dynamic user)' : '(not set — runs as root)') : setting('User')],
    ['Restart', setting('Restart') === '' ? '(not set)' : setting('Restart')],
    ['Install targets', parsed.directives.filter((directive) => directive.section === 'Install').map((directive) => directive.key + '=' + directive.value).join(', ') || '(none)'],
    ['Ordering dependencies', parsed.directives.filter((directive) => ORDER_KEYS.has(directive.key)).map((directive) => directive.key + '=' + directive.value).join(', ') || '(none)'],
    ['Requirements', parsed.directives.filter((directive) => REQUIREMENT_KEYS.has(directive.key)).map((directive) => directive.key + '=' + directive.value).join(', ') || '(none)'],
    ['Findings', errors + ' error, ' + warnings + ' warning, ' + notes + ' note'],
  ];

  return {
    output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }), render: 'table', notes: notesOut.length > 0 ? notesOut : undefined, warnings: warningsOut.length > 0 ? warningsOut : undefined, stats,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
