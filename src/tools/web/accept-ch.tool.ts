import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './accept-ch.meta';

const TOKEN = /^[A-Za-z][A-Za-z0-9-]*$/;
const HIGH_ENTROPY = new Set([
  'Sec-CH-UA-Full-Version',
  'Sec-CH-UA-Platform-Version',
  'Sec-CH-UA-Model',
  'Device-Memory',
  'Downlink',
  'RTT',
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
    if (seen.has(normalized)) issues.push(`Duplicate client hint: ${hint}`);
    seen.add(normalized);
  }
  const sensitive = hints.filter((hint) => HIGH_ENTROPY.has(hint));
  if (sensitive.length)
    issues.push(`High-entropy hints can increase fingerprinting surface: ${sensitive.join(', ')}`);
  return { hints, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Accept-CH mode.');
  const value = mode === 'build' ? String(options.hints) : input.text;
  const result = inspect(value);
  if (mode === 'build') {
    if (!result.hints.length || result.issues.length)
      throw new ToolError(result.issues[0] ?? 'Enter valid client-hint names.');
    return {
      output: result.hints.join(', '),
      render: 'code',
      language: 'http',
      filename: 'accept-ch.txt',
      stats: { hints: result.hints.length },
    };
  }
  if (!result.hints.length)
    return {
      output: JSON.stringify({ headers: ['Hint', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste space- or comma-separated client-hint names.'],
    };
  const rows = result.hints.map((hint) => [
    hint,
    result.issues.length ? 'Review' : 'Valid',
    HIGH_ENTROPY.has(hint) ? 'Higher entropy; review privacy policy' : 'Client-hints opt-in',
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
      : ['Coordinate client hints with Vary, cache keys, and Permissions-Policy where applicable.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
