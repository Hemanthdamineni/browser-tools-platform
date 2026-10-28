import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pdf-ocr.meta';
import { ocrPdf } from './pdf-ocr.core';
import type { PdfOcrOptions } from './pdf-ocr.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose a PDF file.');

  const file = files[0]!;
  onProgress?.(0.05, 'Reading PDF');

  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);
  signal?.throwIfAborted?.();

  const options: PdfOcrOptions = {
    language: String(o.language ?? 'eng'),
    dpi: Number(o.dpi ?? 300),
    outputType: String(o.outputType ?? 'pdf') as PdfOcrOptions['outputType'],
  };

  onProgress?.(0.1, 'Starting OCR...');

  const result = await ocrPdf(pdfBytes, options, onProgress);
  signal?.throwIfAborted?.();

  const outputs: FileRunResult['outputs'] = [];
  const stem = file.name.replace(/\.pdf$/i, '');

  if (result.pdfBytes) {
    outputs.push({
      filename: `${stem}-ocr.pdf`,
      blob: new Blob([result.pdfBytes], { type: 'application/pdf' }),
    });
  }

  if (result.text) {
    outputs.push({
      filename: `${stem}-ocr.txt`,
      blob: new Blob([result.text], { type: 'text/plain' }),
    });
  }

  onProgress?.(1, 'Done');

  return {
    outputs,
    notes: [
      `OCR completed on ${result.stats.pages} page(s)`,
      `Average confidence: ${result.stats.avgConfidence.toFixed(1)}%`,
      `Total words recognized: ${result.stats.totalWords}`,
    ],
    stats: result.stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;