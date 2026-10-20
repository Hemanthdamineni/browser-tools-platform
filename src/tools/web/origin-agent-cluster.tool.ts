import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './origin-agent-cluster.meta';

function inspect(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed !== '?1' && trimmed !== '?0')
    return ['Origin-Agent-Cluster must be the structured boolean ?1 or ?0'];
  return [];
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Origin-Agent-Cluster mode.');
  const value = mode === 'build' ? String(options.value) : input.text;
  const issues = inspect(value);
  if (mode === 'build') {
    if (issues.length) throw new ToolError(issues[0]!);
    return {
      output: value.trim(),
      render: 'code',
      language: 'http',
      filename: 'origin-agent-cluster.txt',
      stats: { value: value.trim(), originKeyed: value.trim() === '?1' ? 'yes' : 'no' },
    };
  }
  if (!value.trim())
    return {
      output: JSON.stringify({ headers: ['Value', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste ?1 or ?0 to analyze Origin-Agent-Cluster.'],
    };
  const normalized = value.trim();
  return {
    output: JSON.stringify({
      headers: ['Value', 'Status', 'Assessment'],
      rows: [
        [
          normalized,
          issues.length ? 'Invalid' : 'Valid',
          issues.join('; ') ||
            (normalized === '?1'
              ? 'Requests origin-keyed agent-cluster isolation'
              : 'Opts out of origin-keyed agent-cluster isolation'),
        ],
      ],
    }),
    render: 'table',
    stats: {
      valid: issues.length ? 'no' : 'yes',
      originKeyed: normalized === '?1' ? 'yes' : 'no',
      issues: issues.length,
    },
    notes: issues.length
      ? issues
      : [
          'This signal is not a universal process-isolation guarantee; deploy consistently and verify browser compatibility.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
