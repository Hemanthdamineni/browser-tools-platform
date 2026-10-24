/**
 * Fill a PDF's AcroForm and flatten it.
 *
 * The panel (`pdf-fill-form.astro` → `pdf-fill-form-panel.ts`) reads the form
 * and collects the values; this module re-reads nothing it can avoid: it loads
 * the PDF, applies the values by field kind, paints the appearances and
 * flattens the form, all through the pure helpers in `pdf-fill-form.core.ts`,
 * so the worker and the panel always agree on the result.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { abort, firstFile, output, resolve } from './shared';
import { fillAndFlatten, filledFilename, parseValues } from './pdf-fill-form.core';
import { meta } from './pdf-fill-form.meta';

/** The download name: the requested one (with a `.pdf` ending) or a derived one. */
function resolveOutputName(requested: string, source: string): string {
  const name = requested.trim();
  if (!name) return filledFilename(source);
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);

  input.onProgress?.(0, 'Reading PDF');
  const bytes = new Uint8Array(await file.arrayBuffer());
  abort(input);

  const values = parseValues(o.values);
  input.onProgress?.(0.25, 'Filling fields');
  const outcome = await fillAndFlatten(bytes, values);
  abort(input);

  const result = output(resolveOutputName(String(o.outputName ?? ''), file.name), outcome.bytes);
  result.stats = {
    fields: outcome.fields,
    filled: outcome.filled,
    bytes: outcome.bytes.length,
  };
  if (outcome.filled < outcome.fields) {
    const blank = outcome.fields - outcome.filled;
    result.notes = [`${blank} of ${outcome.fields} fields were left blank.`];
  }
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;