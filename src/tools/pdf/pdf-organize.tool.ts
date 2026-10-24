import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { PDFDocument } from 'pdf-lib';
import { abort, firstFile, loadPdf, output, resolve } from './shared';
import { assembleInto, parsePlan } from './pdf-organize.core';
import { meta } from './pdf-organize.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);

  input.onProgress?.(0, 'Reading PDF');
  const source = await loadPdf(file);
  const total = source.getPageCount();
  abort(input);

  const plan = parsePlan(o.pages, total, o.blankSize);
  abort(input);

  input.onProgress?.(0.1, `Building ${plan.length} pages`);
  const out = await PDFDocument.create();
  await assembleInto(out, source, plan, (fraction, message) => {
    input.onProgress?.(0.1 + 0.9 * fraction, message);
  });
  const bytes = await out.save();

  const result = output(String(o.outputName || 'organized.pdf'), bytes);
  result.stats = {
    pages: plan.length,
    sourcePages: total,
    bytes: bytes.length,
  };
  const blank = plan.filter((entry) => entry.blank).length;
  const rotated = plan.filter((entry) => !entry.blank && entry.rotate !== 0).length;
  if (blank) result.stats.blankPages = blank;
  if (rotated) result.stats.rotatedPages = rotated;
  if (plan.length !== total) {
    result.notes = [
      `The new PDF has ${plan.length} of ${total} pages — ${total - plan.length} were removed.`,
    ];
  }
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
