import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './access-log-analyzer.meta';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_LINES = 200_000;
const MAX_FINDINGS = 300;
const MAX_ERROR_ROWS = 200;
const CLIP = 90;

/** Combined Log Format, with the referrer and user-agent fields optional and any tail ignored. */
const LINE_PATTERN =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3}|-)\s+(\d+|-)(?:\s+"([^"]*)"\s+"([^"]*)")?(?:\s+.*)?$/u;
const TIME_PATTERN = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-])(\d{2})(\d{2})$/u;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const REASON: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols',
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content',
  301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 304: 'Not Modified',
  307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  405: 'Method Not Allowed', 406: 'Not Acceptable', 408: 'Request Timeout',
  409: 'Conflict', 410: 'Gone', 413: 'Payload Too Large', 414: 'URI Too Long',
  415: 'Unsupported Media Type', 418: "I'm a teapot", 422: 'Unprocessable Content',
  429: 'Too Many Requests', 431: 'Request Header Fields Too Large',
  499: 'Client Closed Request',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
  503: 'Service Unavailable', 504: 'Gateway Timeout', 507: 'Insufficient Storage',
};

const CRAWLER_PATTERN =
  /(googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|crawler|crawl|spider|robot|semrush|ahrefs|mj12bot|petalbot|bytespider|applebot|facebookexternalhit|twitterbot|whatsapp|telegrambot|discordbot|linkedinbot|uptimerobot|pingdom)/iu;
const CLIENT_PATTERN = /(curl|wget|python-requests|python-urllib|go-http-client|libwww|httpclient|okhttp|java\/|scrapy|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|node-fetch|axios|postmanruntime)/iu;
const BROWSER_PATTERN = /(mozilla|firefox|chrome|chromium|safari|edg\/|edge|opera|msie|trident)/iu;

const PROBE_PATHS = [
  '/.env', '/.git', '/.svn', '/.aws', '/.ssh', '/.ds_store', '/wp-login', '/wp-admin',
  '/wp-content', '/xmlrpc.php', '/phpmyadmin', '/pma/', '/admin', '/administrator',
  '/config.php', '/configuration.php', '/db.php', '/backup', '/vendor/phpunit',
  '/cgi-bin', '/shell', '/hnap1', '/server-status', '/actuator', '/phpinfo',
  '/.well-known/security.txt.bak', '/sftp-config.json', '/docker-compose.yml',
];

interface Entry {
  ip: string;
  time: number;
  method: string;
  target: string;
  path: string;
  protocol: string;
  status: number;
  bytes: number;
  knownSize: boolean;
  referrer: string;
  agent: string;
}

interface Bucket {
  hits: number;
  bytes: number;
}

interface Finding {
  level: 'error' | 'warning' | 'note';
  problem: string;
  detail: string;
}

interface Result {
  totalLines: number;
  parsed: number;
  skipped: number;
  blank: number;
  unknownSize: number;
  firstBad: string | null;
  truncated: boolean;
  ips: Map<string, Bucket>;
  paths: Map<string, Bucket>;
  agents: Map<string, Bucket>;
  referrers: Map<string, Bucket>;
  statuses: Map<number, Bucket>;
  methods: Map<string, Bucket>;
  protocols: Map<string, Bucket>;
  errorPaths: Map<string, Bucket & { status: number; method: string; last: number }>;
  probes: Map<string, Bucket & { ips: Set<string> }>;
  notFoundByIp: Map<string, number>;
  bytesTotal: number;
  errorCount: number;
  bots: number;
  clients: number;
  browsers: number;
  noAgent: number;
  emptyOk: number;
  largest: Entry | null;
  first: number;
  last: number;
}

const bump = (map: Map<string, Bucket>, key: string, bytes: number): void => {
  const bucket = map.get(key);
  if (bucket === undefined) map.set(key, { hits: 1, bytes });
  else {
    bucket.hits += 1;
    bucket.bytes += bytes;
  }
};

const separator = (value: number): string => value.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ',');

const humanBytes = (value: number): string => {
  if (value < 1000) return value + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1000;
  let unit = 0;
  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }
  return (size >= 100 ? size.toFixed(0) : size.toFixed(1)) + ' ' + units[unit];
};

const clip = (value: string, max = CLIP): string => (value.length > max ? value.slice(0, max - 1) + '…' : value);

const share = (count: number, total: number): string => (total === 0 ? '0.0%' : ((count / total) * 100).toFixed(1) + '%');

const agentKind = (agent: string): 'bot' | 'client' | 'browser' | 'none' => {
  if (agent === '' || agent === '-') return 'none';
  if (CRAWLER_PATTERN.test(agent)) return 'bot';
  if (CLIENT_PATTERN.test(agent)) return 'client';
  if (BROWSER_PATTERN.test(agent)) return 'browser';
  return 'none';
};

const parseTime = (raw: string): number => {
  const match = TIME_PATTERN.exec(raw);
  if (match === null) return Number.NaN;
  const [, day, monthName, year, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  const month = MONTHS[(monthName ?? '').toLowerCase()];
  if (month === undefined) return Number.NaN;
  const utc = Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute), Number(second));
  const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * 60_000;
  return sign === '-' ? utc + offset : utc - offset;
};

const blankResult = (): Result => ({
  totalLines: 0, parsed: 0, skipped: 0, blank: 0, unknownSize: 0, firstBad: null, truncated: false,
  ips: new Map(), paths: new Map(), agents: new Map(), referrers: new Map(),
  statuses: new Map(), methods: new Map(), protocols: new Map(), errorPaths: new Map(), probes: new Map(),
  notFoundByIp: new Map(), bytesTotal: 0, errorCount: 0, bots: 0, clients: 0, browsers: 0, noAgent: 0,
  emptyOk: 0, largest: null, first: Number.NaN, last: Number.NaN,
});

function parseLog(text: string): Result {
  const result = blankResult();
  const rawLines = text.split(/\r\n|\n|\r/u);
  if (rawLines.length > MAX_LINES) result.truncated = true;
  const lines = rawLines.slice(0, MAX_LINES);
  result.totalLines = lines.length;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      result.blank += 1;
      continue;
    }
    const match = LINE_PATTERN.exec(line);
    if (match === null) {
      result.skipped += 1;
      if (result.firstBad === null) result.firstBad = clip(line);
      continue;
    }
    const [, ip, , , timeRaw, request, statusRaw, sizeRaw, referrer, agent] = match;
    const parts = (request ?? '').split(' ');
    const method = parts[0] === undefined || parts[0] === '-' ? '-' : parts[0];
    const target = parts[1] ?? '-';
    const protocol = parts[2] ?? '-';
    const knownSize = sizeRaw !== '-';
    const bytes = knownSize ? Number(sizeRaw) : 0;
    const time = parseTime(timeRaw ?? '');

    result.parsed += 1;
    if (!knownSize) result.unknownSize += 1;
    result.bytesTotal += bytes;
    if (!Number.isNaN(time)) {
      if (Number.isNaN(result.first) || time < result.first) result.first = time;
      if (Number.isNaN(result.last) || time > result.last) result.last = time;
    }

    const entry: Entry = {
      ip: ip ?? '-',
      time,
      method,
      target,
      path: target.split('?')[0] ?? target,
      protocol,
      status: statusRaw === '-' ? 0 : Number(statusRaw),
      bytes,
      knownSize,
      referrer: referrer === undefined || referrer === '-' ? '' : referrer,
      agent: agent === undefined ? '' : agent,
    };

    bump(result.ips, entry.ip, bytes);
    bump(result.paths, entry.path, bytes);
    bump(result.agents, entry.agent === '' ? '(none)' : entry.agent, bytes);
    bump(result.referrers, entry.referrer === '' ? '(direct)' : entry.referrer, bytes);
    bump(result.methods, entry.method, bytes);
    bump(result.protocols, entry.protocol, bytes);
    const statusBucket = result.statuses.get(entry.status);
    if (statusBucket === undefined) result.statuses.set(entry.status, { hits: 1, bytes });
    else {
      statusBucket.hits += 1;
      statusBucket.bytes += bytes;
    }

    const kind = agentKind(entry.agent);
    if (kind === 'bot') result.bots += 1;
    else if (kind === 'client') result.clients += 1;
    else if (kind === 'browser') result.browsers += 1;
    if (entry.agent === '' || entry.agent === '-') result.noAgent += 1;
    if (entry.status >= 400) result.errorCount += 1;
    if (entry.status === 404) result.notFoundByIp.set(entry.ip, (result.notFoundByIp.get(entry.ip) ?? 0) + 1);
    if (entry.status === 200 && entry.knownSize && bytes === 0) result.emptyOk += 1;
    if (result.largest === null || bytes > result.largest.bytes) result.largest = entry;

    const lower = entry.path.toLowerCase();
    for (const probe of PROBE_PATHS) {
      // Matches /wp-login.php and /.env.local, not /administrative-report.
      if (lower === probe || lower.startsWith(probe + '/') || lower.startsWith(probe + '.') || lower.startsWith(probe + '?')) {
        const bucket = result.probes.get(probe);
        if (bucket === undefined) result.probes.set(probe, { hits: 1, bytes, ips: new Set([entry.ip]) });
        else {
          bucket.hits += 1;
          bucket.bytes += bytes;
          bucket.ips.add(entry.ip);
        }
        break;
      }
    }

    if (entry.status >= 400) {
      const key = entry.status + ' ' + entry.method + ' ' + entry.path;
      const bucket = result.errorPaths.get(key);
      if (bucket === undefined) {
        result.errorPaths.set(key, { hits: 1, bytes, status: entry.status, method: entry.method, last: entry.time });
      } else {
        bucket.hits += 1;
        bucket.bytes += bytes;
        if (!Number.isNaN(entry.time) && (Number.isNaN(bucket.last) || entry.time > bucket.last)) bucket.last = entry.time;
      }
    }
  }

  return result;
}

const topEntries = <T extends Bucket>(map: Map<string, T>, limit: number): { key: string; bucket: T }[] =>
  [...map.entries()]
    .map(([key, bucket]) => ({ key, bucket }))
    .sort((a, b) => b.bucket.hits - a.bucket.hits || b.bucket.bytes - a.bucket.bytes || (a.key < b.key ? -1 : 1))
    .slice(0, limit);

function collectFindings(result: Result, security: boolean): Finding[] {
  const findings: Finding[] = [];
  const push = (level: Finding['level'], problem: string, detail: string): void => {
    if (findings.length < MAX_FINDINGS) findings.push({ level, problem, detail });
  };
  const requests = result.parsed;

  if (result.skipped > 0) {
    push(
      'warning',
      result.skipped + ' line(s) could not be parsed',
      'They are neither Common nor Combined Log Format. First example: ' + (result.firstBad ?? ''),
    );
  }
  if (result.truncated) {
    push('note', 'Only part of the log was read', 'The file was capped at ' + separator(MAX_LINES) + ' lines.');
  }
  if (result.blank > 0) push('note', result.blank + ' blank line(s)', 'Empty lines were skipped.');

  if (requests > 0) {
    const rate = result.errorCount / requests;
    if (rate >= 0.5) {
      push('error', 'More than half of all requests failed', result.errorCount + ' of ' + requests + ' responses were 4xx or 5xx (' + share(result.errorCount, requests) + ').');
    } else if (rate >= 0.1) {
      push('warning', 'A notable share of requests failed', result.errorCount + ' of ' + requests + ' responses were 4xx or 5xx (' + share(result.errorCount, requests) + ').');
    }
  }

  if (security) {
    for (const { key, bucket } of topEntries(result.probes, 8)) {
      push(
        'warning',
        'Sensitive path requested: ' + key,
        bucket.hits + ' request(s) from ' + bucket.ips.size + ' address(es): ' + [...bucket.ips].slice(0, 3).join(', '),
      );
    }
    const scanners = [...result.notFoundByIp.entries()]
      .filter(([ip, count]) => count >= 5 && count / Math.max(1, result.ips.get(ip)?.hits ?? count) >= 0.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [ip, count] of scanners) {
      push('warning', 'An address is collecting 404s: ' + ip, count + ' of its ' + (result.ips.get(ip)?.hits ?? count) + ' request(s) returned 404, which is the shape of a scanner.');
    }
  }

  if (requests > 0 && result.bots / requests >= 0.2) {
    push('note', 'Bots make up ' + share(result.bots, requests) + ' of requests', result.bots + ' request(s) came from crawler user agents.');
  }
  if (result.clients > 0) {
    push('note', result.clients + ' request(s) came from command-line or library clients', 'These are not browsers; check whether they are your own monitors or scripts.');
  }
  if (result.noAgent > 0) {
    push('note', result.noAgent + ' request(s) had no user agent', 'An empty user agent is common for health checks and for scripts that hide.');
  }
  if (result.unknownSize > 0) {
    push('note', result.unknownSize + ' response(s) had no size recorded', 'A dash in the size column means the server never logged a byte count.');
  }
  if (result.emptyOk > 0) {
    push('note', result.emptyOk + ' successful response(s) sent zero bytes', 'A 200 with no body is normal for redirects and health checks, but check the paths if you expected content.');
  }
  const total = [...result.protocols.values()].reduce((sum, bucket) => sum + bucket.hits, 0);
  const old = result.protocols.get('HTTP/1.0')?.hits ?? 0;
  if (total > 0 && old / total >= 0.2) {
    push('note', 'HTTP/1.0 is still in use', old + ' of ' + total + ' request(s) used HTTP/1.0, which usually means a proxy or an old client.');
  }
  if (result.largest !== null && result.largest.bytes >= 1_000_000) {
    push('note', 'A single response is over 1 MB', result.largest.bytes + ' bytes for ' + result.largest.method + ' ' + result.largest.path + ' (compression or a CDN would help).');
  }
  return findings;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const top = Math.max(3, Math.min(50, Math.floor(Number(options.top ?? 10)) || 10));
  const security = options.security !== false;

  let text: string;
  let sourceLabel: string;
  const file = input.files[0];
  if (file !== undefined) {
    if (file.size === 0) throw new ToolError('That file is empty.');
    if (file.size > MAX_BYTES) throw new ToolError('That file is larger than 16 MB.', 'Split the log and analyze the parts, or filter it down first.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    text = new TextDecoder('utf-8').decode(bytes);
    sourceLabel = file.name === '' ? 'uploaded file' : file.name;
  } else {
    text = String(input.text ?? '');
    if (text.trim() === '') throw new ToolError('No log lines were provided.', 'Drop an access log file or paste some lines from one.');
    if (text.length > MAX_BYTES) throw new ToolError('That is more than 16 MB of text.');
    sourceLabel = 'pasted text';
  }

  const result = parseLog(text);
  if (result.parsed === 0) {
    throw new ToolError(
      'No access log lines could be read.',
      result.skipped > 0
        ? 'The first unreadable line reads: ' + (result.firstBad ?? '')
        : 'The input was empty after trimming.',
    );
  }

  const findings = collectFindings(result, security);
  const requests = result.parsed;
  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  const notes = findings.filter((finding) => finding.level === 'note').length;

  const classCount = (low: number, high: number): number =>
    [...result.statuses.entries()].reduce((sum, [status, bucket]) => (status >= low && status <= high ? sum + bucket.hits : sum), 0);
  const statusRow = (label: string, count: number): string[] => [label, separator(count) + ' (' + share(count, requests) + ')'];

  const span =
    Number.isNaN(result.first) || Number.isNaN(result.last)
      ? ['first request', 'last request'].map((item) => [item, 'no parseable timestamp'])
      : [
          ['First request', new Date(result.first).toISOString()],
          ['Last request', new Date(result.last).toISOString()],
          ['Span', ((result.last - result.first) / 1000).toFixed(0) + ' s'],
        ];

  const notesOut: string[] = [];
  const warningsOut: string[] = [];
  if (result.truncated) notesOut.push('Only the first ' + separator(MAX_LINES) + ' lines were read.');
  if (result.skipped > 0) warningsOut.push(result.skipped + ' line(s) could not be parsed.');
  if (errors > 0) warningsOut.push(errors + ' finding(s) are serious.');

  const stats: Record<string, string | number> = {
    lines: result.totalLines,
    parsed: result.parsed,
    skipped: result.skipped,
    requests: result.parsed,
    totalBytes: result.bytesTotal,
    uniqueIps: result.ips.size,
    uniquePaths: result.paths.size,
    errorCount: result.errorCount,
    errorRate: Number(((result.errorCount / requests) * 100).toFixed(2)),
    bots: result.bots,
    clients: result.clients,
    browsers: result.browsers,
    probes: result.probes.size,
    findings: findings.length,
  };

  if (format === 'top') {
    const groups: { group: string; rows: { key: string; bucket: Bucket }[] }[] = [
      { group: 'Address', rows: topEntries(result.ips, top) },
      { group: 'Path', rows: topEntries(result.paths, top) },
      { group: 'User agent', rows: topEntries(result.agents, top) },
      { group: 'Referrer', rows: topEntries(result.referrers, top) },
    ];
    const rows: string[][] = [];
    for (const { group, rows: entries } of groups) {
      entries.forEach((entry, index) => {
        rows.push([
          group,
          String(index + 1),
          clip(entry.key),
          separator(entry.bucket.hits),
          entry.bucket.bytes === 0 ? '0 B' : humanBytes(entry.bucket.bytes),
          share(entry.bucket.hits, requests),
        ]);
      });
    }
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['Group', 'Rank', 'Value', 'Requests', 'Bytes', 'Share'], rows }),
        render: 'table',
      },
      notes: notesOut,
      warnings: warningsOut,
      stats,
    };
  }

  if (format === 'status') {
    const rows = [...result.statuses.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([status, bucket]) => [
        String(status),
        REASON[status] ?? (status >= 400 ? 'Error' : 'Unknown'),
        separator(bucket.hits),
        share(bucket.hits, requests),
        bucket.bytes === 0 ? '0 B' : humanBytes(bucket.bytes),
      ]);
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['Status', 'Meaning', 'Requests', 'Share', 'Bytes'], rows }),
        render: 'table',
      },
      notes: notesOut,
      warnings: warningsOut,
      stats,
    };
  }

  if (format === 'errors') {
    const all = [...result.errorPaths.entries()]
      .map(([key, bucket]) => ({ key, bucket }))
      .sort((a, b) => b.bucket.hits - a.bucket.hits || a.bucket.status - b.bucket.status || (a.key < b.key ? -1 : 1));
    const shown = all.slice(0, MAX_ERROR_ROWS);
    const rows = shown.map(({ key, bucket }) => [
      String(bucket.status),
      REASON[bucket.status] ?? 'Error',
      bucket.method,
      clip(key.slice(String(bucket.status).length + bucket.method.length + 2)),
      separator(bucket.hits),
      Number.isNaN(bucket.last) ? '-' : new Date(bucket.last).toISOString(),
    ]);
    if (all.length > shown.length) notesOut.push('Only the first ' + MAX_ERROR_ROWS + ' failing paths are listed.');
    if (rows.length === 0) {
      notesOut.push('No 4xx or 5xx responses were found in this log.');
      return {
        outputs: [],
        report: {
          output: JSON.stringify({
            headers: ['Status', 'Meaning', 'Method', 'Path', 'Requests', 'Last seen'],
            rows: [['-', 'No errors', '-', 'Every parsed request returned a status below 400.', '-', '-']],
          }),
          render: 'table',
        },
        notes: notesOut,
        warnings: warningsOut,
        stats,
      };
    }
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['Status', 'Meaning', 'Method', 'Path', 'Requests', 'Last seen'], rows }),
        render: 'table',
      },
      notes: notesOut,
      warnings: warningsOut,
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
              ? [['ok', 'Nothing to flag', 'The log parsed cleanly and no traffic pattern stood out.']]
              : findings.map((finding) => [finding.level, finding.problem, finding.detail]),
        }),
        render: 'table',
      },
      notes: notesOut,
      warnings: warningsOut,
      stats,
    };
  }

  const summaryRows: string[][] = [
    ['Source', sourceLabel],
    ['Lines read', separator(result.totalLines)],
    ['Lines parsed', separator(result.parsed)],
    ['Lines skipped', separator(result.skipped)],
    ['Requests', separator(requests)],
    ['Total bytes sent', separator(result.bytesTotal) + ' (' + humanBytes(result.bytesTotal) + ')'],
    ['Average response size', separator(Math.round(result.bytesTotal / requests)) + ' bytes'],
    ...span,
    ['Distinct addresses', separator(result.ips.size)],
    ['Distinct paths', separator(result.paths.size)],
    ['Distinct user agents', separator(result.agents.size)],
    statusRow('2xx success', classCount(200, 299)),
    statusRow('3xx redirect', classCount(300, 399)),
    statusRow('4xx client error', classCount(400, 499)),
    statusRow('5xx server error', classCount(500, 599)),
    ['Error rate', share(result.errorCount, requests)],
    ['Crawler requests', separator(result.bots) + ' (' + share(result.bots, requests) + ')'],
    ['Command-line / library clients', separator(result.clients) + ' (' + share(result.clients, requests) + ')'],
    ['Browsers', separator(result.browsers) + ' (' + share(result.browsers, requests) + ')'],
    ['Missing user agent', separator(result.noAgent)],
    ['Methods', [...result.methods.entries()].sort((a, b) => b[1].hits - a[1].hits).map(([key, bucket]) => key + ' × ' + bucket.hits).join(', ')],
    ['Protocols', [...result.protocols.entries()].sort((a, b) => b[1].hits - a[1].hits).map(([key, bucket]) => key + ' × ' + bucket.hits).join(', ')],
    ['Findings', errors + ' error, ' + warnings + ' warning, ' + notes + ' note'],
  ];

  return {
    outputs: [],
    report: { output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }), render: 'table' },
    notes: notesOut,
    warnings: warningsOut,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
