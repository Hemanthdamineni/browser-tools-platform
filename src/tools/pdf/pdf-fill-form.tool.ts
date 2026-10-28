import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { abort, firstFile, loadPdf, output, resolve } from './shared';
import { meta } from './pdf-fill-form.meta';
import { fillFormFields, parseFieldValues, type FillFormOptions } from './pdf-fill-form.core';
async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  input.onProgress?.(0, 'Reading PDF');

  const doc = await loadPdf(file);
  abort(input);

  const options: FillFormOptions = {
    flatten: Boolean(o.flatten ?? true),
    fieldValues: parseFieldValues(String(o.fieldValues ?? '{}')),
  };

  const filled = await fillFormFields(doc, options);

  const filename = signedFilename(file.name); // reuse name logic if possible
  const bytes = await filled.save();
  const result = output(filename, bytes);
  result.stats = { pages: doc.getPageCount(), bytes: bytes.length };
  return result;
}

function signedFilename(original: string): string {
  const base = original.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}-filled.pdf`;
}

const tool: FileToolModule = { meta, run };
export default tool;
