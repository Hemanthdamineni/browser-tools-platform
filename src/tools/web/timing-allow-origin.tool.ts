import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './timing-allow-origin.meta';

const ORIGIN = /^(\*|https?:\/\/[^\s,]+)$/i;
function splitOrigins(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
function inspect(value: string): { origins: string[]; issues: string[] } {
  const issues: string[] = [];
  const origins = splitOrigins(value);
  if (!origins.length) issues.push('No Timing-Allow-Origin values were provided');
  for (const origin of origins)
    if (!ORIGIN.test(origin)) issues.push(`Invalid origin token: ${origin}`);
  if (origins.includes('*') && origins.length > 1)
    issues.push(`A wildcard * makes additional origins redundant`);
  if (origins.includes('*'))
    issues.push(
      'A wildcard * exposes timing data to every origin; narrow the grant where possible',
    );
  if (new Set(origins).size !== origins.length) issues.push('Duplicate origin tokens are present');
  return { origins, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Timing-Allow-Origin mode.');
  const value = mode === 'build' ? String(options.origins) : input.text;
  const result = inspect(value);
  if (mode === 'build') {
    if (!result.origins.length || result.issues.length)
      throw new ToolError(result.issues[0] ?? 'Enter at least one origin or *.');
    return {
      output: result.origins.join(', '),
      render: 'code',
      language: 'http',
      filename: 'timing-allow-origin.txt',
      stats: {
        origins: result.origins.length,
        wildcard: result.origins.includes('*') ? 'yes' : 'no',
      },
    };
  }
  if (!value.trim())
    return {
      output: JSON.stringify({ headers: ['Origin', 'Status', 'Effect'], rows: [] }),
      render: 'table',
      notes: ['Paste a Timing-Allow-Origin value: * or a comma-separated list of origins.'],
    };
  const rows = result.origins.map((origin) => [
    origin,
    ORIGIN.test(origin) ? 'Valid' : 'Invalid',
    origin === '*'
      ? 'Allows any origin to read timing data'
      : 'Whitelists this origin for timing reads',
  ]);
  return {
    output: JSON.stringify({ headers: ['Origin', 'Status', 'Effect'], rows }),
    render: 'table',
    stats: {
      origins: result.origins.length,
      issues: result.issues.length,
      wildcard: result.origins.includes('*') ? 'yes' : 'no',
    },
    notes: result.issues.length
      ? result.issues
      : [
          'TAO only gates read access to resource timing metrics in supported browsers; it does not affect the ability to load the resource.',
        ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
