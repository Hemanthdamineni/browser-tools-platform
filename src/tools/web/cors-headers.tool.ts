import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cors-headers.meta';

/**
 * Unified CORS response-header tool. It replaces the five separate
 * `access-control-*` builders/analyzers (their ids are kept as redirect
 * aliases) and can emit either one header or a complete, copyable policy.
 */

const TARGETS = [
  'all',
  'allow-origin',
  'allow-credentials',
  'allow-methods',
  'allow-headers',
  'expose-headers',
  'max-age',
] as const;
type Target = (typeof TARGETS)[number];

type Field = 'origin' | 'credentials' | 'methods' | 'allowHeaders' | 'expose' | 'maxAge';

/** Which builder fields feed each target. */
const BUILD_FIELDS: Record<Target, Field[]> = {
  all: ['origin', 'credentials', 'methods', 'allowHeaders', 'expose', 'maxAge'],
  'allow-origin': ['origin'],
  'allow-credentials': ['credentials'],
  'allow-methods': ['methods'],
  'allow-headers': ['allowHeaders'],
  'expose-headers': ['expose'],
  'max-age': ['maxAge'],
};

const ORIGIN_RE = /^(https?:\/\/[^\s"']+|\*)$/i;
const METHOD_RE = /^[A-Za-z][A-Za-z0-9-]*$/;
const ALLOW_HEADER_RE = /^[A-Za-z0-9-]+(\*)?$/;
const EXPOSE_HEADER_RE = /^[A-Za-z0-9-]+$/;
const SECONDS_RE = /^[0-9]+$/;
const MAX_INPUT = 100_000;

const KNOWN_HEADERS = new Set([
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'access-control-max-age',
]);
const TABLE_HEADERS = ['Header', 'Value', 'Status', 'Assessment'];

function isTarget(value: string): value is Target {
  return (TARGETS as readonly string[]).includes(value);
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 'yes' || value === 'on' || value === 1;
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function inspectOrigin(value: string, credentials: boolean): { value: string; issues: string[] } {
  const trimmed = value.trim();
  const issues: string[] = [];
  if (!trimmed) issues.push('Enter an allowed origin (* or a full http(s) origin).');
  else if (!ORIGIN_RE.test(trimmed))
    issues.push('Allowed origin must be * or a single http(s) origin.');
  else if (trimmed === '*' && credentials)
    issues.push('Access-Control-Allow-Origin cannot be * when credentials are allowed.');
  else if (trimmed.includes(','))
    issues.push(
      'Multiple origins are not valid in one header; echo the requesting origin and add Vary: Origin.',
    );
  return { value: trimmed, issues };
}

function inspectCredentials(value: string): { token: string; issues: string[] } {
  const token = value.trim().toLowerCase();
  const issues: string[] = [];
  if (!token) issues.push('No Access-Control-Allow-Credentials value provided.');
  else if (token === 'false')
    issues.push('Access-Control-Allow-Credentials accepts only true; omit the header instead.');
  else if (token !== 'true')
    issues.push('Access-Control-Allow-Credentials accepts only the value true.');
  return { token, issues };
}

function inspectTokens(
  items: string[],
  kind: 'method' | 'allow-header' | 'expose-header',
): string[] {
  const label = kind === 'method' ? 'method' : 'header';
  const pattern =
    kind === 'method' ? METHOD_RE : kind === 'allow-header' ? ALLOW_HEADER_RE : EXPOSE_HEADER_RE;
  const issues: string[] = [];
  if (!items.length) return [`Enter at least one ${label}.`];
  for (const item of items) {
    if (item !== '*' && !pattern.test(item)) issues.push(`Invalid ${label} token: ${item}`);
  }
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const item of items) {
    if (seen.has(item)) dupes.push(item);
    seen.add(item);
  }
  if (dupes.length) issues.push(`Duplicate ${label} tokens: ${[...new Set(dupes)].join(', ')}`);
  if (items.includes('*') && items.length > 1)
    issues.push(`The * wildcard makes the other ${label} tokens redundant.`);
  return issues;
}

function inspectMaxAge(value: string): {
  seconds: number | null;
  issues: string[];
  notes: string[];
} {
  const trimmed = value.trim();
  const issues: string[] = [];
  const notes: string[] = [];
  let seconds: number | null = null;
  if (!trimmed) issues.push('Enter a preflight cache time in seconds.');
  else if (trimmed.startsWith('-'))
    issues.push('Access-Control-Max-Age must be a non-negative number of seconds.');
  else if (!SECONDS_RE.test(trimmed))
    issues.push('Access-Control-Max-Age must be a non-negative whole number of seconds.');
  else {
    seconds = Number(trimmed);
    if (seconds > 604_800)
      issues.push(`${seconds}s is above one week; browsers cap and usually ignore larger values.`);
    else if (seconds > 3600)
      notes.push('Large value; most browsers apply a much shorter internal cap.');
  }
  return { seconds, issues, notes };
}

function buildHeaders(target: Target, options: OptionValues): { lines: string[]; notes: string[] } {
  const fields = BUILD_FIELDS[target];
  const credentialsRequested = target === 'allow-credentials' || asBool(options.credentials);
  const issues: string[] = [];
  const notes: string[] = [];
  const lines: string[] = [];

  if (fields.includes('origin')) {
    const origin = inspectOrigin(String(options.origin), credentialsRequested);
    issues.push(...origin.issues);
    if (!origin.issues.length) lines.push(`Access-Control-Allow-Origin: ${origin.value}`);
  }

  if (target === 'allow-credentials') {
    if (!asBool(options.credentials))
      issues.push(
        'Access-Control-Allow-Credentials only supports true; enable "Allow credentials".',
      );
    else lines.push('Access-Control-Allow-Credentials: true');
  } else if (fields.includes('credentials') && asBool(options.credentials)) {
    lines.push('Access-Control-Allow-Credentials: true');
  }

  if (fields.includes('methods')) {
    const values = splitList(String(options.methods));
    const found = inspectTokens(values, 'method');
    issues.push(...found);
    if (credentialsRequested && values.includes('*'))
      issues.push('Access-Control-Allow-Methods cannot be * when credentials are allowed.');
    if (!found.length) lines.push(`Access-Control-Allow-Methods: ${values.join(', ')}`);
  }

  if (fields.includes('allowHeaders')) {
    const values = splitList(String(options.headers));
    const found = inspectTokens(values, 'allow-header');
    issues.push(...found);
    if (credentialsRequested && values.includes('*'))
      issues.push('Access-Control-Allow-Headers cannot be * when credentials are allowed.');
    if (!found.length) lines.push(`Access-Control-Allow-Headers: ${values.join(', ')}`);
  }

  if (fields.includes('expose')) {
    const values = splitList(String(options.expose));
    const found = inspectTokens(values, 'expose-header');
    issues.push(...found);
    if (credentialsRequested && values.includes('*'))
      issues.push('Access-Control-Expose-Headers cannot be * when credentials are allowed.');
    if (!found.length) lines.push(`Access-Control-Expose-Headers: ${values.join(', ')}`);
  }

  if (fields.includes('maxAge')) {
    const inspected = inspectMaxAge(String(options.maxAge));
    issues.push(...inspected.issues);
    notes.push(...inspected.notes);
    if (inspected.seconds !== null && !inspected.issues.length)
      lines.push(`Access-Control-Max-Age: ${inspected.seconds}`);
  }

  if (issues.length) throw new ToolError(issues[0]!, 'Fix the value and run again.');
  if (!lines.length)
    throw new ToolError('Nothing to build.', 'Enable credentials or pick a header to emit.');

  const originLine = lines.find((line) => line.startsWith('Access-Control-Allow-Origin: '));
  if (originLine && !originLine.endsWith('*'))
    notes.push('Add "Vary: Origin" when the allowed origin is chosen per request.');
  if (lines.some((line) => line.startsWith('Access-Control-Allow-Methods: ')))
    notes.push('Allow-Methods and Allow-Headers answer the browser preflight (OPTIONS) request.');

  return { lines, notes };
}

function parseBlock(text: string): { name: string; value: string }[] {
  const entries: { name: string; value: string }[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    entries.push({
      name: line.slice(0, colon).trim().toLowerCase(),
      value: line.slice(colon + 1).trim(),
    });
  }
  return entries;
}

function assessOrigin(value: string, credentials: boolean): string[] {
  const { issues } = inspectOrigin(value, credentials);
  return issues;
}

function analyze(text: string): TextRunResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      output: JSON.stringify({ headers: TABLE_HEADERS, rows: [] }),
      render: 'table',
      notes: ['Paste CORS headers (one per line) or a single Allow-Origin value to analyze.'],
    };
  }

  const entries = parseBlock(text);
  const recognised = entries.filter((entry) => KNOWN_HEADERS.has(entry.name));
  const rows: string[][] = [];
  const issues: string[] = [];

  if (!recognised.length) {
    const bareLines = trimmed
      .split(/\r\n|\r|\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    // Legacy fallback 1: a column that starts with a whole number is a list of
    // Max-Age values (an origin never begins with digits).
    if (bareLines.length > 0 && /^-?\d+$/.test(bareLines[0] ?? '')) {
      for (const line of bareLines) {
        const inspected = inspectMaxAge(line);
        const found = inspected.issues;
        issues.push(...found.map((issue) => `Access-Control-Max-Age: ${issue}`));
        rows.push([
          'Access-Control-Max-Age',
          line,
          found.length ? 'Invalid' : 'Valid',
          found[0] ?? inspected.notes[0] ?? 'Preflight may be cached for this many seconds.',
        ]);
      }
      return {
        output: JSON.stringify({ headers: TABLE_HEADERS, rows }),
        render: 'table',
        stats: { headers: rows.length, issues: issues.length },
        notes: issues.length
          ? issues
          : ['Browsers cap the preflight cache individually; keep the value modest.'],
      };
    }

    // Legacy fallback 2: any other bare value is treated as Allow-Origin.
    const found = assessOrigin(trimmed, false);
    issues.push(...found.map((issue) => `Access-Control-Allow-Origin: ${issue}`));
    rows.push([
      'Access-Control-Allow-Origin',
      trimmed,
      found.length ? 'Invalid' : 'Valid',
      found[0] ??
        (trimmed === '*'
          ? 'Allows any non-credentialed origin to read the response'
          : 'Allows only this origin to read the response'),
    ]);
    return {
      output: JSON.stringify({ headers: TABLE_HEADERS, rows }),
      render: 'table',
      stats: { headers: rows.length, issues: issues.length },
      notes: issues.length ? issues : ['No obvious CORS misconfigurations detected.'],
    };
  }

  const credentialsTrue = recognised.some(
    (entry) =>
      entry.name === 'access-control-allow-credentials' && entry.value.toLowerCase() === 'true',
  );

  const names = recognised.map((entry) => entry.name);
  for (const name of new Set(names)) {
    if (names.filter((item) => item === name).length > 1)
      issues.push(`Duplicate ${name} header line; send one value per response.`);
  }

  for (const entry of recognised) {
    let status = 'Valid';
    let assessment = 'Looks fine.';
    let found: string[] = [];

    if (entry.name === 'access-control-allow-origin') {
      found = assessOrigin(entry.value, credentialsTrue);
      assessment =
        found[0] ??
        (entry.value === '*'
          ? 'Allows any non-credentialed origin to read the response'
          : 'Allows only this origin to read the response');
    } else if (entry.name === 'access-control-allow-credentials') {
      found = inspectCredentials(entry.value).issues;
      assessment = found[0] ?? 'Credentialed cross-origin reads are allowed for the named origin.';
    } else if (entry.name === 'access-control-allow-methods') {
      found = inspectTokens(splitList(entry.value), 'method');
      if (credentialsTrue && splitList(entry.value).includes('*'))
        found.push('Access-Control-Allow-Methods cannot be * when credentials are allowed.');
      assessment = found[0] ?? 'Preflight may use these methods.';
    } else if (entry.name === 'access-control-allow-headers') {
      found = inspectTokens(splitList(entry.value), 'allow-header');
      if (credentialsTrue && splitList(entry.value).includes('*'))
        found.push('Access-Control-Allow-Headers cannot be * when credentials are allowed.');
      assessment = found[0] ?? 'Preflight may request these headers.';
    } else if (entry.name === 'access-control-expose-headers') {
      found = inspectTokens(splitList(entry.value), 'expose-header');
      if (credentialsTrue && splitList(entry.value).includes('*'))
        found.push('Access-Control-Expose-Headers cannot be * when credentials are allowed.');
      assessment = found[0] ?? 'Scripts may read these response headers cross-origin.';
    } else if (entry.name === 'access-control-max-age') {
      const inspected = inspectMaxAge(entry.value);
      found = inspected.issues;
      assessment =
        found[0] ?? inspected.notes[0] ?? 'Preflight may be cached for this many seconds.';
    }

    if (found.length) status = 'Invalid';
    issues.push(...found.map((issue) => `${entry.name}: ${issue}`));
    const label = entry.name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-');
    rows.push([label, entry.value, status, assessment]);
  }

  return {
    output: JSON.stringify({ headers: TABLE_HEADERS, rows }),
    render: 'table',
    stats: { headers: rows.length, issues: issues.length },
    notes: issues.length
      ? issues
      : ['No obvious CORS misconfigurations detected in the values you pasted.'],
  };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported CORS mode.');
  if (input.text.length > MAX_INPUT)
    throw new ToolError('Header input is too large.', 'Paste headers under 100 KB.');

  if (mode === 'build') {
    const target = String(options.target);
    if (!isTarget(target)) throw new ToolError('Choose a supported header to build.');
    const { lines, notes } = buildHeaders(target, options);
    return {
      output: lines.join('\n'),
      render: 'code',
      language: 'http',
      filename: 'cors-headers.txt',
      stats: { headers: lines.length },
      notes,
    };
  }

  return analyze(input.text);
}
export { run };

const tool: TextToolModule = { meta, run };
export default tool;
