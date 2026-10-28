import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { PDFDocument, abort, assertPdfWithinLimit, output, resolve } from './shared';
import { meta } from './pdf-merge.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const { files, onProgress } = input;
  if (files.length < 2)
    throw new ToolError('Choose at least two PDF files.', 'Merging needs two or more documents.');

  const out = await PDFDocument.create();
  let totalPages = 0;
  for (let i = 0; i < files.length; i++) {
    abort(input);
    const file = files[i]!;
    assertPdfWithinLimit(file.size);
    let source: PDFDocument;
    try {
      if (!file.size) throw new ToolError(`"${file.name}" is empty.`);
      source = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), {
        ignoreEncryption: false,
      });
    } catch (error) {
      if (error instanceof ToolError) throw error;
      const message = error instanceof Error ? error.message : '';
      if (/password|encrypted/i.test(message))
        throw new ToolError(`"${file.name}" is password-protected — unlock it first.`);
      throw new ToolError(`"${file.name}" is not a valid, readable PDF.`);
    }
    const pages = await out.copyPages(source, source.getPageIndices());
    pages.forEach((page) => out.addPage(page));
    totalPages += pages.length;
    onProgress?.((i + 1) / files.length, `Merged ${file.name}`);
  }

  const bytes = await out.save();
  const result = output(String(o.outputName || 'merged.pdf'), bytes);
  result.stats = { files: files.length, pages: totalPages, bytes: bytes.length };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
