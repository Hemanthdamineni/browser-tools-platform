import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './speculation-rules.meta';

type Rule = {
  source: string;
  urls: string[];
  eagerness?: string;
  requires?: string[];
  referrerPolicy?: string;
  where?: unknown;
};
type Parsed = { prefetch: Rule[]; prerender: Rule[]; issues: string[] };

const EAGERNESS = ['immediate', 'eager', 'moderate', 'conservative'];
const REQUIRES = ['anonymous-client-ip-when-cross-origin', 'anonymous-client-ip'];
const REFERRER = [
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
];

function inspectRule(raw: unknown, kind: 'prefetch' | 'prerender', issues: string[]): Rule {
  const rule: Rule = { source: 'list', urls: [] };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    issues.push(`${kind}: each entry must be a rule object`);
    return rule;
  }
  const obj = raw as Record<string, unknown>;
  if ('source' in obj) {
    const src = String(obj.source);
    if (src !== 'list' && src !== 'document')
      issues.push(`${kind}: unknown source "${src}" (expected "list" or "document")`);
    rule.source = src;
  }
  if ('urls' in obj) {
    const urls = obj.urls;
    if (!Array.isArray(urls) || urls.some((u) => typeof u !== 'string' || u === '')) {
      issues.push(`${kind}: "urls" must be an array of non-empty strings`);
    } else if (rule.source === 'document') {
      issues.push(`${kind}: "urls" is only allowed with source "list"`);
    } else {
      rule.urls = (urls as string[]).filter((u) => !u.includes('://') || /^https?:\/\//i.test(u));
    }
  } else if (rule.source === 'list') {
    issues.push(`${kind}: "source":"list" requires a "urls" array`);
  }
  for (const key of ['eagerness', 'referrer_policy']) {
    if (key in obj) {
      const val = String(obj[key]);
      if (key === 'eagerness') {
        if (!EAGERNESS.includes(val)) issues.push(`${kind}: invalid eagerness "${val}"`);
        else rule.eagerness = val;
      } else {
        if (!REFERRER.includes(val)) issues.push(`${kind}: invalid referrer_policy "${val}"`);
        else rule.referrerPolicy = val;
      }
    }
  }
  if ('requires' in obj) {
    const req = obj.requires;
    if (!Array.isArray(req) || req.some((r) => typeof r !== 'string' || !REQUIRES.includes(r))) {
      issues.push(`${kind}: invalid "requires" — values must be ${REQUIRES.join(' or ')}`);
    } else if (kind === 'prefetch') {
      issues.push('prefetch: "requires" is only valid on prerender rules');
    } else {
      rule.requires = req as string[];
    }
  }
  if ('where' in obj) rule.where = obj.where;
  return rule;
}

function parse(json: string): { parsed: Parsed; isUrl: boolean } {
  const issues: string[] = [];
  const text = json.trim();
  const isUrl = /^https?:\/\/\S+$/i.test(text) || /^\/(?:[^/]|$).*$/.test(text);
  if (isUrl) {
    return { parsed: { prefetch: [], prerender: [], issues: [] }, isUrl: true };
  }
  const norm = text
    .replace(/^<script[^>]*>/i, '')
    .replace(/<\/script>$/i, '')
    .trim();
  let value: unknown;
  try {
    value = JSON.parse(norm);
  } catch {
    return {
      parsed: {
        prefetch: [],
        prerender: [],
        issues: [
          'Invalid JSON — rules must be valid JSON (object of "prefetch" and/or "prerender" arrays).',
        ],
      },
      isUrl: false,
    };
  }
  const parsed: Parsed = { prefetch: [], prerender: [], issues };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push('Top-level value must be a JSON object');
    return { parsed, isUrl: false };
  }
  const root = value as Record<string, unknown>;
  for (const kind of ['prefetch', 'prerender'] as const) {
    if (!(kind in root)) continue;
    const arr = root[kind];
    if (!Array.isArray(arr)) {
      issues.push(`${kind}: must be an array of rules`);
      continue;
    }
    parsed[kind] = arr.map((r) => inspectRule(r, kind, issues));
  }
  for (const key of Object.keys(root)) {
    if (key !== 'prefetch' && key !== 'prerender')
      issues.push(`Top-level key "${key}" is not supported (use "prefetch"/"prerender")`);
  }
  if (!('prefetch' in root) && !('prerender' in root))
    issues.push('At least one of "prefetch" or "prerender" is required');
  return { parsed, isUrl: false };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported mode (analyze or build).');
  if (mode === 'build') {
    const type = String(o.type);
    const urls = String(o.urls)
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    if (type !== 'prefetch' && type !== 'prerender')
      throw new ToolError('Pick a rule type: prefetch or prerender.');
    if (!urls.length)
      throw new ToolError('Provide at least one relative URL to prefetch/prerender.');
    if (urls.some((u) => !/^(?:\/|https?:\/\/)/i.test(u)))
      throw new ToolError('URLs must be relative paths or http(s) absolute URLs.');
    const eagerness = String(o.eagerness);
    if (!EAGERNESS.includes(eagerness)) throw new ToolError('Invalid eagerness value.');
    const rules = { [type]: [{ source: 'list', urls }] };
    const output = JSON.stringify(rules, null, 2);
    return {
      output,
      render: 'code',
      language: 'json',
      filename: 'speculation-rules.json',
      stats: { [type]: urls.length },
    };
  }
  if (!input.text.trim())
    return {
      output: JSON.stringify({
        headers: ['Type', 'Source', 'URLs', 'Eagerness', 'Status'],
        rows: [],
      }),
      render: 'table',
      notes: ['Paste a rules JSON object or a Speculation-Rules header value (URL).'],
    };
  const { parsed, isUrl } = parse(input.text);
  if (isUrl)
    return {
      output: JSON.stringify({
        headers: ['Type', 'Source', 'URLs', 'Eagerness', 'Status'],
        rows: [['external', '(header value)', input.text.trim(), '-', 'Info']],
      }),
      render: 'table',
      stats: { external: 1 },
      notes: [
        'External speculation-rules files are resolved by the browser; this tool does not fetch them (on-device only). The header should name a JSON file served with a suitable Cache-Control.',
      ],
    };
  const rows = [
    ...['prefetch', 'prerender'].flatMap((kind) =>
      parsed[kind === 'prefetch' ? 'prefetch' : 'prerender'].map((r) => [
        kind,
        r.source,
        r.urls.join(', ') || '(none)',
        r.eagerness ?? '(not set)',
        parsed.issues.length ? 'Review' : 'Valid',
      ]),
    ),
    ...(parsed.prefetch.length + parsed.prerender.length === 0 && !parsed.issues.length
      ? [['', '(no rules)', '', '', 'Empty']]
      : []),
  ];
  return {
    output: JSON.stringify({ headers: ['Type', 'Source', 'URLs', 'Eagerness', 'Status'], rows }),
    render: 'table',
    stats: {
      prefetch: parsed.prefetch.length,
      prerender: parsed.prerender.length,
      issues: parsed.issues.length,
    },
    notes: parsed.issues.length
      ? parsed.issues
      : [
          'Ensure prefetch targets you actually want warmed; prerender uses more resources and should be limited to critical next pages.',
        ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
