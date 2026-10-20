import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './critical-ch.meta';

const TOKEN = /^[A-Za-z][A-Za-z0-9-]*$/;
const HIGH_ENTROPY = new Set([
  'Sec-CH-UA-Full-Version',
  'Sec-CH-UA-Platform-Version',
  'Sec-CH-UA-Model',
  'Device-Memory',
]);
function inspect(text: string): { hints: string[]; issues: string[] } {
  const hints = text
    .split(/[\s,]+/)
    .map((hint) => hint.trim())
    .filter(Boolean);
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const hint of hints) {
    if (!TOKEN.test(hint)) issues.push(`Invalid client-hint token: ${hint}`);
    const normalized = hint.toLowerCase();
    if (seen.has(normalized)) issues.push(`Duplicate critical hint: ${hint}`);
    seen.add(normalized);
  }
  const sensitive = hints.filter((hint) => HIGH_ENTROPY.has(hint));
  if (sensitive.length)
    issues.push(
      `High-entropy critical hints increase fingerprinting surface: ${sensitive.join(', ')}`,
    );
  return { hints, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Critical-CH mode.');
  const value = mode === 'build' ? String(options.hints) : input.text;
  const result = inspect(value);
  if (mode === 'build') {
    if (!result.hints.length || result.issues.length)
      throw new ToolError(result.issues[0] ?? 'Enter valid critical hint names.');
    return {
      output: result.hints.join(', '),
      render: 'code',
      language: 'http',
      filename: 'critical-ch.txt',
      stats: { hints: result.hints.length },
    };
  }
  if (!result.hints.length)
    return {
      output: JSON.stringify({ headers: ['Hint', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste space- or comma-separated critical hint names.'],
    };
  const rows = result.hints.map((hint) => [
    hint,
    result.issues.length ? 'Review' : 'Valid',
    HIGH_ENTROPY.has(hint)
      ? 'Higher entropy; review retry and privacy impact'
      : 'Critical rendering hint',
  ]);
  return {
    output: JSON.stringify({ headers: ['Hint', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      hints: result.hints.length,
      issues: result.issues.length,
      highEntropy: result.hints.filter((hint) => HIGH_ENTROPY.has(hint)).length,
    },
    notes: result.issues.length
      ? result.issues
      : [
          'Critical-CH can influence retries; coordinate Accept-CH, Vary, cache keys, and privacy policy.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
