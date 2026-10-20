import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './content-language.meta';

function validTag(tag: string): boolean {
  if (tag === '*') return true;
  const parts = tag.split('-');
  if (!parts.length || !/^[A-Za-z]{2,8}$/.test(parts[0]!)) return false;
  let index = 1;
  if (parts[index] && /^[A-Za-z]{4}$/.test(parts[index]!)) index += 1;
  if (parts[index] && /^(?:[A-Za-z]{2}|\d{3})$/.test(parts[index]!)) index += 1;
  while (parts[index] && /^[A-Za-z0-9]{5,8}$/.test(parts[index]!)) index += 1;
  if (parts[index] === 'x')
    return parts.slice(index + 1).every((part) => /^[A-Za-z0-9]{1,8}$/.test(part));
  while (parts[index]) {
    if (!/^[0-9A-WY-Za-wy-z](?:-[A-Za-z0-9]{2,8})+$/.test(parts.slice(index).join('-')))
      return false;
    break;
  }
  return index === parts.length;
}
function inspect(value: string): { tags: string[]; issues: string[] } {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const issues: string[] = [];
  if (!tags.length) issues.push('No language tags were provided');
  if (tags.includes('*') && tags.length > 1)
    issues.push(
      'Wildcard should not be combined with explicit tags without an application-specific reason',
    );
  if (tags.some((tag) => !validTag(tag)))
    issues.push('One or more tags are not valid common BCP 47 shapes');
  if (new Set(tags.map((tag) => tag.toLowerCase())).size !== tags.length)
    issues.push('Duplicate language tags are present');
  if (tags.some((tag) => tag.toLowerCase().includes('-x-')))
    issues.push('Private-use language tags are opaque and may not be interoperable');
  return { tags, issues };
}
function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode);
  if (mode !== 'build' && mode !== 'analyze')
    throw new ToolError('Choose a supported Content-Language mode.');
  const result = inspect(mode === 'build' ? String(options.tags) : input.text);
  if (mode === 'build') {
    if (result.issues.length) throw new ToolError(result.issues[0]!);
    return {
      output: result.tags.join(', '),
      render: 'code',
      language: 'http',
      filename: 'content-language.txt',
      stats: { tags: result.tags.length },
    };
  }
  if (!result.tags.length)
    return {
      output: JSON.stringify({ headers: ['Tag', 'Status', 'Assessment'], rows: [] }),
      render: 'table',
      notes: ['Paste comma-separated language tags.'],
    };
  const rows = result.tags.map((tag) => [
    tag,
    result.issues.length ? 'Review' : 'Valid',
    tag === '*'
      ? 'Wildcard language value'
      : tag.toLowerCase().includes('-x-')
        ? 'Private-use tag; verify interoperability'
        : 'Common language-tag shape',
  ]);
  return {
    output: JSON.stringify({ headers: ['Tag', 'Status', 'Assessment'], rows }),
    render: 'table',
    stats: {
      tags: result.tags.length,
      issues: result.issues.length,
      wildcard: result.tags.includes('*') ? 'yes' : 'no',
    },
    notes: result.issues.length
      ? result.issues
      : ['Content-Language describes the representation; it is not a client preference list.'],
  };
}
const tool: TextToolModule = { meta, run };
export default tool;
