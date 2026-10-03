import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { abort, firstFile, loadPdf, output, parsePages, resolve } from './shared';
import { meta } from './pdf-delete-pages.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  input.onProgress?.(0, 'Reading PDF');
  const doc = await loadPdf(file);
  const total = doc.getPageCount();
  abort(input);
  const selection = [...new Set(parsePages(o.pages, total, false))].sort((a, b) => b - a);
  if (selection.length >= total)
    throw new ToolError('This would delete every page — a PDF needs at least one page.');

  for (let i = 0; i < selection.length; i++) {
    doc.removePage(selection[i]! - 1);
    input.onProgress?.((i + 1) / selection.length, `Deleted page ${selection[i]}`);
  }

  const bytes = await doc.save();
  const result = output('trimmed.pdf', bytes);
  result.stats = {
    inputPages: total,
    deleted: selection.length,
    remaining: total - selection.length,
  };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
