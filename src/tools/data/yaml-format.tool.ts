import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { parseAllDocuments } from 'yaml';
import { meta } from './yaml-format.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const documents = parseAllDocuments(input.text, { uniqueKeys: true });
  const errors = documents.flatMap((document) => document.errors);
  if (errors.length) {
    throw new ToolError('Invalid YAML input.', errors.map((error) => error.message).join(' '));
  }

  const warnings = documents.flatMap((document) =>
    document.warnings.map((warning) => warning.message),
  );
  const output = documents.length
    ? documents
        .map((document) =>
          document.toString({ indent: o.indent === '4' ? 4 : 2, lineWidth: 0 }).trimEnd(),
        )
        .join('\n') + '\n'
    : `${input.text.trimEnd()}\n`;

  return {
    output,
    render: 'code',
    language: 'yaml',
    filename: 'formatted.yaml',
    warnings: warnings.length ? warnings : undefined,
    stats: {
      documents: documents.length,
      'input chars': input.text.length,
      'output chars': output.length,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
