import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cross-origin-opener-policy.meta';

const POLICIES = new Set([
  'same-origin',
  'same-origin-allow-popups',
  'unsafe-none',
  'restrict-properties',
]);
function inspect(value: string): string[] {
  const policy = value.trim().toLowerCase();
  if (!POLICIES.has(policy))
    return [
      'COOP must be same-origin, same-origin-allow-popups, unsafe-none, or restrict-properties',
    ];
  return [];
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported COOP mode.');
  const value = mode === 'build' ? String(options.value) : input.text;
  const issues = inspect(value);
  const normalized = value.trim().toLowerCase();
  if (mode === 'build') {
    if (issues.length) throw new ToolError(issues[0]!);
    return {
      output: normalized,
      render: 'code',
      language: 'http',
      filename: 'cross-origin-opener-policy.txt',
      stats: { policy: normalized },
    };
  }
  if (!value.trim())
    return {
      output: JSON.stringify({ headers: ['Policy', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste a COOP policy token.'],
    };
  const assessment =
    normalized === 'same-origin'
      ? 'Strict browsing-context isolation'
      : normalized === 'same-origin-allow-popups'
        ? 'Isolation with selected popup compatibility'
        : normalized === 'unsafe-none'
          ? 'No opener isolation'
          : 'Restricts selected cross-origin window properties';
  return {
    output: JSON.stringify({
      headers: ['Policy', 'Status', 'Assessment'],
      rows: [[normalized, issues.length ? 'Invalid' : 'Valid', issues.join('; ') || assessment]],
    }),
    render: 'table',
    stats: {
      valid: issues.length ? 'no' : 'yes',
      policy: normalized,
      isolated: normalized === 'same-origin' ? 'yes' : 'no',
    },
    notes: issues.length
      ? issues
      : [
          'COOP affects browsing-context relationships; pair with compatible embedder and resource policies when pursuing cross-origin isolation.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
