import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './conditional-request-headers.meta';

/**
 * Unified conditional-request header tool. It replaces the seven separate
 * entity-tag / HTTP-date builders and analyzers (`etag`, `last-modified`,
 * `if-match`, `if-none-match`, `if-range`, `if-modified-since`,
 * `if-unmodified-since`), whose ids are kept as redirect aliases. It can emit a
 * single header or a complete conditional set, validate a pasted header block,
 * and still compare two entity-tags the way the old `etag` tool did.
 */

const HEADERS = [
  'etag',
  'last-modified',
  'if-match',
  'if-none-match',
  'if-range',
  'if-modified-since',
  'if-unmodified-since',
] as const;
type HeaderId = (typeof HEADERS)[number];

const TARGETS = ['all', ...HEADERS] as const;
type Target = (typeof TARGETS)[number];

const CANONICAL: Record<HeaderId, string> = {
  etag: 'ETag',
  'last-modified': 'Last-Modified',
  'if-match': 'If-Match',
  'if-none-match': 'If-None-Match',
  'if-range': 'If-Range',
  'if-modified-since': 'If-Modified-Since',
  'if-unmodified-since': 'If-Unmodified-Since',
};

const TABLE_HEADERS: Record<'all' | HeaderId, string[]> = {
  all: ['Header', 'Value', 'Status', 'Assessment'],
  etag: ['Tag', 'Strength', 'Opaque value', 'Valid'],
  'last-modified': ['Date', 'Status', 'Assessment'],
  'if-match': ['Entity-tag', 'Status', 'Assessment'],
  'if-none-match': ['Entity-tag', 'Status', 'Assessment'],
  'if-range': ['Validator', 'Status', 'Kind', 'Issues'],
  'if-modified-since': ['Date', 'Status', 'Assessment'],
  'if-unmodified-since': ['Date', 'Status', 'Assessment'],
};

const TAG_RE = /^(W\/)?"([^"\r\n]*)"$/;
const IMF_RE =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;
const MAX_INPUT = 100_000;
const FUTURE_SKEW_MS = 300_000;

interface ParsedTag {
  raw: string;
  opaque: string;
  weak: boolean;
  wildcard: boolean;
  valid: boolean;
  issues: string[];
}

interface ParsedDate {
  raw: string;
  status: 'Valid' | 'Review' | 'Invalid';
  issues: string[];
}

interface IfRangeResult {
  kind: string;
  status: string;
  issues: string[];
}

function isTarget(value: string): value is Target {
  return (TARGETS as readonly string[]).includes(value);
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 'yes' || value === 'on' || value === 1;
}

/** Split a raw value list on newlines and commas (the union of both old tools). */
function splitValues(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .flatMap((line) => line.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseTag(raw: string): ParsedTag {
  const value = raw.trim();
  if (value === '*')
    return { raw: value, opaque: '', weak: false, wildcard: true, valid: true, issues: [] };
  const match = TAG_RE.exec(value);
  if (!match) {
    return {
      raw: value,
      opaque: '',
      weak: false,
      wildcard: false,
      valid: false,
      issues: ['Invalid entity-tag syntax; expected "opaque" or W/"opaque"'],
    };
  }
  return {
    raw: value,
    opaque: match[2] ?? '',
    weak: Boolean(match[1]),
    wildcard: false,
    valid: true,
    issues: [],
  };
}

function parseDate(value: string): ParsedDate {
  const date = value.trim();
  if (!IMF_RE.test(date)) {
    const parsed = Date.parse(date);
    if (Number.isNaN(parsed))
      return {
        raw: date,
        status: 'Invalid',
        issues: ['Invalid HTTP-date; expected IMF-fixdate such as Wed, 21 Oct 2015 07:28:00 GMT'],
      };
    return {
      raw: date,
      status: 'Review',
      issues: ['Use IMF-fixdate; this appears to be an obsolete HTTP-date form'],
    };
  }
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed))
    return { raw: date, status: 'Invalid', issues: ['Invalid calendar date'] };
  if (parsed > Date.now() + FUTURE_SKEW_MS)
    return {
      raw: date,
      status: 'Review',
      issues: ['Timestamp is more than five minutes in the future; check clock skew'],
    };
  return { raw: date, status: 'Valid', issues: [] };
}

function inspectIfRange(value: string): IfRangeResult {
  const validator = value.trim();
  if (!validator)
    return { kind: 'invalid', status: 'Invalid', issues: ['No If-Range validator provided'] };
  if (validator.startsWith('W/'))
    return {
      kind: 'weak entity-tag',
      status: 'Review',
      issues: ['Weak entity-tags are not valid If-Range validators'],
    };
  if (TAG_RE.test(validator)) return { kind: 'strong entity-tag', status: 'Valid', issues: [] };
  if (IMF_RE.test(validator)) return { kind: 'IMF-fixdate', status: 'Valid', issues: [] };
  return {
    kind: 'invalid',
    status: 'Invalid',
    issues: ['Expected a strong entity-tag or IMF-fixdate'],
  };
}

interface TagAnalysis {
  rows: { tag: ParsedTag; status: string; assessment: string; issues: string[] }[];
  issues: string[];
  invalid: number;
  review: number;
}

/** Validate a list of entity-tags. `strength: 'strong'` flags weak tags (If-Match). */
function analyzeTags(values: string[], strength: 'strong' | 'weak'): TagAnalysis {
  const parsed = values.map(parseTag);
  const counts = new Map<string, number>();
  for (const tag of parsed)
    counts.set(tag.raw.toLowerCase(), (counts.get(tag.raw.toLowerCase()) ?? 0) + 1);

  const rows = parsed.map((tag) => {
    const issues = [...tag.issues];
    if (tag.valid && tag.weak && strength === 'strong')
      issues.push('Weak entity-tags do not satisfy strong comparison');
    if (tag.valid && (counts.get(tag.raw.toLowerCase()) ?? 0) > 1)
      issues.push('Duplicate entity-tag');
    const status = !tag.valid ? 'Invalid' : issues.length ? 'Review' : 'Valid';
    const assessment = !tag.valid
      ? (issues[0] ?? 'Malformed entity-tag')
      : tag.wildcard
        ? 'Wildcard condition; matches any current representation'
        : tag.weak
          ? strength === 'strong'
            ? 'Weak tag; strong comparison will not match'
            : 'Weak comparison tag; valid for cache revalidation'
          : 'Strong entity-tag';
    return { tag, status, assessment, issues };
  });

  return {
    rows,
    issues: rows.flatMap((row) => row.issues.map((issue) => `${row.tag.raw}: ${issue}`)),
    invalid: rows.filter((row) => !row.tag.valid).length,
    review: rows.filter((row) => row.tag.valid && row.issues.length).length,
  };
}

function isDateLike(line: string): boolean {
  return IMF_RE.test(line) || (!Number.isNaN(Date.parse(line)) && /[A-Za-z]{3}/.test(line));
}

function guessHeader(text: string): HeaderId {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every(isDateLike) ? 'last-modified' : 'etag';
}

/* -------------------------------------------------------------------------- */
/*  Build                                                                     */
/* -------------------------------------------------------------------------- */

function tagValue(options: OptionValues): string {
  const raw = String(options.etag).trim();
  return asBool(options.weak) && raw && !raw.startsWith('W/') ? `W/${raw}` : raw;
}

function buildHeaders(target: Target, options: OptionValues): { lines: string[]; notes: string[] } {
  const weak = asBool(options.weak);
  const wildcard = asBool(options.wildcard);
  const tag = tagValue(options);
  const date = String(options.date).trim();
  const method = String(options.method);
  const validatorType = String(options.validatorType);
  const issueList: string[] = [];
  const notes: string[] = [];
  const lines: string[] = [];

  function addTagLine(id: 'etag' | 'if-match' | 'if-none-match', value: string): void {
    const parsed = parseTag(value);
    if (parsed.wildcard && id === 'etag') {
      issueList.push('ETag cannot use the wildcard *; give a quoted entity-tag.');
      return;
    }
    if (!parsed.valid) {
      issueList.push(parsed.issues[0]!);
      return;
    }
    if (id === 'if-match' && parsed.weak)
      notes.push('If-Match uses strong comparison, so this weak tag will never match.');
    lines.push(`${CANONICAL[id]}: ${value}`);
  }

  function addDateLine(id: 'last-modified' | 'if-modified-since' | 'if-unmodified-since'): void {
    const parsed = parseDate(date);
    if (parsed.issues.length) {
      issueList.push(parsed.issues[0] ?? 'Enter a valid IMF-fixdate HTTP date.');
      return;
    }
    lines.push(`${CANONICAL[id]}: ${date}`);
  }

  function addIfRangeLine(): void {
    if (validatorType === 'date') {
      const parsed = parseDate(date);
      if (parsed.issues.length) {
        issueList.push(parsed.issues[0] ?? 'Enter a valid IMF-fixdate HTTP date.');
        return;
      }
      lines.push(`If-Range: ${date}`);
      return;
    }
    const parsed = parseTag(tag);
    if (!parsed.valid) {
      issueList.push(parsed.issues[0]!);
      return;
    }
    if (parsed.wildcard) {
      issueList.push('If-Range cannot use the wildcard *; give a strong entity-tag or HTTP date.');
      return;
    }
    if (parsed.weak) {
      issueList.push('If-Range requires a strong entity-tag; remove the W/ prefix or use a date.');
      return;
    }
    lines.push(`If-Range: ${tag}`);
  }

  if (wildcard && weak)
    issueList.push('Wildcard and weak-tag modes cannot be combined; pick one condition.');

  switch (target) {
    case 'etag':
      addTagLine('etag', tag);
      break;
    case 'last-modified':
      addDateLine('last-modified');
      break;
    case 'if-match':
      if (wildcard) lines.push('If-Match: *');
      else addTagLine('if-match', tag);
      break;
    case 'if-none-match':
      if (wildcard) lines.push('If-None-Match: *');
      else addTagLine('if-none-match', tag);
      if (method === 'GET' || method === 'HEAD')
        notes.push('A matching GET/HEAD condition commonly returns 304 Not Modified.');
      else
        notes.push(
          'A matching condition on an unsafe method commonly returns 412 Precondition Failed.',
        );
      break;
    case 'if-range':
      addIfRangeLine();
      break;
    case 'if-modified-since':
      addDateLine('if-modified-since');
      break;
    case 'if-unmodified-since':
      addDateLine('if-unmodified-since');
      break;
    case 'all': {
      addTagLine('etag', tag);
      addDateLine('last-modified');
      if (wildcard) lines.push('If-Match: *');
      else addTagLine('if-match', tag);
      if (wildcard) lines.push('If-None-Match: *');
      else addTagLine('if-none-match', tag);
      addIfRangeLine();
      addDateLine('if-modified-since');
      addDateLine('if-unmodified-since');
      notes.push(
        'Sending every conditional header at once is unusual; emit just the condition you need.',
      );
      break;
    }
  }

  if (issueList.length) throw new ToolError(issueList[0]!, 'Fix the value and run again.');
  if (!lines.length) throw new ToolError('Nothing to build.', 'Pick a header to emit.');

  return { lines, notes };
}

/* -------------------------------------------------------------------------- */
/*  Analyze                                                                   */
/* -------------------------------------------------------------------------- */

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

function emptyResult(target: Target): TextRunResult {
  const note =
    target === 'all'
      ? 'Paste conditional-request headers (one per line) or a single value to analyze.'
      : `Paste one ${CANONICAL[target]} value.`;
  return {
    output: JSON.stringify({ headers: TABLE_HEADERS[target], rows: [] }),
    render: 'table',
    notes: [note],
  };
}

function analyzeEtag(text: string): TextRunResult {
  const values = splitValues(text);
  const parsed = values.map(parseTag);
  const rows = parsed.map((tag) =>
    tag.valid
      ? [
          tag.raw,
          tag.wildcard ? 'wildcard' : tag.weak ? 'weak' : 'strong',
          tag.wildcard ? '' : tag.opaque,
          'Valid',
        ]
      : [tag.raw, '', '', 'Invalid ETag'],
  );
  return {
    output: JSON.stringify({ headers: TABLE_HEADERS.etag, rows }),
    render: 'table',
    stats: {
      tags: values.length,
      invalid: parsed.filter((tag) => !tag.valid).length,
      wildcard: parsed.filter((tag) => tag.wildcard).length,
    },
    notes: [
      'Use weak comparison for If-None-Match and strong comparison for If-Match and If-Range.',
    ],
  };
}

function analyzeTagCondition(target: 'if-match' | 'if-none-match', text: string): TextRunResult {
  const values = splitValues(text);
  const strength = target === 'if-match' ? 'strong' : 'weak';
  const result = analyzeTags(values, strength);
  const rows = result.rows.map((row) => [row.tag.raw, row.status, row.assessment]);
  return {
    output: JSON.stringify({ headers: TABLE_HEADERS[target], rows }),
    render: 'table',
    stats: { tags: values.length, invalid: result.invalid, review: result.review },
    notes: result.issues.length
      ? result.issues
      : [
          target === 'if-match'
            ? 'If-Match is a precondition; a mismatch commonly results in 412 Precondition Failed.'
            : 'Matching GET/HEAD conditions commonly produce 304 Not Modified; non-safe methods may produce 412 Precondition Failed.',
        ],
  };
}

function analyzeIfRange(text: string): TextRunResult {
  const values = text
    .split(/\r\n|\r|\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const inspected = values.map(inspectIfRange);
  const rows = inspected.map((result, index) => [
    values[index]!,
    result.status,
    result.kind,
    result.issues.join('; ') || 'Usable If-Range validator',
  ]);
  return {
    output: JSON.stringify({ headers: TABLE_HEADERS['if-range'], rows }),
    render: 'table',
    stats: {
      validators: values.length,
      invalid: inspected.filter((result) => result.status === 'Invalid').length,
      review: inspected.filter((result) => result.status === 'Review').length,
    },
    notes: [
      'A matching validator permits 206 Partial Content; a mismatch commonly causes a full 200 response instead.',
    ],
  };
}

function analyzeDates(
  target: 'last-modified' | 'if-modified-since' | 'if-unmodified-since',
  text: string,
): TextRunResult {
  const values = text
    .split(/\r\n|\r|\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const rows = values.map((value) => {
    const parsed = parseDate(value);
    return [value, parsed.status, parsed.issues.join('; ') || 'IMF-fixdate'];
  });
  const note =
    target === 'last-modified'
      ? 'Last-Modified has one-second granularity; strong ETags are usually safer for rapid or concurrent updates.'
      : target === 'if-modified-since'
        ? 'If-Modified-Since can produce 304 Not Modified when a representation has not changed; ETags usually provide stronger validation.'
        : 'If-Unmodified-Since protects state-changing requests; a failed precondition commonly produces 412 Precondition Failed.';
  return {
    output: JSON.stringify({ headers: TABLE_HEADERS[target], rows }),
    render: 'table',
    stats: {
      dates: values.length,
      invalid: rows.filter((row) => row[1] === 'Invalid').length,
      review: rows.filter((row) => row[1] === 'Review').length,
    },
    notes: [note],
  };
}

function analyzeTarget(target: HeaderId, text: string): TextRunResult {
  if (target === 'etag') return analyzeEtag(text);
  if (target === 'if-match' || target === 'if-none-match') return analyzeTagCondition(target, text);
  if (target === 'if-range') return analyzeIfRange(text);
  return analyzeDates(target, text);
}

function assessHeader(name: HeaderId, value: string): { status: string; assessment: string } {
  if (name === 'etag') {
    const tag = parseTag(value);
    if (!tag.valid) return { status: 'Invalid', assessment: tag.issues[0]! };
    if (tag.wildcard) return { status: 'Invalid', assessment: 'ETag cannot be the wildcard *' };
    return { status: 'Valid', assessment: tag.weak ? 'Weak entity-tag' : 'Strong entity-tag' };
  }
  if (name === 'if-match' || name === 'if-none-match') {
    const strength = name === 'if-match' ? 'strong' : 'weak';
    const values = splitValues(value);
    if (!values.length) return { status: 'Invalid', assessment: 'No entity-tag provided' };
    const result = analyzeTags(values, strength);
    const status = result.invalid ? 'Invalid' : result.review ? 'Review' : 'Valid';
    return {
      status,
      assessment:
        result.issues[0] ??
        (strength === 'strong' ? 'Strong entity-tag condition' : 'Weak-comparison condition'),
    };
  }
  if (name === 'if-range') {
    const result = inspectIfRange(value);
    return { status: result.status, assessment: result.issues[0] ?? `Valid ${result.kind}` };
  }
  const parsed = parseDate(value);
  return { status: parsed.status, assessment: parsed.issues[0] ?? 'IMF-fixdate' };
}

function analyzeBlock(entries: { name: string; value: string }[]): TextRunResult {
  const names = entries.map((entry) => entry.name);
  const issues: string[] = [];
  for (const name of new Set(names)) {
    if (names.filter((item) => item === name).length > 1)
      issues.push(`Duplicate ${name} header line; send one value per response.`);
  }

  const rows = entries.map((entry) => {
    const id = entry.name as HeaderId;
    const { status, assessment } = assessHeader(id, entry.value);
    return [CANONICAL[id], entry.value, status, assessment];
  });
  const invalid = rows.filter((row) => row[2] === 'Invalid').length;
  const review = rows.filter((row) => row[2] === 'Review').length;
  issues.push(...rows.filter((row) => row[2] === 'Invalid').map((row) => `${row[0]}: ${row[3]!}`));

  return {
    output: JSON.stringify({ headers: TABLE_HEADERS.all, rows }),
    render: 'table',
    stats: { headers: rows.length, invalid, review },
    notes: issues.length
      ? issues
      : ['No obvious conditional-header problems detected in the values you pasted.'],
  };
}

function analyze(text: string, target: Target): TextRunResult {
  const trimmed = text.trim();
  if (!trimmed) return emptyResult(target);

  const known = new Set(HEADERS.map((header) => CANONICAL[header].toLowerCase()));
  const recognised = parseBlock(text).filter((entry) => known.has(entry.name));
  if (recognised.length) return analyzeBlock(recognised);

  const resolved: HeaderId = target === 'all' ? guessHeader(trimmed) : target;
  const result = analyzeTarget(resolved, text);
  if (target === 'all') {
    const kind = resolved === 'etag' ? 'entity-tags' : 'HTTP dates';
    return {
      ...result,
      notes: [
        `No header names found; analyzed the input as ${kind}. Pick a header to force the type.`,
        ...(result.notes ?? []),
      ],
    };
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Compare (kept from the old `etag` tool so that behaviour survives)         */
/* -------------------------------------------------------------------------- */

function compare(input: TextRunInput, options: OptionValues): TextRunResult {
  const left = parseTag(input.text);
  const right = parseTag(String(options.secondTag));
  if (!left.valid || !right.valid)
    throw new ToolError('Both values must be valid quoted ETags or the wildcard *.');
  const strong = String(options.comparison) === 'strong';
  const equal =
    left.wildcard ||
    right.wildcard ||
    ((!strong || (!left.weak && !right.weak)) && left.opaque === right.opaque);
  return {
    output: equal ? 'Match' : 'No match',
    render: 'text',
    stats: { comparison: strong ? 'strong' : 'weak', match: equal ? 'yes' : 'no' },
    notes: [
      strong ? 'Strong comparison rejects weak tags.' : 'Weak comparison ignores the W/ prefix.',
    ],
  };
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (!['analyze', 'build', 'compare'].includes(mode))
    throw new ToolError('Choose a supported conditional-request mode.');
  if (input.text.length > MAX_INPUT)
    throw new ToolError('Header input is too large.', 'Paste headers under 100 KB.');

  if (mode === 'compare') return compare(input, options);

  const target = String(options.target);
  if (!isTarget(target)) throw new ToolError('Choose a supported conditional header.');

  if (mode === 'build') {
    const { lines, notes } = buildHeaders(target, options);
    return {
      output: lines.join('\n'),
      render: 'code',
      language: 'http',
      filename: 'conditional-request-headers.txt',
      stats: { headers: lines.length },
      notes,
    };
  }

  return analyze(input.text, target);
}
export { run };

const tool: TextToolModule = { meta, run };
export default tool;
