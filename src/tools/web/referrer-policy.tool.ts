import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './referrer-policy.meta';

const POLICIES = new Set([
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
]);
const DESCRIPTORS: Record<string, string> = {
  'no-referrer': 'Never sends a Referer header',
  'no-referrer-when-downgrade': 'Sends full URL except on HTTPS to HTTP downgrades',
  origin: 'Sends only the origin everywhere',
  'origin-when-cross-origin': 'Full URL same-origin; origin cross-origin',
  'same-origin': 'Full URL same-origin; no Referer cross-origin',
  'strict-origin': 'Origin only, omitted on HTTPS to HTTP downgrades',
  'strict-origin-when-cross-origin':
    'Full URL same-origin; origin cross-origin; omitted on downgrades',
  'unsafe-url': 'Full URL everywhere, including cross-origin requests',
};
function inspect(value: string): { tokens: string[]; issues: string[] } {
  const tokens = value
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const issues: string[] = [];
  if (!tokens.length) issues.push('No policy token was provided');
  for (const token of tokens)
    if (!POLICIES.has(token)) issues.push(`Unsupported policy token: ${token}`);
  if (tokens.includes('unsafe-url'))
    issues.push('unsafe-url sends full URLs cross-origin; avoid unless explicitly required');
  if (tokens.includes('no-referrer-when-downgrade'))
    issues.push(
      'no-referrer-when-downgrade is the legacy browser default and leaks more than modern policies',
    );
  if (new Set(tokens).size !== tokens.length) issues.push('Duplicate policy tokens are present');
  return { tokens, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Referrer-Policy mode.');
  const value = mode === 'build' ? String(options.value) : input.text;
  const result = inspect(value);
  if (mode === 'build') {
    if (!result.tokens.length || result.issues.length)
      throw new ToolError(result.issues[0] ?? 'Choose a valid referrer policy.');
    return {
      output: result.tokens.join(', '),
      render: 'code',
      language: 'http',
      filename: 'referrer-policy.txt',
      stats: {
        policies: result.tokens.length,
        effective: result.tokens[result.tokens.length - 1] ?? '',
      },
    };
  }
  if (!result.tokens.length)
    return {
      output: JSON.stringify({ headers: ['Policy', 'Status', 'Behavior'], rows: [] }),
      render: 'table',
      notes: ['Paste one Referrer-Policy value; comma-separated fallbacks are supported.'],
    };
  const supported = result.tokens.filter((token) => POLICIES.has(token));
  const effective = supported[supported.length - 1] ?? '';
  const rows = result.tokens.map((token) => [
    token,
    POLICIES.has(token) ? 'Valid' : 'Invalid',
    DESCRIPTORS[token] ?? 'Unsupported token',
  ]);
  return {
    output: JSON.stringify({ headers: ['Policy', 'Status', 'Behavior'], rows }),
    render: 'table',
    stats: { policies: result.tokens.length, issues: result.issues.length, effective },
    notes: result.issues.length
      ? result.issues
      : [
          'The last supported token in a list wins; pair this header with site-wide security-headers review.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
