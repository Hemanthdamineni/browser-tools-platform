import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cross-origin-resource-policy.meta';

const POLICIES = new Set(['same-origin', 'same-site', 'cross-origin']);
function inspect(value: string): string[] {
  const trimmed = value.trim().toLowerCase();
  if (!POLICIES.has(trimmed)) return ['CORP must be same-origin, same-site, or cross-origin'];
  return [];
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze') throw new ToolError('Choose a supported CORP mode.');
  const value = mode === 'build' ? String(options.value) : input.text;
  const issues = inspect(value);
  const normalized = value.trim().toLowerCase();
  if (mode === 'build') {
    if (issues.length) throw new ToolError(issues[0]!);
    return {
      output: normalized,
      render: 'code',
      language: 'http',
      filename: 'cross-origin-resource-policy.txt',
      stats: { policy: normalized },
    };
  }
  if (!value.trim())
    return {
      output: JSON.stringify({ headers: ['Policy', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste same-origin, same-site, or cross-origin.'],
    };
  return {
    output: JSON.stringify({
      headers: ['Policy', 'Status', 'Assessment'],
      rows: [
        [
          normalized,
          issues.length ? 'Invalid' : 'Valid',
          issues.join('; ') ||
            (normalized === 'cross-origin'
              ? 'Broad cross-origin embedding'
              : `${normalized} resource loading policy`),
        ],
      ],
    }),
    render: 'table',
    stats: {
      valid: issues.length ? 'no' : 'yes',
      policy: normalized,
      broad: normalized === 'cross-origin' ? 'yes' : 'no',
    },
    notes: issues.length
      ? issues
      : [
          'CORP controls loading/embedding, not script read access; configure CORS separately where needed.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
