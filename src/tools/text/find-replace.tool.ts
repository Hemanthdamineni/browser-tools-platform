import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './find-replace.meta';

const escapeLiteral = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildRegex(find: string, mode: string, flags: string, ci: boolean): RegExp {
  if (mode === 'regex') {
    let f = flags;
    if (ci && !f.includes('i')) f += 'i';
    try {
      return new RegExp(find, f);
    } catch (e) {
      throw new ToolError(
        `Invalid regular expression: ${(e as Error).message}`,
        'Check the pattern and the flags field.',
      );
    }
  }

  const body = mode === 'whole-word' ? `\\b${escapeLiteral(find)}\\b` : escapeLiteral(find);
  return new RegExp(body, ci ? 'gi' : 'g');
}

function countMatches(re: RegExp, text: string): number {
  if (re.global) return (text.match(re) ?? []).length;
  const hit = re.test(text);
  re.lastIndex = 0;
  return hit ? 1 : 0;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  const find = String(o.find ?? '');
  if (find.length === 0) {
    throw new ToolError('Enter the text to find.', 'The "Find" field is required.');
  }

  if (!input.text) return { output: '' };

  const mode = String(o.mode);
  const ci = Boolean(o.caseInsensitive);
  const replaceRaw = String(o.replace ?? '');
  const re = buildRegex(find, mode, String(o.flags ?? 'g'), ci);

  const replacement = mode === 'regex' ? replaceRaw : replaceRaw.replace(/\$/g, '$$$$');
  const count = countMatches(re, input.text);
  const output = input.text.replace(re, replacement);

  return {
    output,
    stats: { 'replacements made': count },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
