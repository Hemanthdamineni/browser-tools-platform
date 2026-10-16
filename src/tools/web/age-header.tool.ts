import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './age-header.meta';

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'analyze' && mode !== 'build') throw new ToolError('Choose a supported mode.');
  const source = mode === 'build' ? String(options.seconds) : input.text.trim();
  if (mode === 'analyze' && !source) return { output: JSON.stringify({ headers: ['Age', 'Status', 'Comment'], rows: [] }), render: 'table', notes: ['Paste a non-negative integer number of seconds from a cache Age header.'] };
  if (!/^\d+$/.test(source)) throw new ToolError(mode === 'build' ? 'Enter a non-negative integer amount of seconds.' : 'Age value must be a non-negative integer (delta-seconds).');
  const delta = Number(source);
  if (mode === 'build') return { output: `Age: ${delta}`, render: 'code', language: 'http', filename: 'age-header.txt', stats: { age: delta } };
  const status = delta === 0 ? 'fresh' : delta < 3600 ? 'recent' : delta < 86400 ? 'moderate' : delta <= 604800 ? 'old' : 'stale';
  const comment = delta > 604800 ? 'Exceeds a week — verify against max-age' : delta >= 1 ? 'Compare to Cache-Control max-age to gauge freshness' : 'Just generated';
  return { output: JSON.stringify({ headers: ['Age', 'Status', 'Comment'], rows: [[delta.toString(), status, comment]] }), render: 'table', stats: { valid: 'yes', age: delta, status }, notes: ['Age tells how long a cached object was held; use it with Cache-Control to judge freshness.'] };
}
const tool: TextToolModule = { meta, run };
export default tool;
