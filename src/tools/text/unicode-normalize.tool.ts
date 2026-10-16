import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './unicode-normalize.meta';

const FORMS = new Set(['NFC', 'NFD', 'NFKC', 'NFKD']);

function normalizeLineEndings(text: string, target: string): string {
  if (target === 'preserve') return text;
  const lf = text.replace(/\r\n|\r/g, '\n');
  if (target === 'crlf') return lf.replace(/\n/g, '\r\n');
  if (target === 'cr') return lf.replace(/\n/g, '\r');
  return lf;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const form = String(o.form);
  if (!FORMS.has(form)) {
    throw new ToolError('Choose a valid Unicode normalization form.', 'Select NFC, NFD, NFKC or NFKD.');
  }
  const lineEndings = String(o.lineEndings);
  if (!['preserve', 'lf', 'crlf', 'cr'].includes(lineEndings)) {
    throw new ToolError('Choose a valid line-ending style.', 'Select Preserve, LF, CRLF or CR.');
  }

  let output = input.text.normalize(form as 'NFC' | 'NFD' | 'NFKC' | 'NFKD');
  if (o.stripMarks) {
    // Decompose first so precomposed accents become removable combining marks.
    output = output.normalize(form.startsWith('NFK') ? 'NFKD' : 'NFD').replace(/\p{M}/gu, '');
  }
  output = normalizeLineEndings(output, lineEndings);

  return {
    output,
    render: 'code',
    stats: {
      form,
      'input characters': [...input.text].length,
      'output characters': [...output].length,
      'changed': output === input.text ? 'no' : 'yes',
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
