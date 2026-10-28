import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { PDFDocument, abort, firstFile, loadPdf, output, parsePages, resolve } from './shared';
import { meta } from './pdf-extract-pages.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  input.onProgress?.(0, 'Reading PDF');
  const source = await loadPdf(file);
  const total = source.getPageCount();
  abort(input);
  const selection = parsePages(o.pages, total);

  const out = await PDFDocument.create();
  const pages = await out.copyPages(
    source,
    selection.map((p) => p - 1),
  );
  pages.forEach((page) => out.addPage(page));
  const bytes = await out.save();
  input.onProgress?.(1, 'Done');
  const result = output('extracted.pdf', bytes);
  result.stats = { inputPages: total, extractedPages: pages.length };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
