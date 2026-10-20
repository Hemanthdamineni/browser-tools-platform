import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './etag.meta';

type Tag = { raw: string; opaque: string; weak: boolean; wildcard: boolean };
function parseTag(raw: string): Tag | null {
  const value = raw.trim();
  if (value === '*') return { raw: value, opaque: '', weak: false, wildcard: true };
  const match = /^(W\/)?"([^"\r\n]*)"$/.exec(value);
  return match ? { raw: value, opaque: match[2]!, weak: Boolean(match[1]), wildcard: false } : null;
}
function splitTags(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
function matches(left: Tag, right: Tag, strong: boolean): boolean {
  return (
    left.wildcard ||
    right.wildcard ||
    ((!strong || (!left.weak && !right.weak)) && left.opaque === right.opaque)
  );
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (!['analyze', 'build', 'compare'].includes(mode))
    throw new ToolError('Choose a supported ETag mode.');
  if (mode === 'build') {
    const token = input.text.trim();
    if (!token || /["\r\n]/.test(token) || token.length > 1000)
      throw new ToolError('Enter an opaque token without quotes or line breaks.');
    const output = `${options.weak ? 'W/' : ''}"${token}"`;
    return {
      output,
      render: 'code',
      language: 'http',
      filename: 'etag.txt',
      stats: { strength: options.weak ? 'weak' : 'strong' },
    };
  }
  if (mode === 'compare') {
    const left = parseTag(input.text);
    const right = parseTag(String(options.secondTag));
    if (!left || !right)
      throw new ToolError('Both values must be valid quoted ETags or wildcard *.');
    const strong = String(options.comparison) === 'strong';
    const equal = matches(left, right, strong);
    return {
      output: equal ? 'Match' : 'No match',
      render: 'text',
      stats: { comparison: strong ? 'strong' : 'weak', match: equal ? 'yes' : 'no' },
      notes: [
        strong ? 'Strong comparison rejects weak tags.' : 'Weak comparison ignores the W/ prefix.',
      ],
    };
  }
  const values = splitTags(input.text);
  if (!values.length)
    return {
      output: JSON.stringify({ headers: ['Tag', 'Strength', 'Opaque value', 'Valid'], rows: [] }),
      render: 'table',
      notes: ['Paste a comma-separated ETag or If-None-Match value.'],
    };
  const parsed = values.map(parseTag);
  const rows = parsed.map((tag, index) =>
    tag
      ? [
          tag.raw,
          tag.wildcard ? 'wildcard' : tag.weak ? 'weak' : 'strong',
          tag.wildcard ? '' : tag.opaque,
          'Valid',
        ]
      : [values[index]!, '', '', 'Invalid ETag'],
  );
  return {
    output: JSON.stringify({ headers: ['Tag', 'Strength', 'Opaque value', 'Valid'], rows }),
    render: 'table',
    stats: {
      tags: values.length,
      invalid: parsed.filter((tag) => !tag).length,
      wildcard: parsed.filter((tag) => tag?.wildcard).length,
    },
    notes: ['Use weak comparison for If-None-Match and strong comparison for If-Match semantics.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
