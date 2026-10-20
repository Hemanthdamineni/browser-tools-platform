import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './if-none-match.meta';

const TAG = /^(W\/)?"(?:[^"\\]|\\.)*"$/;
type Tag = { raw: string; weak: boolean; issues: string[] };
function parse(raw: string): Tag | null {
  const value = raw.trim();
  if (value === '*') return { raw: value, weak: false, issues: [] };
  const weak = value.startsWith('W/');
  const issues: string[] = [];
  if (!TAG.test(value)) issues.push('Invalid entity-tag syntax');
  return { raw: value, weak, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported If-None-Match mode.');
  if (mode === 'build') {
    const wildcard = Boolean(options.wildcard);
    const weak = Boolean(options.weak);
    const tag = String(options.tag).trim();
    if (wildcard && weak) throw new ToolError('Wildcard and weak-tag modes cannot be combined.');
    const value = wildcard ? '*' : weak && !tag.startsWith('W/') ? `W/${tag}` : tag;
    const parsed = parse(value);
    if (!parsed || parsed.issues.length)
      throw new ToolError(parsed?.issues[0] ?? 'Enter a valid entity-tag.');
    return {
      output: value,
      render: 'code',
      language: 'http',
      filename: 'if-none-match.txt',
      stats: { tags: 1, weak: weak ? 'yes' : 'no', method: String(options.method) },
    };
  }
  const values = input.text.split(/\r\n|\r|\n/).flatMap((line) =>
    line
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!values.length)
    return {
      output: JSON.stringify({ headers: ['Entity-tag', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste one or more If-None-Match entity-tags.'],
    };
  const parsed = values.map(parse);
  const duplicate = new Set(values.map((value) => value.toLowerCase())).size !== values.length;
  if (duplicate) parsed.forEach((tag) => tag?.issues.push('Duplicate entity-tag is present'));
  const rows = parsed.map((tag, index) =>
    tag
      ? [
          tag.raw,
          tag.issues.some((issue) => issue.includes('Invalid'))
            ? 'Invalid'
            : tag.issues.length
              ? 'Review'
              : 'Valid',
          tag.raw === '*'
            ? 'Wildcard; useful for create-if-absent'
            : tag.weak
              ? 'Weak comparison tag; valid for cache revalidation'
              : 'Strong entity-tag; weak comparison also applies',
        ]
      : [values[index]!, 'Invalid', 'Malformed entity-tag'],
  );
  return {
    output: JSON.stringify({ headers: ['Entity-tag', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      tags: values.length,
      invalid: parsed.filter((tag) => !tag).length,
      review: parsed.filter((tag) => tag?.issues.length).length,
    },
    notes: [
      'Matching GET/HEAD conditions commonly produce 304 Not Modified; non-safe methods may produce 412 Precondition Failed.',
    ],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
