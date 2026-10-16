import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './media-query-builder.meta';

const FEATURE_RE =
  /^(min-|max-)?(width|height|aspect-ratio|orientation|resolution|scan|grid|update|color|color-index|monochrome|color-gamut|pointer|hover|any-pointer|any-hover|prefers-reduced-motion|prefers-reduced-transparency|prefers-contrast|forced-colors|prefers-color-scheme|scripting|inverted-colors|overflow-inline|overflow-block|prefers-reduced-data)$/;
function strictHasOperator(value: string): boolean {
  return /[<>]=?|=/.test(value);
}
function analyze(text: string): { query: string; issues: string[] } {
  const query = text.trim();
  const issues: string[] = [];
  if (!query) return { query, issues: ['No media query provided'] };
  let depth = 0;
  let unbalancedFlag = false;
  for (const char of query) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (depth < 0) {
      if (!unbalancedFlag) issues.push('Unmatched closing parenthesis');
      unbalancedFlag = true;
    }
    if (depth > 3) issues.push('Media query nesting exceeds expected depth');
  }
  if (depth !== 0) issues.push(depth > 0 ? 'Missing closing parentheses' : 'Extra closing parenthesis');
  const clean = query.replace(/@media\s*/i, '');
  const features = clean.match(/\(([^)]+)\)/g) ?? [];
  if (!features.length && !issues.length) issues.push('No feature conditions found; the query only has a media type or is empty');
  for (const feature of features) {
    const inner = feature.slice(1, -1).trim();
    const featureName = inner.split(':')[0]?.trim().toLowerCase() ?? '';
    if (!FEATURE_RE.test(featureName)) issues.push(`Unknown media feature: ${feature}`);
  }
  if (clean && !strictHasOperator(clean) && !/:\s*/.test(clean))
    issues.push('No comparison operator or value found; media queries need (feature: value) or (min/max-feature)');
  return { query, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported mode.');
  if (mode === 'build') {
    const min = String(options.minWidth).trim();
    const max = String(options.maxWidth).trim();
    const features = String(options.features).trim();
    const clauses: string[] = [];
    if (min) clauses.push(`(min-width: ${min})`);
    if (max) clauses.push(`(max-width: ${max})`);
    if (features) clauses.push(features);
    if (features && !/^\([^)]*\)$/.test(features)) throw new ToolError('Feature conditions should be a single parenthesized expression such as (hover: hover).');
    if (!clauses.length) throw new ToolError('Enter a width or a feature condition to build a query.');
    const output = `@media ${clauses.join(' and ')}`;
    const result = analyze(output);
    if (result.issues.length) throw new ToolError(result.issues[0]!);
    return { output, render: 'code', language: 'css', filename: 'media-query.txt', stats: { conditions: clauses.length, min: min ? 'yes' : 'no', max: max ? 'yes' : 'no' } };
  }
  const result = analyze(input.text);
  if (!input.text.trim())
    return { output: JSON.stringify({ headers: ['Condition', 'Status', 'Assessment'], rows: [] }), render: 'table', notes: ['Paste a CSS @media query to analyze.'] };
  const featuredRows = Array.from(input.text.matchAll(/\(([^)]+)\)/g)).map((m) => {
    const inner = m[1] ?? '';
    const name = inner.split(':')[0]?.trim() ?? '';
    const unknown = !FEATURE_RE.test(name.toLowerCase());
    return [inner, unknown ? 'Review' : 'Valid', unknown ? 'Unknown feature' : 'Feature condition'];
  });
  return {
    output: JSON.stringify({ headers: ['Condition', 'Status', 'Assessment'], rows: featuredRows }),
    render: 'table',
    stats: {
      conditions: featuredRows.length,
      issues: result.issues.length,
      invalid: result.issues.some((issue) => issue.startsWith('Unmatched') || issue.startsWith('Extra') || issue.startsWith('Missing')) ? 1 : 0,
    },
    notes: result.issues.length ? result.issues : ['Valid media query. Keep breakpoints intentional and test at real viewport sizes.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
