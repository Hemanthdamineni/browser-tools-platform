import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { zipSync } from 'fflate';
import * as pdfjsLib from 'pdfjs-dist';
import { abort, firstFile, output, parsePages, resolve } from './shared';
import { meta } from './pdf-to-images.meta';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolve(input, meta);
  const file = firstFile(input);
  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  } catch (error) {
    if (/password/i.test(error instanceof Error ? error.message : '')) throw new ToolError('This PDF is password-protected — unlock it first.');
    throw new ToolError('This file is not a valid, readable PDF.');
  }
  abort(input);
  const pages = parsePages(o.pages, pdf.numPages);
  if (typeof OffscreenCanvas === 'undefined') throw new ToolError('This browser does not support worker-based PDF rendering.', 'Try an up-to-date browser with OffscreenCanvas support.');
  const format = String(o.format || 'png');
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const scale = Math.max(1, Math.min(4, Number(o.scale) || 2));
  const quality = Math.max(1, Math.min(100, Number(o.quality) || 90)) / 100;
  const entries: Record<string, Uint8Array> = {};
  let totalSize = 0;

  try {
    for (let i = 0; i < pages.length; i++) {
      abort(input);
      const pageNumber = pages[i]!;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      if (!context) throw new ToolError('Could not create a canvas for PDF rendering.');
      await page.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: mime, quality });
      const name = `page-${String(pageNumber).padStart(3, '0')}.${format === 'jpeg' ? 'jpg' : format}`;
      entries[name] = new Uint8Array(await blob.arrayBuffer());
      totalSize += blob.size;
      input.onProgress?.((i + 1) / pages.length, `Rendered page ${pageNumber}`);
      page.cleanup();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/password/i.test(message)) throw new ToolError('This PDF is password-protected — unlock it first.');
    if (error instanceof ToolError) throw error;
    throw new ToolError('The PDF could not be rendered. It may be corrupt or use unsupported content.');
  } finally {
    await pdf.destroy();
  }

  const result = pages.length === 1
    ? output(Object.keys(entries)[0]!, Object.values(entries)[0]!, mime)
    : output('pdf-images.zip', zipSync(entries, { level: 6 }), 'application/zip');
  result.stats = { pages: pages.length, size: totalSize };
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
