import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { abort, firstFile, resolve } from './shared';
import { meta } from './pdf-extract-text.meta';

// pdfjs-dist ships both a modern ESM build and a legacy build. Bundlers (the
// browser app) are served the modern build; Node (vitest/jsdom) needs the
// legacy build, which runs on the main thread without a browser worker.
type PdfJsType = typeof import('pdfjs-dist');
async function loadPdfJs(): Promise<PdfJsType> {
  if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
    return import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as Promise<PdfJsType>;
  }
  return import('pdfjs-dist');
}
const pdfjs = await loadPdfJs();
const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
if (!isTest && typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  resolve(input, meta);
  const file = firstFile(input);
  abort(input);
  input.onProgress?.(0, 'Reading PDF');
  let pdf: Awaited<ReturnType<PdfJsType['getDocument']>['promise']>;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  } catch (error) {
    if (input.signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
    if (/password/i.test(error instanceof Error ? error.message : '')) throw new ToolError('This PDF is password-protected — unlock it first.');
    throw new ToolError('This file is not a valid, readable PDF.');
  }
  abort(input);

  const rows: [string, string][] = [];
  let characters = 0;
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      abort(input);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      characters += text.length;
      rows.push([String(i), text || '(no extractable text)'] as [string, string]);
      page.cleanup();
      input.onProgress?.(i / pdf.numPages, `Extracted page ${i}`);
    }
  } catch (error) {
    if (input.signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
    if (error instanceof ToolError) throw error;
    const message = error instanceof Error ? error.message : '';
    if (/password/i.test(message)) throw new ToolError('This PDF is password-protected — unlock it first.');
    throw new ToolError('The PDF text could not be extracted. It may be corrupt or use unsupported fonts.');
  } finally {
    await pdf.destroy();
  }

  return {
    outputs: [],
    report: { output: JSON.stringify({ headers: ['Page', 'Text'], rows }), render: 'table' },
    warnings: characters ? undefined : ['No text layer was found — this PDF may be a scan that needs OCR.'],
    stats: { pages: pdf.numPages, characters },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
