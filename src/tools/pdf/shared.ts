import { PDFDocument } from 'pdf-lib';
import { ToolError, type FileRunInput, type FileRunResult, type ToolMeta } from '@/lib/types';
import { resolveOptions } from '@/lib/options';

export const pdfCredit = {
  name: 'pdf-lib',
  url: 'https://github.com/Hopding/pdf-lib',
  license: 'MIT',
};
export const pdfjsCredit = {
  name: 'pdfjs-dist',
  url: 'https://github.com/mozilla/pdf.js',
  license: 'Apache-2.0',
};
export const fflateCredit = {
  name: 'fflate',
  url: 'https://github.com/101arrowz/fflate',
  license: 'MIT',
};
export function firstFile(input: FileRunInput): File {
  if (!input.files?.length) throw new ToolError('Choose a PDF file.');
  return input.files[0]!;
}
export async function loadPdf(file: File): Promise<PDFDocument> {
  try {
    if (!file.size) throw new Error('empty');
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    if (!doc.getPageCount()) throw new Error('empty');
    return doc;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/password|encrypted/i.test(message))
      throw new ToolError('This PDF is password-protected — unlock it first.');
    throw new ToolError('This file is not a valid, readable PDF.');
  }
}
export function parsePages(value: unknown, total: number, allowAll = true): number[] {
  const text = String(value ?? '').trim();
  if (allowAll && (!text || text.toLowerCase() === 'all'))
    return Array.from({ length: total }, (_, i) => i + 1);
  if (!text) throw new ToolError('Enter at least one page number.');
  const pages: number[] = [];
  for (const part of text.split(',')) {
    const token = part.trim();
    const match = /^(\d+)(?:\s*-\s*(\d*)?)?$/.exec(token);
    if (!match) throw new ToolError('Enter pages as a list or ranges, such as 1,3-5.');
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : match[2] === '' ? total : Number(match[2]);
    if (start < 1 || end < start || end > total)
      throw new ToolError(`Page range "${token}" is outside this PDF (1–${total}).`);
    for (let page = start; page <= end; page++) pages.push(page);
  }
  if (!pages.length) throw new ToolError('Enter at least one page number.');
  return pages;
}
export function resolve(input: FileRunInput, meta: ToolMeta) {
  return resolveOptions(meta, input.options);
}
export function output(
  filename: string,
  bytes: Uint8Array,
  type = 'application/pdf',
): FileRunResult {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return { outputs: [{ filename, blob: new Blob([copy.buffer], { type }) }] };
}
export function abort(input: FileRunInput) {
  if (input.signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}
export { PDFDocument, ToolError };
