import type { OptionValues, TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cache-headers.meta';

/**
 * Unified cache-header builder/analyzer.
 *
 * Seven legacy tools (cache-control, cdn-cache-control, surrogate-control,
 * expires-header, age-header, cache-status, vary-header) delegate here with a
 * family pre-selected, so their original `/tools/<id>` URLs keep working and
 * keep the exact behaviour they shipped with.
 */

export type HeaderFamily =
  | 'cache-control'
  | 'cdn-cache-control'
  | 'surrogate-control'
  | 'expires'
  | 'age'
  | 'cache-status'
  | 'vary';

const FAMILIES: readonly HeaderFamily[] = [
  'cache-control',
  'cdn-cache-control',
  'surrogate-control',
  'expires',
  'age',
  'cache-status',
  'vary',
];

function isFamily(value: string): value is HeaderFamily {
  return (FAMILIES as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/*  Cache-Control                                                             */
/* -------------------------------------------------------------------------- */

type Directive = { name: string; value?: string };
const CC_TOKEN = /^[a-z][a-z0-9-]*$/i;

function parseCacheControl(text: string): { directives: Directive[]; issues: string[] } {
  const directives: Directive[] = [];
  const issues: string[] = [];
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const equals = part.indexOf('=');
    const name = (equals < 0 ? part : part.slice(0, equals)).trim().toLowerCase();
    const value = equals < 0 ? undefined : part.slice(equals + 1).trim();
    if (!CC_TOKEN.test(name)) {
      issues.push(`Invalid directive name: ${name}`);
      continue;
    }
    if (value !== undefined && !/^\d+$/.test(value) && !/^"[^"\r\n]*"$/.test(value))
      issues.push(`Invalid value for ${name}`);
    directives.push({ name, ...(value !== undefined ? { value } : {}) });
  }
  const names = directives.map((directive) => directive.name);
  const has = (name: string) => names.includes(name);
  if (has('no-store') && (has('public') || has('max-age') || has('s-maxage')))
    issues.push('no-store conflicts with cache lifetime directives');
  if (has('private') && has('public')) issues.push('private and public are contradictory');
  if (has('immutable') && !has('max-age') && !has('s-maxage'))
    issues.push('immutable is most useful with a positive freshness lifetime');
  if (new Set(names).size !== names.length) issues.push('Duplicate directives are present');
  return { directives, issues };
}

function runCacheControl(input: TextRunInput, options: OptionValues): TextRunResult {
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Cache-Control mode.');
  if (mode === 'build') {
    const maxAge = Number(options.maxAge);
    const sMaxAge = Number(options.sMaxAge);
    const stale = Number(options.staleWhileRevalidate);
    if (![maxAge, sMaxAge, stale].every((value) => Number.isInteger(value) && value >= 0))
      throw new ToolError('Cache lifetimes must be non-negative whole numbers.');
    const visibility = String(options.visibility);
    if (!['public', 'private'].includes(visibility)) throw new ToolError('Choose public or private visibility.');
    const directives: string[] = [visibility];
    if (options.noStore) directives.push('no-store');
    if (options.noCache) directives.push('no-cache');
    if (maxAge > 0) directives.push(`max-age=${maxAge}`);
    if (sMaxAge > 0) directives.push(`s-maxage=${sMaxAge}`);
    if (options.mustRevalidate) directives.push('must-revalidate');
    if (options.immutable) directives.push('immutable');
    if (stale > 0) directives.push(`stale-while-revalidate=${stale}`);
    const result = parseCacheControl(directives.join(', '));
    return {
      output: directives.join(', '),
      render: 'code',
      language: 'http',
      filename: 'cache-control.txt',
      stats: { directives: directives.length, issues: result.issues.length },
      notes: ['Header semantics depend on response content, authorization, and cache topology.'],
    };
  }
  if (input.text.length > 100_000)
    throw new ToolError('Header input is too large.', 'Paste a Cache-Control value under 100 KB.');
  const lines = input.text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length)
    return {
      output: JSON.stringify({ headers: ['Directive', 'Value', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste a Cache-Control value to analyze.'],
    };
  const results = lines.map((line) => parseCacheControl(line));
  const rows = results.flatMap((result, index) =>
    result.directives.length
      ? result.directives.map((directive) => [
          directive.name,
          directive.value ?? '',
          result.issues.join('; ') || 'No local issues detected',
        ])
      : [[`line ${index + 1}`, '', result.issues.join('; ') || 'No directives found']],
  );
  return {
    output: JSON.stringify({ headers: ['Directive', 'Value', 'Assessment'], rows }),
    render: 'table',
    stats: {
      headers: lines.length,
      issues: results.reduce((count, result) => count + result.issues.length, 0),
    },
    notes: ['This is a local heuristic review; it cannot determine whether your response content is safe to cache.'],
  };
}

/* -------------------------------------------------------------------------- */
/*  CDN-Cache-Control & Surrogate-Control                                     */
/* -------------------------------------------------------------------------- */

const DIRECTIVE_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const CDN_SECONDS = new Set([
  'max-age',
  's-maxage',
  'stale-while-revalidate',
  'stale-if-error',
  'min-fresh',
  'max-stale',
]);

function splitDirectives(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (char === ',' && !quoted) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function inspectCdn(text: string): { directives: [string, string | null][]; issues: string[] } {
  const directives: [string, string | null][] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const part of splitDirectives(text)) {
    const index = part.indexOf('=');
    const name = (index < 0 ? part : part.slice(0, index)).trim().toLowerCase();
    const value = index < 0 ? null : part.slice(index + 1).trim();
    if (!DIRECTIVE_TOKEN.test(name)) issues.push(`Invalid directive token: ${name}`);
    if (seen.has(name)) issues.push(`Duplicate directive: ${name}`);
    seen.add(name);
    if (value !== null && !value) issues.push(`Directive ${name} has an empty value`);
    if (CDN_SECONDS.has(name) && value !== null && !/^\d+$/.test(value.replace(/^"|"$/g, '')))
      issues.push(`${name} must be a non-negative integer number of seconds`);
    if (name === 'no-store' && value !== null) issues.push('no-store does not take a value');
    if (name === 'public' && value !== null) issues.push('public does not take a value');
    directives.push([name, value]);
  }
  if (seen.has('no-store') && ['public', 'max-age', 's-maxage'].some((name) => seen.has(name)))
    issues.push('no-store conflicts with directives that permit storage or freshness');
  return { directives, issues };
}

function inspectSurrogate(text: string): { directives: [string, string | null][]; issues: string[] } {
  const directives: [string, string | null][] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const part of splitDirectives(text)) {
    const index = part.indexOf('=');
    const name = (index < 0 ? part : part.slice(0, index)).trim().toLowerCase();
    const value = index < 0 ? null : part.slice(index + 1).trim();
    if (!DIRECTIVE_TOKEN.test(name)) issues.push(`Invalid directive token: ${name}`);
    if (seen.has(name)) issues.push(`Duplicate directive: ${name}`);
    seen.add(name);
    if (value !== null && !value) issues.push(`Directive ${name} has an empty value`);
    if (name === 'max-age' && value !== null && !/^\d+$/.test(value.replace(/^"|"$/g, '')))
      issues.push('max-age must be a non-negative integer number of seconds');
    if (name === 'content' && (!value?.startsWith('"') || !value.endsWith('"')))
      issues.push('content must be a quoted value');
    if (name === 'no-store' && value !== null) issues.push('no-store does not take a value');
    directives.push([name, value]);
  }
  if (seen.has('no-store') && seen.has('max-age'))
    issues.push('no-store conflicts with max-age because one forbids storage while the other sets freshness');
  return { directives, issues };
}

function runDirectives(
  family: 'cdn-cache-control' | 'surrogate-control',
  input: TextRunInput,
  options: OptionValues,
): TextRunResult {
  const mode = String(options.mode);
  const label = family === 'cdn-cache-control' ? 'CDN-Cache-Control' : 'Surrogate-Control';
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError(`Choose a supported ${label} mode.`);
  const optionKey = family === 'cdn-cache-control' ? 'cdnDirectives' : 'surrogateDirectives';
  const raw = options[optionKey] ?? options.directives ?? '';
  const value = mode === 'build' ? String(raw) : input.text;
  const inspect = family === 'cdn-cache-control' ? inspectCdn : inspectSurrogate;
  if (mode === 'build') {
    const result = inspect(value);
    if (!result.directives.length || result.issues.length)
      throw new ToolError(result.issues[0] ?? 'Enter at least one cache directive.');
    return {
      output: result.directives
        .map(([name, directiveValue]) => (directiveValue === null ? name : `${name}=${directiveValue}`))
        .join(', '),
      render: 'code',
      language: 'http',
      filename: family === 'cdn-cache-control' ? 'cdn-cache-control.txt' : 'surrogate-control.txt',
      stats: { directives: result.directives.length },
    };
  }
  if (!value.trim())
    return {
      output: JSON.stringify({ headers: ['Directive', 'Value', 'Status'], rows: [] }),
      render: 'table',
      notes: [`Paste comma-separated ${label} directives.`],
    };
  const result = inspect(value);
  const rows = result.directives.map(([name, directiveValue]) => [
    name,
    directiveValue ?? '',
    result.issues.length ? 'Review' : 'Valid',
  ]);
  return {
    output: JSON.stringify({ headers: ['Directive', 'Value', 'Status'], rows }),
    render: 'table',
    stats: { directives: result.directives.length, issues: result.issues.length },
    notes: result.issues.length
      ? result.issues
      : [
          family === 'cdn-cache-control'
            ? 'CDN-Cache-Control behavior depends on CDN support and precedence; verify provider semantics and cache privacy.'
            : 'Surrogate-Control targets intermediary caches; browsers generally ignore it. Verify provider support and cache privacy.',
        ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Expires                                                                   */
/* -------------------------------------------------------------------------- */

const IMF =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

function inspectExpires(value: string): { date: string; issues: string[] } {
  const date = value.trim();
  const issues: string[] = [];
  if (!IMF.test(date)) {
    const parsed = Date.parse(date);
    issues.push(
      Number.isNaN(parsed)
        ? 'Invalid HTTP-date; expected IMF-fixdate such as Wed, 21 Oct 2030 07:28:00 GMT'
        : 'Use IMF-fixdate; this appears to be an obsolete HTTP-date form',
    );
  } else {
    const parsed = Date.parse(date);
    if (Number.isNaN(parsed)) issues.push('Invalid calendar date');
    else if (parsed < Date.now()) issues.push('Expiration date is in the past; response is already stale');
    else if (parsed > Date.now() + 315360000000)
      issues.push('Expiration is more than ten years away; verify cache policy');
  }
  return { date, issues };
}

function runExpires(input: TextRunInput, options: OptionValues): TextRunResult {
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Expires mode.');
  const result = inspectExpires(mode === 'build' ? String(options.date) : input.text);
  if (mode === 'build') {
    if (result.issues.length) throw new ToolError(result.issues[0]!);
    return {
      output: result.date,
      render: 'code',
      language: 'http',
      filename: 'expires.txt',
      stats: { format: 'IMF-fixdate' },
    };
  }
  const values = input.text
    .split(/\r\n|\r|\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.length)
    return {
      output: JSON.stringify({ headers: ['Date', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste one Expires HTTP-date value.'],
    };
  const rows = values.map((value) => {
    const inspected = inspectExpires(value);
    return [
      value,
      inspected.issues.some((issue) => issue.startsWith('Invalid'))
        ? 'Invalid'
        : inspected.issues.length
          ? 'Review'
          : 'Valid',
      inspected.issues.join('; ') || 'IMF-fixdate',
    ];
  });
  return {
    output: JSON.stringify({ headers: ['Date', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      dates: values.length,
      invalid: rows.filter((row) => row[1] === 'Invalid').length,
      review: rows.filter((row) => row[1] === 'Review').length,
    },
    notes: ['Cache-Control max-age or s-maxage generally overrides Expires when both are present.'],
  };
}

/* -------------------------------------------------------------------------- */
/*  Age                                                                       */
/* -------------------------------------------------------------------------- */

function runAge(input: TextRunInput, options: OptionValues): TextRunResult {
  const mode = String(options.mode);
  if (mode !== 'analyze' && mode !== 'build') throw new ToolError('Choose a supported mode.');
  const source = mode === 'build' ? String(options.seconds) : input.text.trim();
  if (mode === 'analyze' && !source)
    return {
      output: JSON.stringify({ headers: ['Age', 'Status', 'Comment'], rows: [] }),
      render: 'table',
      notes: ['Paste a non-negative integer number of seconds from a cache Age header.'],
    };
  if (!/^\d+$/.test(source))
    throw new ToolError(
      mode === 'build'
        ? 'Enter a non-negative integer amount of seconds.'
        : 'Age value must be a non-negative integer (delta-seconds).',
    );
  const delta = Number(source);
  if (mode === 'build')
    return { output: `Age: ${delta}`, render: 'code', language: 'http', filename: 'age-header.txt', stats: { age: delta } };
  const status =
    delta === 0 ? 'fresh' : delta < 3600 ? 'recent' : delta < 86400 ? 'moderate' : delta <= 604800 ? 'old' : 'stale';
  const comment =
    delta > 604800
      ? 'Exceeds a week — verify against max-age'
      : delta >= 1
        ? 'Compare to Cache-Control max-age to gauge freshness'
        : 'Just generated';
  return {
    output: JSON.stringify({ headers: ['Age', 'Status', 'Comment'], rows: [[delta.toString(), status, comment]] }),
    render: 'table',
    stats: { valid: 'yes', age: delta, status },
    notes: ['Age tells how long a cached object was held; use it with Cache-Control to judge freshness.'],
  };
}

/* -------------------------------------------------------------------------- */
/*  Cache-Status (RFC 9211)                                                   */
/* -------------------------------------------------------------------------- */

const CACHE_STATUS_TOKEN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

function splitMembers(field: string): string[] {
  const members: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of field) {
    if (inQuotes) {
      if (char === '"') inQuotes = false;
      current += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      current += char;
      continue;
    }
    if (char === ';' && current.trim()) {
      members.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) members.push(current.trim());
  return members;
}

function splitParams(member: string): string[] {
  const params: string[] = [member];
  let current = '';
  let inQuotes = false;
  for (const char of member) {
    if (inQuotes) {
      if (char === '"') inQuotes = false;
      current += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      current += char;
      continue;
    }
    if (char === ';' && current.trim()) {
      params.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) params.push(current.trim());
  return params;
}

function inspectCacheStatusMember(member: string): {
  name: string;
  value: string;
  status: 'Valid' | 'Warn' | 'Unknown';
  note: string;
} {
  const cleaned = member.trim();
  const eq = cleaned.indexOf('=');
  const eqName = (eq >= 0 ? cleaned.slice(0, eq) : cleaned).trim();
  const eqValue = eq >= 0 ? cleaned.slice(eq + 1) : '';
  const lowerName = eqName.toLowerCase();
  const stripQuotes = (raw: string) => raw.trim().replace(/^"|"$/g, '');
  if (
    ['hit', 'pass', 'stored', 'stale', 'collapsed', 'partial', 'waiting'].includes(lowerName) &&
    !eqValue
  )
    return {
      name: eqName,
      value: '',
      status: 'Valid',
      note: `Cache ${lowerName}: ${
        lowerName === 'hit'
          ? 'served a hit'
          : lowerName === 'pass'
            ? 'passed through without reuse'
            : lowerName === 'stored'
              ? 'stored the response'
              : lowerName === 'stale'
                ? 'reused while stale'
                : lowerName === 'collapsed'
                  ? 'collapsed a request'
                  : lowerName === 'partial'
                    ? 'served a partial response'
                    : 'waited for a revalidation'
      }`,
    };
  if (lowerName === 'miss')
    return {
      name: eqName,
      value: !eqValue ? 'pragma' : stripQuotes(eqValue),
      status: 'Valid',
      note: `miss: the cache did not have a fresh copy${eqValue ? ` with revalidation reason "${stripQuotes(eqValue)}"` : ' (plain miss)'}`,
    };
  if (lowerName === 'ttl') {
    const v = eqValue.trim();
    if (!v) return { name: eqName, value: '', status: 'Warn', note: 'ttl declares a lifetime in seconds; provide like ttl=60' };
    if (v.startsWith('dt=')) {
      const days = v.slice(3);
      if (!/^\d+$/.test(days))
        return { name: eqName, value: v, status: 'Warn', note: 'ttl dt= value should be an integer of days' };
      return { name: eqName, value: v, status: 'Valid', note: `ttl dt=${days} days ≈ ${Number(days) * 86400}s` };
    }
    if (!/^\d+$/.test(v))
      return { name: eqName, value: v, status: 'Warn', note: 'ttl expects a non-negative integer (e.g. ttl=60)' };
    return {
      name: eqName,
      value: v,
      status: 'Valid',
      note: `ttl=${v}s — for roughly ${Math.round((Number(v) / 86400) * 10) / 10} days`,
    };
  }
  if (lowerName === 'fwd') {
    if (!eqValue)
      return {
        name: eqName,
        value: '',
        status: 'Warn',
        note: 'fwd declares forwarding during a miss; commonly fwd=urlll, fwd=req, fwd=stale',
      };
    const reason = stripQuotes(eqValue);
    if (['urlll', 'stale', 'req', 'immutable', 'req-title', 'cli'].includes(reason))
      return { name: eqName, value: reason, status: 'Valid', note: `Forwarded with reason "${reason}"` };
    const params = splitParams(eqValue).slice(1);
    return {
      name: eqName,
      value: reason,
      status: params.length ? 'Valid' : 'Unknown',
      note: params.length
        ? `Forwarded with reason "${reason}" plus parameters`
        : `Forwarding reason "${reason}" is not one of the defined values (req, stale, urlll, immutable, etc.)`,
    };
  }
  if (/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(lowerName) && eqValue)
    return {
      name: eqName,
      value: stripQuotes(eqValue),
      status: 'Warn',
      note: `Implementation-defined parameter "${eqName}" with value "${stripQuotes(eqValue)}"`,
    };
  return {
    name: eqName,
    value: stripQuotes(eqValue),
    status: eqValue ? 'Warn' : 'Unknown',
    note: eqValue
      ? `Unrecognized parameter "${eqName}" — behavior is implementation-defined`
      : `Unrecognized marker "${eqName}" — behavior is implementation-defined`,
  };
}

function analyzeCacheStatus(text: string): { rows: string[][]; issues: number; summary: string } {
  const trimmed = text.trim();
  const firstSemi = trimmed.indexOf(';');
  const cacheName = firstSemi >= 0 ? trimmed.slice(0, firstSemi).trim() : trimmed;
  if (!cacheName) return { rows: [], issues: 1, summary: 'No Cache-Status header value provided.' };
  const rest = firstSemi >= 0 ? trimmed.slice(firstSemi + 1) : '';
  let issues = 0;
  const rows = splitMembers(rest).map((member) => {
    const inspected = inspectCacheStatusMember(member);
    if (inspected.status === 'Unknown' || inspected.status === 'Warn') issues++;
    return [inspected.name, inspected.value || '(none)', inspected.status, inspected.note];
  });
  return { rows, issues, summary: `${cacheName} report:` };
}

function runCacheStatus(input: TextRunInput, options: OptionValues): TextRunResult {
  const mode = String(options.mode);
  if (mode !== 'analyze' && mode !== 'build') throw new ToolError('Choose a supported mode.');
  if (mode === 'build') {
    const cc = String(options.cc).trim();
    const hit = String(options.hit);
    const ttl = String(options.ttl).trim();
    const fwd = String(options.fwd).trim();
    if (!cc || !CACHE_STATUS_TOKEN.test(cc))
      throw new ToolError('Cache name must be a non-empty structured-field token.');
    const members = [cc, hit];
    if (ttl) members.push(`ttl=${ttl}`);
    if (fwd) members.push(`fwd=${CACHE_STATUS_TOKEN.test(fwd) ? fwd : `"${fwd}"`}`);
    return {
      output: members.join('; '),
      render: 'code',
      language: 'http',
      filename: 'cache-status.txt',
      stats: { cache: cc, result: hit, ttl: ttl || 'n/a' },
    };
  }
  if (!input.text.trim())
    return {
      output: JSON.stringify({ headers: ['Parameter', 'Value', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste a Cache-Status header value to analyze.'],
    };
  const inspected = analyzeCacheStatus(input.text);
  return {
    output: JSON.stringify({ headers: ['Parameter', 'Value', 'Status', 'Assessment'], rows: inspected.rows }),
    render: 'table',
    stats: { parameters: inspected.rows.length, issues: inspected.issues },
    notes: inspected.issues
      ? [inspected.summary + ' Flagged ' + inspected.issues + ' parameter(s).']
      : [inspected.summary + ' All parameters recognized.'],
  };
}

/* -------------------------------------------------------------------------- */
/*  Vary                                                                      */
/* -------------------------------------------------------------------------- */

const VARY_FIELD = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function analyzeVary(value: string): { fields: string[]; issues: string[] } {
  const fields = value
    .split(',')
    .map((field) => field.trim().toLowerCase())
    .filter(Boolean);
  const issues: string[] = [];
  if (!fields.length) issues.push('No fields were provided');
  if (fields.includes('*') && fields.length > 1) issues.push('Wildcard must not be combined with field names');
  if (fields.some((field) => !VARY_FIELD.test(field) && field !== '*'))
    issues.push('One or more fields are invalid header-name tokens');
  if (new Set(fields).size !== fields.length) issues.push('Duplicate fields are present');
  if (fields.includes('authorization')) issues.push('Vary does not replace private/no-store authorization cache controls');
  return { fields, issues };
}

function runVary(input: TextRunInput, options: OptionValues): TextRunResult {
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported Vary mode.');
  const source = mode === 'build' ? String(options.fields) : input.text;
  const result = analyzeVary(source);
  if (mode === 'build') {
    if (result.issues.length) throw new ToolError(result.issues[0]!);
    return {
      output: result.fields.join(', '),
      render: 'code',
      language: 'http',
      filename: 'vary.txt',
      stats: { fields: result.fields.length, wildcard: result.fields.includes('*') ? 'yes' : 'no' },
    };
  }
  if (!result.fields.length)
    return {
      output: JSON.stringify({ headers: ['Field', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste Vary field names separated by commas.'],
    };
  const rows = result.fields.map((field) => [
    field,
    result.issues.length ? 'Review' : 'Valid',
    field === '*'
      ? 'Wildcard disables normal shared-cache reuse'
      : field === 'authorization'
        ? 'Use explicit private/no-store policy as needed'
        : 'Included in cache key',
  ]);
  return {
    output: JSON.stringify({ headers: ['Field', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      fields: result.fields.length,
      issues: result.issues.length,
      wildcard: result.fields.includes('*') ? 'yes' : 'no',
    },
    notes: result.issues.length ? result.issues : ['Vary only describes cache variation; it does not authorize cache reuse.'],
  };
}

/* -------------------------------------------------------------------------- */
/*  Dispatch                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Render a result for one header family using already-resolved options.
 * Legacy single-header tools call this directly with their own meta-resolved
 * options so their defaults and behaviour are preserved exactly.
 */
export function renderFamily(family: string, input: TextRunInput, options: OptionValues): TextRunResult {
  if (!isFamily(family)) throw new ToolError('Choose a supported cache header family.');
  switch (family) {
    case 'cache-control':
      return runCacheControl(input, options);
    case 'cdn-cache-control':
    case 'surrogate-control':
      return runDirectives(family, input, options);
    case 'expires':
      return runExpires(input, options);
    case 'age':
      return runAge(input, options);
    case 'cache-status':
      return runCacheStatus(input, options);
    case 'vary':
      return runVary(input, options);
  }
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  return renderFamily(String(options.header), input, options);
}

const tool: TextToolModule = { meta, run };
export default tool;
