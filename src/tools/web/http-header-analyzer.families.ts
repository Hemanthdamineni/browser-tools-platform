/**
 * Per-header parsers for the unified `http-header-analyzer` tool.
 *
 * Every family knows how to read exactly one header's value and returns a
 * verdict, a one-line assessment, the parsed sub-structure and any problems it
 * found. The tool file owns everything around this: splitting the pasted block
 * into header lines, detecting which family a line belongs to, de-duplicating
 * repeated fields and shaping the output table.
 *
 * The rules below were taken from the single-header tools this tool replaces
 * (`alt-used`, `early-data`, `trailer-header`, …); they are kept intact so the
 * folded behaviour stays the same.
 */

export type HeaderStatus = 'Valid' | 'Review' | 'Invalid' | 'Deprecated' | 'Generic';

export interface ParsedHeader {
  /** Verdict for this header value. */
  status: HeaderStatus;
  /** One-line assessment shown in the output table. */
  summary: string;
  /** Parsed sub-structure (`urgency=3`, `host=example.com`). */
  details: string[];
  /** Problems found in the value. */
  issues: string[];
  /** Context that is worth knowing but is not a problem. */
  notes: string[];
}

export interface HeaderFamily {
  /** Stable key for this family (also the option value in the UI). */
  id: string;
  /** Canonical header name shown in the output. */
  header: string;
  /** Other header names that share this parser. */
  aliases?: string[];
  /** Set when the header is deprecated — the reason is shown in the table. */
  deprecated?: string;
  /** The value may legitimately span several lines (JSON payloads). */
  multiline?: boolean;
  parse(value: string): ParsedHeader;
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const IMF =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;
const STANDARD_METHODS = new Set([
  'CONNECT',
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
  'TRACE',
]);

function result(
  status: HeaderStatus,
  summary: string,
  extra: { details?: string[]; issues?: string[]; notes?: string[] } = {},
): ParsedHeader {
  return {
    status,
    summary,
    details: extra.details ?? [],
    issues: extra.issues ?? [],
    notes: extra.notes ?? [],
  };
}

/** Split on commas, trimming and dropping empty members. */
function splitList(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Split on commas, ignoring commas inside a quoted string. */
function splitQuoted(text: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (char === ',' && !quoted) {
      if (current.trim()) values.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) values.push(current.trim());
  return values;
}

/** Split `;key=value` style parameters, keeping the order. */
function splitParams(text: string): string[] {
  return text
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
    return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1');
  return trimmed;
}

function duplicatesOf(items: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const item of items) {
    if (seen.has(item)) dupes.add(item);
    seen.add(item);
  }
  return [...dupes];
}

function httpDateIssues(date: string, label: string): string[] {
  if (!IMF.test(date)) {
    const parsed = Date.parse(date);
    return Number.isNaN(parsed)
      ? [`Invalid HTTP-date; expected IMF-fixdate such as Wed, 21 Oct 2015 07:28:00 GMT`]
      : ['Use IMF-fixdate; this appears to be an obsolete HTTP-date form'];
  }
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return ['Invalid calendar date'];
  if (label === 'Date' && parsed > Date.now() + 300000)
    return ['Date is more than five minutes in the future; check clock skew'];
  if (label === 'Sunset' && parsed < Date.now())
    return ['Deprecation or sunset date is in the past; confirm the intent or renew it'];
  if (label === 'Sunset' && parsed > Date.now() + 315360000000)
    return ['Date is more than ten years away; verify the lifecycle policy'];
  return [];
}

/* -------------------------------------------------------------------------- */
/*  Request / response signals                                                */
/* -------------------------------------------------------------------------- */

const altUsed: HeaderFamily = {
  id: 'alt-used',
  header: 'Alt-Used',
  parse(value) {
    const raw = value.trim();
    const issues: string[] = [];
    const details: string[] = [];
    let host = raw;
    let port = '';
    if (raw.includes('://')) {
      issues.push('Alt-Used is a plain host, not a URL; omit the scheme');
      host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    }
    const colon = host.lastIndexOf(':');
    if (colon > 0 && /^\d+$/.test(host.slice(colon + 1))) {
      port = host.slice(colon + 1);
      host = host.slice(0, colon);
    }
    if (!host || host.includes(' ')) issues.push('Empty or invalid host portion');
    if (host === '*')
      issues.push(
        'Wildcard authority is not permitted in Alt-Used — it must name the specific alternative used',
      );
    if (port) {
      const numeric = Number(port);
      if (numeric < 1 || numeric > 65535) issues.push(`Port ${numeric} is out of range (1–65535)`);
    }
    details.push(`host=${host || '(none)'}`, `port=${port || '(default)'}`);
    return result(
      issues.length ? 'Invalid' : 'Valid',
      issues.length
        ? 'Alt-Used is not a valid authority'
        : 'Names the alternative service that served the request',
      {
        details,
        issues,
        notes: ['Alt-Used mirrors the Alt-Svc the client received earlier.'],
      },
    );
  },
};

const earlyData: HeaderFamily = {
  id: 'early-data',
  header: 'Early-Data',
  parse(value) {
    const trimmed = value.trim();
    const issues: string[] = [];
    if (!trimmed) issues.push('Early-Data value is empty');
    else if (trimmed !== '0') {
      issues.push('Early-Data must be exactly 0');
      issues.push('Only the standardized 0 signal is supported');
    }
    return result(issues.length ? 'Invalid' : 'Valid', 'TLS 1.3 early-data signal', {
      details: [`signal=${trimmed || '(empty)'}`],
      issues,
      notes: [
        'Early data can be replayed; protect unsafe operations and consider answering 425 Too Early.',
      ],
    });
  },
};

const trailer: HeaderFamily = {
  id: 'trailer',
  header: 'Trailer',
  aliases: ['trailer-header'],
  parse(value) {
    const fields = splitList(value).map((field) => field.toLowerCase());
    const issues: string[] = [];
    if (!fields.length) issues.push('No trailer field names were provided');
    if (fields.some((field) => !TOKEN.test(field)))
      issues.push('One or more field names are invalid HTTP tokens');
    const dupes = duplicatesOf(fields);
    if (dupes.length) issues.push(`Duplicate trailer field names are present: ${dupes.join(', ')}`);
    const forbidden = fields.filter((field) =>
      [
        'authorization',
        'content-length',
        'content-type',
        'host',
        'trailer',
        'transfer-encoding',
        'www-authenticate',
        'content-encoding',
        'content-range',
      ].includes(field),
    );
    if (forbidden.length) issues.push(`Not permitted in trailers: ${forbidden.join(', ')}`);
    return result(
      issues.length ? 'Review' : 'Valid',
      'Declares the field names sent after the body',
      {
        details: fields.map((field) => `field=${field}`),
        issues,
        notes: [
          'Trailer declares names only; the values are sent separately after the message body.',
        ],
      },
    );
  },
};

const priority: HeaderFamily = {
  id: 'priority',
  header: 'Priority',
  aliases: ['priority-header'],
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    let urgency: string | null = null;
    let incremental = false;
    const seen = new Set<string>();
    for (const param of splitList(value)) {
      const [rawKey, rawValue] = param.split('=').map((item) => item.trim().toLowerCase());
      const key = rawKey ?? '';
      if (seen.has(key)) issues.push(`Duplicate parameter: ${key}`);
      seen.add(key);
      if (key === 'u') {
        if (rawValue === undefined || !/^\d$/.test(rawValue) || Number(rawValue) > 7)
          issues.push('urgency must be an integer from 0 to 7');
        else urgency = rawValue;
      } else if (key === 'i' && rawValue === undefined) incremental = true;
      else issues.push(`Unknown or malformed parameter: ${param}`);
    }
    details.push(`urgency=${urgency ?? 'unset'}`, `incremental=${incremental ? 'true' : 'false'}`);
    return result(
      issues.length ? 'Review' : 'Valid',
      'Priority is a scheduling hint; it does not guarantee delivery order or bandwidth',
      { details, issues },
    );
  },
};

const signatureInput: HeaderFamily = {
  id: 'signature-input',
  header: 'Signature-Input',
  parse(value) {
    const trimmed = value.trim();
    const match = /^([A-Za-z][A-Za-z0-9_-]*)=\(([^)]*)\)(?:;(.*))?$/.exec(trimmed);
    if (!match)
      return result('Invalid', 'Invalid signature-input syntax', {
        issues: ['Expected label=("component" …);param=value'],
      });
    const label = match[1] ?? '';
    const components = [...(match[2] ?? '').matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((item) =>
      (item[1] ?? '').replace(/\\(["\\])/g, '$1'),
    );
    const issues: string[] = [];
    if (!components.length) issues.push('At least one covered component is required');
    if (components.some((component) => !/^[@A-Za-z][@A-Za-z0-9!#$%&'*+.^_`|~-]*$/.test(component)))
      issues.push('Covered components must be valid HTTP field or derived-component names');
    const params: string[] = [];
    const seen = new Set<string>();
    for (const part of splitParams(match[3] ?? '')) {
      const index = part.indexOf('=');
      if (index <= 0) {
        issues.push(`Malformed signature parameter: ${part}`);
        continue;
      }
      const key = part.slice(0, index).trim().toLowerCase();
      const val = part.slice(index + 1).trim();
      if (seen.has(key)) issues.push(`Duplicate signature parameter: ${key}`);
      seen.add(key);
      if (!['created', 'expires', 'keyid', 'alg', 'nonce', 'tag'].includes(key))
        issues.push(`Unknown signature parameter: ${key}`);
      if ((key === 'created' || key === 'expires') && !/^\d+$/.test(val))
        issues.push(`${key} must be a Unix timestamp integer`);
      if (key === 'keyid' && !/^"[^"\r\n]*"$/.test(val))
        issues.push('keyid must be a quoted string');
      params.push(`${key}=${val}`);
    }
    if (!seen.has('keyid')) issues.push('keyid is recommended for selecting a verification key');
    return result(
      issues.length ? 'Review' : 'Valid',
      'Describes the components a signature covers',
      {
        details: [
          `label=${label}`,
          ...components.map((component) => `component=${component}`),
          ...params,
        ],
        issues,
        notes: [
          'Signature-Input is metadata only; signing and verification need a Signature field and a key.',
        ],
      },
    );
  },
};

const tracestate: HeaderFamily = {
  id: 'tracestate',
  header: 'Tracestate',
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const seen = new Set<string>();
    for (const part of splitList(value)) {
      const index = part.indexOf('=');
      if (index <= 0) {
        issues.push(`Malformed list-member: ${part}`);
        continue;
      }
      const key = part.slice(0, index).trim();
      const val = part.slice(index + 1).trim();
      if (!/^[a-z][a-z0-9_*/-]{0,255}$/.test(key)) issues.push(`Invalid vendor key: ${key}`);
      if (!/^[\x21-\x2b\x2d-\x3c\x3e-\x7e]+$/.test(val))
        issues.push(`Invalid vendor value for ${key}`);
      if (seen.has(key)) issues.push(`Duplicate vendor key: ${key}`);
      seen.add(key);
      details.push(`${key}=${val}`);
    }
    if (details.length > 32) issues.push('Tracestate must contain at most 32 list-members');
    if (new TextEncoder().encode(value).length > 512)
      issues.push('Tracestate must be at most 512 bytes');
    return result(issues.length ? 'Review' : 'Valid', 'Carries vendor tracing metadata', {
      details,
      issues,
      notes: ['Propagate tracestate carefully; never put secrets in its values.'],
    });
  },
};

const traceparent: HeaderFamily = {
  id: 'traceparent',
  header: 'Traceparent',
  parse(value) {
    const parts = value.trim().split('-');
    const issues: string[] = [];
    if (parts.length !== 4)
      issues.push('Traceparent must have version-trace-id-parent-id-flags separated by hyphens');
    const version = parts[0] ?? '';
    const traceId = parts[1] ?? '';
    const parentId = parts[2] ?? '';
    const flags = parts[3] ?? '';
    if (!/^[0-9a-f]{2}$/i.test(version))
      issues.push('Version must be exactly two hexadecimal characters');
    if (!/^[0-9a-f]{32}$/i.test(traceId) || /^0+$/.test(traceId))
      issues.push('Trace ID must be 32 hexadecimal characters and not all zero');
    if (!/^[0-9a-f]{16}$/i.test(parentId) || /^0+$/.test(parentId))
      issues.push('Parent ID must be 16 hexadecimal characters and not all zero');
    if (!/^[0-9a-f]{2}$/i.test(flags))
      issues.push('Trace flags must be exactly two hexadecimal characters');
    const sampled = /^[0-9a-f]{2}$/i.test(flags) && (Number.parseInt(flags, 16) & 1) === 1;
    return result(issues.length ? 'Invalid' : 'Valid', 'W3C Trace Context propagation value', {
      details: [
        `version=${version}`,
        `trace-id=${traceId}`,
        `parent-id=${parentId}`,
        `flags=${flags}`,
        `sampled=${sampled ? 'yes' : 'no'}`,
      ],
      issues,
      notes: [
        'Trace context identifies propagation state; it does not itself contain tracing data.',
      ],
    });
  },
};

const warning: HeaderFamily = {
  id: 'warning',
  header: 'Warning',
  aliases: ['warning-header'],
  deprecated: 'Removed in RFC 9111 — use Cache-Control and Age for freshness information instead.',
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const code = /^(\d{3})/.exec(value.trim())?.[1] ?? '';
    if (!code) {
      issues.push('Warn-code must be a 3-digit integer at the start');
    } else {
      details.push(`warn-code=${code}`);
    }
    const agent =
      /^(\S+)/.exec(
        value
          .trim()
          .replace(/^\d{3}/, '')
          .trim(),
      )?.[1] ?? '';
    if (agent) details.push(`warn-agent=${agent}`);
    const text = /"((?:[^"\\]|\\.)*)"/.exec(value)?.[1] ?? '';
    if (!text) issues.push('Expected a quoted warn-text string');
    else details.push(`warn-text=${text}`);
    return result('Deprecated', 'Advisory warning about the response (deprecated header)', {
      details,
      issues,
      notes: ['Warning carries advisory information only; prefer Cache-Control and Age.'],
    });
  },
};

const dateHeader: HeaderFamily = {
  id: 'date',
  header: 'Date',
  aliases: ['date-header'],
  parse(value) {
    const date = value.trim();
    const issues = httpDateIssues(date, 'Date');
    return result(issues.length ? 'Review' : 'Valid', 'Origin response timestamp', {
      details: [`date=${date}`],
      issues,
      notes: ['Accurate response dates support cache freshness and clock-skew diagnostics.'],
    });
  },
};

const retryAfter: HeaderFamily = {
  id: 'retry-after',
  header: 'Retry-After',
  parse(value) {
    const trimmed = value.trim();
    const issues: string[] = [];
    let form = 'invalid';
    let meaning = 'Expected non-negative seconds or an HTTP-date ending in GMT';
    if (/^\d+$/.test(trimmed)) {
      form = 'delta-seconds';
      const seconds = Number(trimmed);
      meaning = `${seconds} second(s)`;
      if (seconds > 2_147_483_647) issues.push('Delay exceeds the common 32-bit maximum');
    } else {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime()) && /\bGMT$/i.test(trimmed)) {
        form = 'HTTP-date';
        meaning = parsed.toISOString();
      } else {
        issues.push('Expected non-negative seconds or an HTTP-date ending in GMT');
      }
    }
    return result(issues.length ? 'Invalid' : 'Valid', 'Tells the client how long to wait', {
      details: [`form=${form}`, `meaning=${meaning}`],
      issues,
      notes: ['Actual retry timing can vary with clock skew, latency and server policy.'],
    });
  },
};

const link: HeaderFamily = {
  id: 'link',
  header: 'Link',
  aliases: ['link-header'],
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const items = splitQuoted(value);
    if (!items.length) issues.push('No Link values were provided');
    for (const item of items) {
      const match = /^\s*<([^>]*)>(.*)$/.exec(item);
      if (!match || !match[1]) {
        issues.push(`Invalid Link value: ${item}`);
        continue;
      }
      const uri = match[1];
      details.push(`uri=${uri}`);
      if (!/^(?:https?:\/\/|\/|\.\/|\.\.\/|urn:)/i.test(uri))
        issues.push(`URI is not an obvious absolute or relative reference: ${uri}`);
      const rels: string[] = [];
      for (const piece of splitParams(match[2] ?? '')) {
        const equals = piece.indexOf('=');
        if (equals <= 0) {
          issues.push(`Malformed parameter: ${piece}`);
          continue;
        }
        const key = piece.slice(0, equals).trim().toLowerCase();
        const param = unquote(piece.slice(equals + 1));
        details.push(`${key}=${param}`);
        if (key === 'rel') rels.push(...param.split(/\s+/).filter(Boolean));
      }
      if (!rels.length) issues.push(`Missing rel parameter on ${uri}`);
      else if (duplicatesOf(rels).length) issues.push(`Duplicate relation token on ${uri}`);
    }
    return result(issues.length ? 'Review' : 'Valid', 'Links a resource to related resources', {
      details,
      issues,
      notes: ['Link targets are not fetched or verified by this local parser.'],
    });
  },
};

const upgrade: HeaderFamily = {
  id: 'upgrade',
  header: 'Upgrade',
  aliases: ['upgrade-header'],
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const names: string[] = [];
    for (const raw of splitList(value)) {
      const parts = raw.trim().split('/');
      const name = (parts[0] ?? '').toLowerCase();
      const version = parts.slice(1).join('/').trim();
      if (!name) continue;
      names.push(name);
      details.push(version ? `protocol=${name}/${version}` : `protocol=${name}`);
      if (!TOKEN.test(name)) issues.push(`Invalid protocol token: ${name}`);
      if (parts.length > 2) issues.push('Protocol has too many slash-separated components');
      if (version && !TOKEN.test(version))
        issues.push(`Invalid protocol version token: ${version}`);
      if (name === 'http' && /^[23](?:\.|$)/.test(version))
        issues.push('HTTP/2 and HTTP/3 do not generally use the HTTP/1.1 Upgrade mechanism');
    }
    if (!names.length) issues.push('No protocols were provided');
    if (duplicatesOf(names).length) issues.push('Duplicate protocols are present');
    return result(issues.length ? 'Review' : 'Valid', 'Advertises a protocol switch', {
      details,
      issues,
      notes: [
        'Upgrade is a negotiation hint; HTTP/1.1 also needs Connection: Upgrade and server acceptance.',
      ],
    });
  },
};

const prefer: HeaderFamily = {
  id: 'prefer',
  header: 'Prefer',
  aliases: ['prefer-header'],
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const names: string[] = [];
    for (const raw of splitQuoted(value)) {
      const index = raw.indexOf('=');
      const name = (index < 0 ? raw : raw.slice(0, index)).trim().toLowerCase();
      if (!name) continue;
      const value = index < 0 ? undefined : unquote(raw.slice(index + 1));
      names.push(name);
      details.push(value === undefined ? name : `${name}=${value}`);
      if (!TOKEN.test(name)) issues.push(`Invalid preference token: ${name}`);
      if (value !== undefined && !value) issues.push(`Preference value is empty: ${name}`);
      if (name === 'wait' && (!/^\d+$/.test(value ?? '') || Number(value) > 86400))
        issues.push('wait must be a whole number from 0 to 86400 seconds');
    }
    if (!names.length) issues.push('No preferences were provided');
    const dupes = duplicatesOf(names);
    if (dupes.length) issues.push(`Duplicate preference names: ${dupes.join(', ')}`);
    return result(issues.length ? 'Review' : 'Valid', 'Client preferences for the response', {
      details,
      issues,
      notes: ['Prefer is a client hint; servers may ignore it or report applied preferences.'],
    });
  },
};

const allow: HeaderFamily = {
  id: 'allow',
  header: 'Allow',
  aliases: ['allow-header'],
  parse(value) {
    const methods = splitList(value).map((method) => method.toUpperCase());
    const issues: string[] = [];
    if (!methods.length) issues.push('No methods were provided');
    if (methods.includes('*') && methods.length > 1)
      issues.push('Wildcard must not be combined with method names');
    if (methods.some((method) => !TOKEN.test(method) && method !== '*'))
      issues.push('One or more method names are invalid tokens');
    if (duplicatesOf(methods).length) issues.push('Duplicate methods are present');
    if (methods.includes('GET') && !methods.includes('HEAD'))
      issues.push('HEAD is commonly supported alongside GET; verify whether it should be listed');
    if (methods.some((method) => !STANDARD_METHODS.has(method) && method !== '*'))
      issues.push('One or more methods are non-standard; confirm server support');
    return result(issues.length ? 'Review' : 'Valid', 'Lists the methods a resource supports', {
      details: methods.map((method) => `method=${method}`),
      issues,
      notes: ['Allow lists capability, not authorization.'],
    });
  },
};

const connection: HeaderFamily = {
  id: 'connection',
  header: 'Connection',
  aliases: ['connection-header'],
  parse(value) {
    const tokens = splitList(value).map((token) => token.toLowerCase());
    const issues: string[] = [];
    const sensitive = [
      'authorization',
      'connection',
      'content-length',
      'host',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
    ];
    if (!tokens.length) issues.push('No connection tokens were provided');
    if (tokens.some((token) => !TOKEN.test(token)))
      issues.push('One or more connection tokens are invalid HTTP tokens');
    if (duplicatesOf(tokens).length) issues.push('Duplicate connection tokens are present');
    if (tokens.some((token) => sensitive.includes(token)))
      issues.push(
        'One or more tokens require careful proxy handling and must not be blindly forwarded',
      );
    return result(issues.length ? 'Review' : 'Valid', 'HTTP/1.1 hop-by-hop connection control', {
      details: tokens.map((token) => `token=${token}`),
      issues,
      notes: ['Connection is prohibited in HTTP/2 and HTTP/3.'],
    });
  },
};

const origin: HeaderFamily = {
  id: 'origin',
  header: 'Origin',
  aliases: ['origin-header'],
  parse(value) {
    const body = value.trim().replace(/^Origin\s*:\s*/i, '');
    const issues: string[] = [];
    const notes: string[] = [];
    if (!body) {
      issues.push('No Origin header value provided');
      return result('Invalid', 'Origin is empty', { issues });
    }
    if (body === 'null') {
      notes.push(
        'The null origin marks a sandboxed, anonymous or non-browser context (file://, data:, sandboxed iframe).',
      );
      return result('Valid', 'Opaque null origin', { details: ['origin=null'], notes });
    }
    const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([/?#].*)?$/i.exec(body);
    if (!match) {
      issues.push('Not a valid Origin: expected scheme://host[:port] or the literal null');
      return result('Invalid', 'Origin is not a valid origin', { issues });
    }
    const scheme = (match[1] ?? '').toLowerCase();
    const hostPort = match[2] ?? '';
    const rest = match[3] ?? '';
    if (rest)
      issues.push(
        `Trailing "${rest}" is not part of an origin; origins never contain paths, queries or fragments`,
      );
    if (!hostPort) issues.push('Missing host after the scheme:// prefix');
    if (hostPort.includes('/') || hostPort.includes('?') || hostPort.includes('#'))
      issues.push('Credentials, path, query or fragment inside the host portion');
    const colon = hostPort.indexOf(':');
    if (colon >= 0 && !/^\d+$/.test(hostPort.slice(colon + 1)))
      issues.push('Port must be a number (1–65535)');
    else if (colon >= 0) {
      const port = Number(hostPort.slice(colon + 1));
      if (port < 1 || port > 65535) issues.push(`Port ${port} is outside the valid range 1–65535`);
    }
    if (scheme === 'http' && hostPort.toLowerCase().includes('.'))
      notes.push('Plain http origins should only be sent when the page is itself on http.');
    return result(
      issues.length ? 'Invalid' : 'Valid',
      'Single origin — compare it against an allowlist',
      {
        details: [`origin=${body}`],
        issues,
        notes,
      },
    );
  },
};

const expect: HeaderFamily = {
  id: 'expect',
  header: 'Expect',
  aliases: ['expect-header'],
  parse(value) {
    const expectations = splitList(value).map((item) => item.toLowerCase());
    const issues: string[] = [];
    if (!expectations.length) issues.push('No expectations were provided');
    if (expectations.some((item) => !TOKEN.test(item)))
      issues.push('One or more expectations are invalid tokens');
    if (duplicatesOf(expectations).length) issues.push('Duplicate expectations are present');
    if (expectations.some((item) => item !== '100-continue'))
      issues.push(
        'Only 100-continue has broad HTTP interoperability; custom expectations require explicit support',
      );
    return result(
      issues.length ? 'Review' : 'Valid',
      'Expectations the client has for the server',
      {
        details: expectations.map((item) => `expectation=${item}`),
        issues,
        notes: ['Expect needs server cooperation and a client-side fallback timeout.'],
      },
    );
  },
};

const via: HeaderFamily = {
  id: 'via',
  header: 'Via',
  aliases: ['via-header'],
  parse(value) {
    const elements = splitQuoted(value);
    const issues: string[] = [];
    const details: string[] = [];
    if (!elements.length) issues.push('No Via elements were provided');
    for (const element of elements) {
      const match =
        /^([A-Za-z0-9+.-]+(?:\/[A-Za-z0-9+.-]+)?)(?:\s+([A-Za-z0-9.-]+))?(?:\s*\([^)]*\))?$/.exec(
          element,
        );
      if (!match || !match[2]) {
        issues.push(
          match
            ? `Missing received-by (host) after protocol/version: ${element}`
            : `Not valid RFC 7230 grammar: ${element}`,
        );
        continue;
      }
      details.push(`protocol=${match[1]}`, `received-by=${match[2]}`);
    }
    return result(
      issues.length ? 'Invalid' : 'Valid',
      'Lists the proxies a message passed through',
      {
        details,
        issues,
        notes: [
          elements.length > 1
            ? `${elements.length} proxy chain elements — each hop adds one, ordered request-side to response-side.`
            : 'Each hop adds one Via element.',
        ],
      },
    );
  },
};

const forwarded: HeaderFamily = {
  id: 'forwarded',
  header: 'Forwarded',
  aliases: ['forwarded-header'],
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const elements = splitQuoted(value);
    if (!elements.length) issues.push('No Forwarded elements were provided');
    for (const element of elements) {
      const keys: string[] = [];
      for (const part of splitParams(element)) {
        const index = part.indexOf('=');
        if (index <= 0) {
          issues.push(`Malformed parameter: ${part}`);
          continue;
        }
        const key = part.slice(0, index).trim().toLowerCase();
        const val = unquote(part.slice(index + 1));
        if (!/^[a-z][a-z0-9-]*$/i.test(key)) issues.push(`Invalid parameter name: ${key}`);
        if (!val) issues.push(`Empty value for ${key}`);
        keys.push(key);
        details.push(`${key}=${val}`);
      }
      if (!keys.includes('for')) issues.push('Missing required for parameter');
      if (duplicatesOf(keys).length) issues.push('Duplicate parameters are present');
    }
    return result(issues.length ? 'Review' : 'Valid', 'Standardised proxy chain information', {
      details,
      issues,
      notes: ['Forwarded values are only trustworthy when written by a trusted proxy.'],
    });
  },
};

const serverTiming: HeaderFamily = {
  id: 'server-timing',
  header: 'Server-Timing',
  aliases: ['server-timing'],
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const names: string[] = [];
    for (const raw of splitQuoted(value)) {
      const parts = splitParams(raw);
      const name = (parts.shift() ?? '').toLowerCase();
      if (!name || !/^[a-z][a-z0-9_-]*$/i.test(name)) {
        issues.push(`Invalid metric name: ${name || raw}`);
        continue;
      }
      names.push(name);
      details.push(`metric=${name}`);
      const keys: string[] = [];
      for (const part of parts) {
        const index = part.indexOf('=');
        if (index <= 0) {
          issues.push(`Malformed parameter: ${part}`);
          continue;
        }
        const key = part.slice(0, index).trim().toLowerCase();
        const val = unquote(part.slice(index + 1));
        if (!['dur', 'desc', 'description', 'name'].includes(key))
          issues.push(`Unknown parameter: ${key}`);
        if (key === 'dur' && (!/^\d+(?:\.\d+)?$/.test(val) || Number(val) < 0))
          issues.push('dur must be a non-negative number');
        keys.push(key);
        details.push(`${name}.${key}=${val}`);
      }
      if (duplicatesOf(keys).length) issues.push(`Duplicate parameters are present in ${name}`);
    }
    if (!names.length) issues.push('No metrics were provided');
    if (duplicatesOf(names).length) issues.push('Duplicate metric names are present');
    return result(issues.length ? 'Review' : 'Valid', 'Server-side performance metrics', {
      details,
      issues,
      notes: [
        'Server-Timing is observable by clients; avoid secrets and sensitive internal details.',
      ],
    });
  },
};

const acceptCh: HeaderFamily = {
  id: 'accept-ch',
  header: 'Accept-CH',
  parse(value) {
    const hints = value
      .split(/[\s,]+/)
      .map((hint) => hint.trim())
      .filter(Boolean);
    const issues: string[] = [];
    const highEntropy = new Set([
      'Sec-CH-UA-Full-Version',
      'Sec-CH-UA-Platform-Version',
      'Sec-CH-UA-Model',
      'Device-Memory',
      'Downlink',
      'RTT',
    ]);
    for (const hint of hints) {
      if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(hint)) issues.push(`Invalid client-hint token: ${hint}`);
    }
    const dupes = duplicatesOf(hints.map((hint) => hint.toLowerCase()));
    if (dupes.length) issues.push(`Duplicate client hints: ${dupes.join(', ')}`);
    const sensitive = hints.filter((hint) => highEntropy.has(hint));
    if (sensitive.length)
      issues.push(
        `High-entropy hints can increase fingerprinting surface: ${sensitive.join(', ')}`,
      );
    return result(issues.length ? 'Review' : 'Valid', 'Client hints the client may send back', {
      details: hints.map((hint) => `hint=${hint}`),
      issues,
      notes: ['Coordinate client hints with Vary, cache keys and Permissions-Policy.'],
    });
  },
};

const criticalCh: HeaderFamily = {
  id: 'critical-ch',
  header: 'Critical-CH',
  parse(value) {
    const hints = value
      .split(/[\s,]+/)
      .map((hint) => hint.trim())
      .filter(Boolean);
    const issues: string[] = [];
    const highEntropy = new Set([
      'Sec-CH-UA-Full-Version',
      'Sec-CH-UA-Platform-Version',
      'Sec-CH-UA-Model',
      'Device-Memory',
    ]);
    for (const hint of hints) {
      if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(hint)) issues.push(`Invalid client-hint token: ${hint}`);
    }
    const dupes = duplicatesOf(hints.map((hint) => hint.toLowerCase()));
    if (dupes.length) issues.push(`Duplicate critical hints: ${dupes.join(', ')}`);
    const sensitive = hints.filter((hint) => highEntropy.has(hint));
    if (sensitive.length)
      issues.push(
        `High-entropy critical hints increase fingerprinting surface: ${sensitive.join(', ')}`,
      );
    return result(
      issues.length ? 'Review' : 'Valid',
      'Client hints the client should send immediately',
      {
        details: hints.map((hint) => `hint=${hint}`),
        issues,
        notes: [
          'Critical-CH can influence retries; coordinate Accept-CH, Vary and your privacy policy.',
        ],
      },
    );
  },
};

const altSvc: HeaderFamily = {
  id: 'alt-svc',
  header: 'Alt-Svc',
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const protocols: string[] = [];
    for (const raw of splitQuoted(value)) {
      const match = /^([^=\s]+)=\s*"([^"]*)"(.*)$/.exec(raw);
      if (!match) {
        issues.push(`Expected protocol="authority" syntax: ${raw}`);
        continue;
      }
      const protocol = (match[1] ?? '').toLowerCase();
      const authority = match[2] ?? '';
      protocols.push(protocol);
      details.push(`protocol=${protocol}`, `authority=${authority}`);
      if (!TOKEN.test(protocol)) issues.push('Invalid protocol identifier');
      if (authority !== '*' && !/^:?[0-9]+$/.test(authority) && !/^[^\s:]+:[0-9]+$/.test(authority))
        issues.push('Authority should be a host:port or :port value');
      for (const part of splitParams(match[3] ?? '')) {
        const [rawKey, value = ''] = part.split('=').map((item) => item.trim().toLowerCase());
        const key = rawKey ?? '';
        if (!['ma', 'persist'].includes(key)) issues.push(`Unknown parameter: ${key}`);
        if (key === 'ma' && (!/^\d+$/.test(value) || Number(value) > 31536000))
          issues.push('ma must be a whole number from 0 to 31536000 seconds');
        if (key === 'persist' && value !== '1') issues.push('persist must be 1 when present');
        details.push(`${key}=${value}`);
      }
      if (authority === '*')
        issues.push('Wildcard authority applies broadly; confirm origin scope');
    }
    if (!protocols.length) issues.push('No alternate services were provided');
    if (duplicatesOf(protocols).length) issues.push('Duplicate protocol entries are present');
    return result(issues.length ? 'Review' : 'Valid', 'Advertises alternative services', {
      details,
      issues,
      notes: ['Alt-Svc advertises an alternative route; clients may ignore it or fall back.'],
    });
  },
};

const timingAllowOrigin: HeaderFamily = {
  id: 'timing-allow-origin',
  header: 'Timing-Allow-Origin',
  parse(value) {
    const origins = splitList(value);
    const issues: string[] = [];
    for (const origin of origins) {
      if (!/^(\*|https?:\/\/[^\s,]+)$/i.test(origin))
        issues.push(`Invalid origin token: ${origin}`);
    }
    if (!origins.length) issues.push('No Timing-Allow-Origin values were provided');
    if (origins.includes('*') && origins.length > 1)
      issues.push('A wildcard * makes additional origins redundant');
    if (origins.includes('*'))
      issues.push(
        'A wildcard * exposes timing data to every origin; narrow the grant where possible',
      );
    if (duplicatesOf(origins).length) issues.push('Duplicate origin tokens are present');
    return result(issues.length ? 'Review' : 'Valid', 'Origins allowed to read resource timing', {
      details: origins.map((origin) => `origin=${origin}`),
      issues,
      notes: [
        'TAO only gates read access to timing metrics in supported browsers; it does not affect loading the resource.',
      ],
    });
  },
};

const contentDigest: HeaderFamily = {
  id: 'content-digest',
  header: 'Content-Digest',
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const algorithms: string[] = [];
    for (const raw of value.split(/\r\n|\r|\n/).flatMap((line) => splitList(line))) {
      const match = /^([A-Za-z][A-Za-z0-9-]*)=:(.*):$/.exec(raw.trim());
      if (!match) {
        issues.push(`Expected algorithm=:base64: syntax: ${raw}`);
        continue;
      }
      const algorithm = (match[1] ?? '').toLowerCase();
      const digest = match[2] ?? '';
      algorithms.push(algorithm);
      details.push(`algorithm=${algorithm}`, `digest=${digest}`);
      if (!['sha-256', 'sha-512'].includes(algorithm))
        issues.push(`Unsupported algorithm for this utility: ${algorithm}`);
      if (!digest || !/^[A-Za-z0-9+/]+={0,2}$/.test(digest) || digest.length % 4 !== 0)
        issues.push('Digest must be padded base64');
      if (algorithm === 'sha-256' && digest.length !== 44)
        issues.push('SHA-256 base64 digests are normally 44 characters');
      if (algorithm === 'sha-512' && digest.length !== 88)
        issues.push('SHA-512 base64 digests are normally 88 characters');
    }
    if (!algorithms.length) issues.push('No digest entries were provided');
    if (duplicatesOf(algorithms).length) issues.push('Duplicate algorithm entries are present');
    return result(issues.length ? 'Review' : 'Valid', 'Integrity digests of the response content', {
      details,
      issues,
      notes: [
        'A syntactically valid digest is not proof of integrity without a trusted expected value.',
      ],
    });
  },
};

const contentMd5: HeaderFamily = {
  id: 'content-md5',
  header: 'Content-MD5',
  deprecated: 'Deprecated by RFC 7231 §3.3.2 — use Content-Digest or Repr-Digest instead.',
  parse(value) {
    const digest = value.trim();
    const issues: string[] = [];
    if (!/^[A-Za-z0-9+/]{22}==$/.test(digest))
      issues.push('Expected a base64-encoded 16-byte MD5 digest');
    return result('Deprecated', 'Legacy MD5 checksum of the entity body', {
      details: [`digest=${digest || '(empty)'}`],
      issues,
      notes: [
        'Content-MD5 is a legacy checksum, not an authenticity mechanism; prefer Content-Digest or a cryptographic signature.',
      ],
    });
  },
};

const networkErrorLogging: HeaderFamily = {
  id: 'network-error-logging',
  header: 'Network-Error-Logging',
  multiline: true,
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    let policy: Record<string, unknown> | null = null;
    try {
      policy = JSON.parse(value) as Record<string, unknown>;
    } catch {
      issues.push('Policy must be valid JSON');
    }
    if (policy) {
      if (typeof policy !== 'object' || policy === null || Array.isArray(policy)) {
        issues.push('Policy must be a JSON object');
        policy = null;
      } else {
        for (const [key, entry] of Object.entries(policy)) {
          details.push(`${key}=${String(entry)}`);
        }
        if (!('report_to' in policy)) issues.push('Missing required field report_to');
        else if (typeof policy.report_to !== 'string' || !String(policy.report_to).trim())
          issues.push('report_to must be a non-empty string naming a reporting endpoint group');
        if (!('max_age' in policy)) issues.push('Missing required field max_age');
        else if (
          typeof policy.max_age !== 'number' ||
          !Number.isInteger(policy.max_age) ||
          (policy.max_age as number) < 0
        )
          issues.push('max_age must be a non-negative integer number of seconds');
        if ('include_subdomains' in policy && typeof policy.include_subdomains !== 'boolean')
          issues.push('include_subdomains must be a boolean');
        if (
          'failure_mode' in policy &&
          policy.failure_mode !== 'fail-open' &&
          policy.failure_mode !== 'fail-closed'
        )
          issues.push('failure_mode must be fail-open or fail-closed');
        if ('success_fraction' in policy) {
          const fraction = policy.success_fraction;
          if (typeof fraction !== 'number' || (fraction as number) < 0 || (fraction as number) > 1)
            issues.push('success_fraction must be a number between 0 and 1');
        }
      }
    }
    return result(issues.length ? 'Invalid' : 'Valid', 'Reporting policy for network errors', {
      details,
      issues,
      notes: [
        'The report_to group must be configured with a Reporting-Endpoints header on the same origin.',
      ],
    });
  },
};

const reportingEndpoints: HeaderFamily = {
  id: 'reporting-endpoints',
  header: 'Reporting-Endpoints',
  parse(value) {
    const issues: string[] = [];
    const details: string[] = [];
    const names: string[] = [];
    for (const group of splitQuoted(value)) {
      const equals = group.indexOf('=');
      if (equals < 1) {
        issues.push(`Malformed endpoint group: ${group}`);
        continue;
      }
      const name = group.slice(0, equals).trim();
      const rest = group.slice(equals + 1).trim();
      names.push(name);
      let url = '';
      let priority = '';
      for (const part of splitParams(rest)) {
        const priorityMatch = /^priority\s*=\s*(\d+)$/i.exec(part);
        if (priorityMatch) {
          priority = priorityMatch[1] ?? '';
          continue;
        }
        if (part.startsWith('"') && part.lastIndexOf('"') > 0) {
          url = part.slice(1, part.lastIndexOf('"'));
          continue;
        }
        issues.push(`Unrecognized parameter in endpoint: ${part}`);
      }
      details.push(`group=${name}`, `url=${url || '(none)'}`);
      if (priority) details.push(`priority=${priority}`);
      if (!/^[a-z][a-z0-9-]*$/i.test(name)) issues.push(`Invalid group name: ${name}`);
      if (!url) issues.push('A quoted report URL is required');
      else if (!/^https:\/\//i.test(url) && !/^http:\/\/localhost(?::\d+)?\//i.test(url))
        issues.push('Reporting endpoint URLs must use https (or http only for localhost)');
      if (priority && Number(priority) > 255)
        issues.push('priority must be an integer from 0 to 255');
    }
    if (!names.length) issues.push('No endpoint groups were provided');
    if (duplicatesOf(names).length)
      issues.push(`Duplicate group names: ${duplicatesOf(names).join(', ')}`);
    return result(issues.length ? 'Review' : 'Valid', 'Declares reporting endpoint groups', {
      details,
      issues,
      notes: [
        'Browsers send reports (for example CSP violations) to these endpoints; each group needs a distinct HTTPS URL.',
      ],
    });
  },
};

const sunset: HeaderFamily = {
  id: 'sunset',
  header: 'Sunset',
  parse(value) {
    const raw = value.trim();
    const match = /^(Sunset|Deprecation)\s*:\s*(.*)$/i.exec(raw);
    const body = match ? (match[2] ?? '').trim() : raw;
    const issues: string[] = [];
    if (match && (match[1] ?? '').toLowerCase() !== 'sunset')
      issues.push(`Header name mismatch: expected Sunset but found ${match[1]}`);
    const date = body.split(';')[0]?.trim() ?? '';
    issues.push(...httpDateIssues(date, 'Sunset'));
    const link = /link\s*=\s*<([^>]*)>/i.exec(body)?.[1] ?? '';
    const details = [`date=${date || '(none)'}`];
    if (link) details.push(`link=${link}`);
    return result(
      issues.length ? 'Review' : 'Valid',
      'Announces when the resource will be removed',
      {
        details,
        issues,
        notes: [
          'Sunset announces planned removal; clients should treat the URL as unreliable after the date.',
        ],
      },
    );
  },
};

const deprecation: HeaderFamily = {
  id: 'deprecation',
  header: 'Deprecation',
  parse(value) {
    const raw = value.trim();
    const match = /^(Sunset|Deprecation)\s*:\s*(.*)$/i.exec(raw);
    const body = match ? (match[2] ?? '').trim() : raw;
    const issues: string[] = [];
    if (match && (match[1] ?? '').toLowerCase() !== 'deprecation')
      issues.push(`Header name mismatch: expected Deprecation but found ${match[1]}`);
    const date = body.split(';')[0]?.trim() ?? '';
    issues.push(...httpDateIssues(date, 'Deprecation'));
    const link = /link\s*=\s*<([^>]*)>/i.exec(body)?.[1] ?? '';
    const details = [`date=${date || '(none)'}`];
    if (link) details.push(`link=${link}`);
    return result(issues.length ? 'Review' : 'Valid', 'Signals that the resource is deprecated', {
      details,
      issues,
      notes: [
        'Deprecation signals functionality that still works but is slated for removal; use the Link to guide migration.',
      ],
    });
  },
};

const speculationRules: HeaderFamily = {
  id: 'speculation-rules',
  header: 'Speculation-Rules',
  multiline: true,
  parse(value) {
    const text = value.trim();
    if (/^https?:\/\/\S+$/i.test(text) || /^\/(?:[^/]|$).*$/.test(text))
      return result('Valid', 'Points at an external speculation rules file', {
        details: [`url=${text}`],
        notes: [
          'The browser resolves external rules files; this tool never fetches them (on-device only).',
        ],
      });
    const normalized = text
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      return result('Invalid', 'Speculation rules must be valid JSON', {
        issues: [
          'Invalid JSON — rules must be a JSON object of "prefetch" and/or "prerender" arrays.',
        ],
      });
    }
    const issues: string[] = [];
    const details: string[] = [];
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return result('Invalid', 'Speculation rules must be a JSON object', {
        issues: ['Top-level value must be a JSON object'],
      });
    }
    const root = parsed as Record<string, unknown>;
    for (const key of Object.keys(root)) {
      if (key !== 'prefetch' && key !== 'prerender')
        issues.push(`Top-level key "${key}" is not supported (use "prefetch"/"prerender")`);
    }
    if (!('prefetch' in root) && !('prerender' in root))
      issues.push('At least one of "prefetch" or "prerender" is required');
    for (const kind of ['prefetch', 'prerender'] as const) {
      if (!(kind in root)) continue;
      const list = root[kind];
      if (!Array.isArray(list)) {
        issues.push(`${kind}: must be an array of rules`);
        continue;
      }
      for (const rule of list) {
        if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
          issues.push(`${kind}: each entry must be a rule object`);
          continue;
        }
        const entry = rule as Record<string, unknown>;
        const urls = Array.isArray(entry.urls) ? entry.urls : [];
        details.push(`${kind}=${urls.length} url(s)`);
        if (entry.source === 'document' && 'urls' in entry)
          issues.push(`${kind}: "urls" is only allowed with source "list"`);
        if (entry.source === 'list' && !('urls' in entry))
          issues.push(`${kind}: "source":"list" requires a "urls" array`);
        if (
          entry.eagerness &&
          !['immediate', 'eager', 'moderate', 'conservative'].includes(String(entry.eagerness))
        )
          issues.push(`${kind}: invalid eagerness "${String(entry.eagerness)}"`);
      }
    }
    return result(issues.length ? 'Review' : 'Valid', 'Prefetch and prerender rules', {
      details,
      issues,
      notes: [
        'Prerender uses more resources than prefetch; keep prerender targets to critical next pages.',
      ],
    });
  },
};

const xRobotsTag: HeaderFamily = {
  id: 'x-robots-tag',
  header: 'X-Robots-Tag',
  parse(value) {
    const known = new Set([
      'index',
      'noindex',
      'follow',
      'nofollow',
      'noarchive',
      'nocache',
      'nosnippet',
      'noimageindex',
      'unavailable_after',
      'max-snippet',
      'max-image-preview',
      'max-video-preview',
      'indexifembedded',
      'notranslate',
    ]);
    const issues: string[] = [];
    const details: string[] = [];
    const groups = splitList(value);
    const allDirectives: string[] = [];
    if (!groups.length) issues.push('No directives were provided');
    for (const group of groups) {
      const colon = group.indexOf(':');
      const agent = colon > 0 ? group.slice(0, colon).trim() : '';
      const body = colon > 0 ? group.slice(colon + 1).trim() : group.trim();
      details.push(`directive=${body}${agent ? ` (agent: ${agent})` : ''}`);
      const directives = body
        .split(',')
        .map((directive) => directive.trim())
        .filter(Boolean);
      allDirectives.push(...directives);
      for (const directive of directives) {
        const key = directive.split(':')[0]?.trim() ?? '';
        if (!known.has(key.toLowerCase())) issues.push(`Unknown directive: ${directive}`);
      }
    }
    const lower = allDirectives.map((directive) => directive.toLowerCase());
    if (lower.includes('index') && lower.includes('noindex'))
      issues.push('Conflicting directives: index and noindex');
    if (lower.includes('follow') && lower.includes('nofollow'))
      issues.push('Conflicting directives: follow and nofollow');
    if (lower.includes('indexifembedded') && !lower.includes('noindex'))
      issues.push('indexifembedded only makes sense alongside noindex');
    return result(issues.length ? 'Review' : 'Valid', 'Per-URL indexing directives', {
      details,
      issues,
      notes: ['X-Robots-Tag complements the site-wide robots.txt for this URL.'],
    });
  },
};

/* -------------------------------------------------------------------------- */
/*  Registry                                                                  */
/* -------------------------------------------------------------------------- */

export const FAMILIES: HeaderFamily[] = [
  altUsed,
  allow,
  altSvc,
  acceptCh,
  connection,
  contentDigest,
  contentMd5,
  criticalCh,
  dateHeader,
  deprecation,
  earlyData,
  expect,
  forwarded,
  link,
  networkErrorLogging,
  origin,
  prefer,
  priority,
  reportingEndpoints,
  retryAfter,
  serverTiming,
  signatureInput,
  speculationRules,
  sunset,
  timingAllowOrigin,
  traceparent,
  tracestate,
  trailer,
  upgrade,
  via,
  warning,
  xRobotsTag,
];

export const FAMILY_BY_ID = new Map(FAMILIES.map((family) => [family.id, family]));

export const FAMILY_BY_HEADER = (() => {
  const map = new Map<string, HeaderFamily>();
  for (const family of FAMILIES) {
    map.set(family.header.toLowerCase(), family);
    for (const alias of family.aliases ?? []) map.set(alias.toLowerCase(), family);
  }
  return map;
})();

/** Case-insensitive lookup of a family by its header name. */
export function findFamily(headerName: string): HeaderFamily | undefined {
  return FAMILY_BY_HEADER.get(headerName.trim().toLowerCase());
}
