import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './accept-post.meta';

const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
function inspect(value: string): { types: string[]; issues: string[] } {
  const types = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const issues: string[] = [];
  if (!types.length) issues.push('No media types were provided');
  for (const type of types) {
    const [media, ...params] = type.split(';').map((part) => part.trim());
    const [major, minor] = media?.split('/') ?? [];
    if (!major || !minor || !TOKEN.test(major) || !TOKEN.test(minor))
      issues.push(`Invalid media type: ${type}`);
    for (const parameter of params) {
      const [key, rawValue] = parameter.split('=').map((part) => part.trim());
      if (!key || !TOKEN.test(key) || !rawValue)
        issues.push(`Invalid media-type parameter: ${parameter}`);
    }
  }
  if (new Set(types).size !== types.length) issues.push('Duplicate media types are present');
  if (types.includes('*/*'))
    issues.push(
      'Wildcard accepts every media type; confirm that this broad capability is intentional',
    );
  return { types, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Accept-Post mode.');
  const result = inspect(mode === 'build' ? String(options.types) : input.text);
  if (mode === 'build') {
    if (result.issues.length) throw new ToolError(result.issues[0]!);
    return {
      output: result.types.join(', '),
      render: 'code',
      language: 'http',
      filename: 'accept-post.txt',
      stats: { types: result.types.length },
    };
  }
  if (!result.types.length)
    return {
      output: JSON.stringify({ headers: ['Media type', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste comma-separated POST media types.'],
    };
  const rows = result.types.map((type) => [
    type,
    result.issues.length ? 'Review' : 'Valid',
    type === '*/*' ? 'Wildcard capability' : 'POST document media type',
  ]);
  return {
    output: JSON.stringify({ headers: ['Media type', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      types: result.types.length,
      issues: result.issues.length,
      wildcard: result.types.includes('*/*') ? 'yes' : 'no',
    },
    notes: result.issues.length
      ? result.issues
      : ['Accept-Post advertises formats only; it does not grant POST authorization.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
