/**
 * PDF Redact core - handles redaction logic
 */
import { PDFDocument, rgb } from 'pdf-lib';
import type { ToolError } from '@/lib/types';

export interface RedactionBox {
  pageIndex: number;
  x: number; // in points (PDF coordinates, origin bottom-left)
  y: number;
  width: number;
  height: number;
}

export interface RedactOptions {
  redactionColor: 'black' | 'white' | 'red';
  dpi: number;
}

const COLOR_MAP = {
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  red: rgb(1, 0, 0),
};

/**
 * Apply redactions to a PDF by rasterizing pages with redactions and
 * replacing them with the rasterized version.
 */
export async function applyRedactions(
  pdfBytes: Uint8Array,
  redactions: RedactionBox[],
  options: RedactOptions
): Promise<Uint8Array> {
  if (redactions.length === 0) {
    return pdfBytes; // No changes
  }

  // Group redactions by page
  const redactionsByPage = new Map<number, RedactionBox[]>();
  for (const r of redactions) {
    const arr = redactionsByPage.get(r.pageIndex) || [];
    arr.push(r);
    redactionsByPage.set(r.pageIndex, arr);
  }

  // Load original PDF with pdf-lib to get page dimensions
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  // Create new PDF document
  const newPdf = await PDFDocument.create();

  // Import pdfjs for rasterization
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfjsDoc = await loadingTask.promise;

  const color = COLOR_MAP[options.redactionColor];
  const scale = options.dpi / 72; // PDF points to pixels at target DPI

  // Process each page
  for (let i = 0; i < pages.length; i++) {
    const pageRedactions = redactionsByPage.get(i) || [];

    if (pageRedactions.length === 0) {
      // No redactions on this page - copy as-is
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(copiedPage);
      continue;
    }

    // Page has redactions - rasterize it
    const pdfjsPage = await pdfjsDoc.getPage(i + 1);
    const viewport = pdfjsPage.getViewport({ scale });

    // Create canvas for rasterization
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render page to canvas
    await pdfjsPage.render({ canvasContext: context, viewport }).promise;

    // Draw redaction boxes on canvas
    context.fillStyle = options.redactionColor;
    for (const r of pageRedactions) {
      // Convert PDF coordinates (bottom-left origin) to canvas (top-left origin)
      const x = r.x * scale;
      const y = viewport.height - (r.y + r.height) * scale;
      const w = r.width * scale;
      const h = r.height * scale;
      context.fillRect(x, y, w, h);
    }

    // Convert canvas to image
    const imageDataUrl = canvas.toDataURL('image/png');
    const base64 = imageDataUrl.split(',')[1] ?? '';
    const imageBytes = base64ToBytes(base64);

    // Embed image in new PDF
    const pngImage = await newPdf.embedPng(imageBytes);
    const pageWidth = pages[i]?.getWidth() ?? 0;
    const pageHeight = pages[i]?.getHeight() ?? 0;

    const newPage = newPdf.addPage([pageWidth, pageHeight]);
    newPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    pdfjsPage.cleanup();
  }

  await pdfjsDoc.destroy();
  return newPdf.save();
}

/** Convert base64 to Uint8Array */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Load pdfjs dynamically */
interface PdfJsModule {
  getDocument: (params: { data: Uint8Array }) => import('pdfjs-dist').PDFDocumentLoadingTask;
  GlobalWorkerOptions: { workerSrc: string };
}
interface PdfJsDocument {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
}
interface PdfJsPage {
  getViewport: (params: { scale: number; rotation?: number; offsetX?: number; offsetY?: number; dontFlip?: boolean }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
  cleanup: () => void;
}
let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      if (typeof window !== 'undefined') {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).href;
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise!;
}