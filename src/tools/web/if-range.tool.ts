import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './if-range.meta';

const ETAG = /^"(?:[^"\\]|\\.)*"$/;
const IMF =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;
function inspect(value: string): { kind: string; issues: string[] } {
  const validator = value.trim();
  const issues: string[] = [];
  if (validator.startsWith('W/')) issues.push('Weak entity-tags are not valid If-Range validators');
  if (ETAG.test(validator)) return { kind: 'strong entity-tag', issues };
  if (IMF.test(validator)) return { kind: 'IMF-fixdate', issues };
  if (!issues.length) issues.push('Expected a strong entity-tag or IMF-fixdate');
  return { kind: 'invalid', issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported If-Range mode.');
  const value = mode === 'build' ? String(options.validator).trim() : input.text.trim();
  if (!value) {
    if (mode === 'build') throw new ToolError('Enter a strong entity-tag or IMF-fixdate.');
    return {
      output: JSON.stringify({ headers: ['Validator', 'Status', 'Kind', 'Issues'], rows: [] }),
      render: 'table',
      notes: ['Paste an If-Range strong entity-tag or IMF-fixdate.'],
    };
  }
  const result = inspect(value);
  if (mode === 'build') {
    if (result.issues.length || result.kind === 'invalid') throw new ToolError(result.issues[0]!);
    return {
      output: value,
      render: 'code',
      language: 'http',
      filename: 'if-range.txt',
      stats: { kind: result.kind },
    };
  }
  const rows = [
    [
      value,
      result.issues.length ? 'Review' : 'Valid',
      result.kind,
      result.issues.join('; ') || 'Usable If-Range validator',
    ],
  ];
  return {
    output: JSON.stringify({ headers: ['Validator', 'Status', 'Kind', 'Issues'], rows }),
    render: 'table',
    stats: {
      validators: 1,
      invalid: result.kind === 'invalid' ? 1 : 0,
      review: result.issues.length,
    },
    notes: [
      'A matching validator permits 206 Partial Content; a mismatch commonly causes a full 200 response instead.',
    ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
