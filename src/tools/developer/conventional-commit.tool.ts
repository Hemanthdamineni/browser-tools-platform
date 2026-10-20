import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './conventional-commit.meta';

const MAX_LEN = 10_000;
const SUGGESTED_MAX = 72;

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const type = String(o.type ?? 'feat');
  const scope = String(o.scope ?? '').trim();
  const breaking = o.breaking === true;
  const breakingDetail = String(o.breakingDetail ?? '').trim();
  const body = String(o.body ?? '').trim();
  const lines = (input.text ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  const subject = lines[0] ?? '';
  if (!subject) throw new ToolError('Describe the change in the input box.', 'e.g. "Add pagination to the list endpoint"');
  if (subject.length > MAX_LEN) throw new ToolError('Subject is too large.', 'Keep it under ' + MAX_LEN + ' characters.');

  const bang = breaking ? '!' : '';
  const scopePart = scope ? '(' + scope + ')' : '';
  const firstLine = type + scopePart + bang + ': ' + subject;

  const parts: string[] = [firstLine];
  if (body) parts.push('', body);
  if (breaking) parts.push('', 'BREAKING CHANGE: ' + (breakingDetail || subject));

  const subjectLen = firstLine.length;
  const ignoredLines = lines.slice(1);

  return {
    output: parts.join('\n') + '\n',
    render: 'code',
    language: 'text',
    stats: { subjectLength: subjectLen, breaking: breaking ? 1 : 0 },
    notes: [
      subjectLen <= SUGGESTED_MAX
        ? 'Subject is within the suggested ' + SUGGESTED_MAX + '-char limit.'
        : 'Subject is ' + (subjectLen - SUGGESTED_MAX) + ' chars over the suggested ' + SUGGESTED_MAX + ' — consider shortening.',
      breaking ? 'Marked as a breaking change' + (breakingDetail ? ' with a BREAKING CHANGE footer.' : ' with the subject as the footer.') : 'No breaking-change marker.',
      ignoredLines.length > 0 ? 'Ignored ' + ignoredLines.length + ' extra line(s) after the subject — use the body option instead.' : '',
    ].filter(Boolean),
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
