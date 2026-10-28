/**
 * PDF OCR core - uses Tesseract.js to OCR PDF pages and create searchable PDFs
 */
import { PDFDocument, rgb } from 'pdf-lib';

export interface PdfOcrOptions {
  language: string;
  dpi: number;
  outputType: 'pdf' | 'txt' | 'both';
}

export interface OcrResult {
  text: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
    words: Array<{
      text: string;
      bbox: { x0: number; y0: number; x1: number; y1: number };
      confidence: number;
    }>;
  }>;
}

/** Load Tesseract.js dynamically */
interface TesseractModule {
  createWorker: (langs?: string | string[], oem?: number, options?: Record<string, unknown>, config?: string) => Promise<unknown>;
}
interface TesseractWorker {
  recognize: (canvas: HTMLCanvasElement, options?: Record<string, unknown>, output?: Record<string, unknown>, jobId?: string) => Promise<{ data: TesseractPage }>;
  terminate: (jobId?: string) => Promise<void>;
  setParameters: (params: Record<string, string>, jobId?: string) => Promise<void>;
}
  text: string;
  confidence: number;
  blocks: Array<{
    paragraphs: Array<{
      lines: Array<{
        words: Array<{
          text: string;
          bbox: { x0: number; y0: number; x1: number; y1: number };
          confidence: number;
        }>;
      }>;
    }>;
  }>;
}
let tesseractPromise: Promise<TesseractModule> | null = null;

async function loadTesseract(): Promise<TesseractModule> {
  if (!tesseractPromise) {
    tesseractPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return { createWorker };
    })();
  }
  return tesseractPromise!;
}

/** Load pdfjs dynamically */
interface PdfJsModule {
  getDocument: (params: { data: Uint8Array }) => import('pdfjs-dist').PDFDocumentLoadingTask;
  GlobalWorkerOptions: { workerSrc: string };
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

/**
 * Perform OCR on a PDF file
 */
export async function ocrPdf(
  pdfBytes: Uint8Array,
  options: PdfOcrOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<{ pdfBytes?: Uint8Array; text?: string; stats: { pages: number; totalWords: number; avgConfidence: number } }> {
  const { createWorker } = await loadTesseract();
  const pdfjs = await loadPdfJs();

  // Load PDF with pdfjs to get page images
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });
  const pdfjsDoc = await loadingTask.promise;
  const totalPages = pdfjsDoc.numPages;

  // Load PDF with pdf-lib for output
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pdfLibPages = pdfDoc.getPages();

  // Create Tesseract worker
  const worker = await createWorker(options.language);
  await worker.setParameters({
    tessedit_pageseg_mode: '1', // PSM_AUTO_OSD
    preserve_interword_spaces: '1',
  });

  const allText: string[] = [];
  const pageResults: OcrResult['pages'] = [];

  for (let i = 0; i < totalPages; i++) {
    onProgress?.((i / totalPages) * 0.9, `OCR page ${i + 1} of ${totalPages}`);

    const page = await pdfjsDoc.getPage(i + 1);
    const viewport = page.getViewport({ scale: options.dpi / 72 });

    // Render page to canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    // Run OCR
    const { data } = await worker.recognize(canvas);

    const pageText = data.text || '';
    allText.push(pageText);

    // Extract word-level data for text layer from nested blocks/paragraphs/lines structure
    const words: OcrResult['pages'][0]['words'] = [];
    if (data.blocks) {
      for (const block of data.blocks) {
        if (block.paragraphs) {
          for (const paragraph of block.paragraphs) {
            if (paragraph.lines) {
              for (const line of paragraph.lines) {
                if (line.words) {
                  for (const w of line.words) {
                    words.push({
                      text: w.text,
                      bbox: {
                        x0: w.bbox.x0,
                        y0: w.bbox.y0,
                        x1: w.bbox.x1,
                        y1: w.bbox.y1,
                      },
                      confidence: w.confidence,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    pageResults.push({
      pageNumber: i + 1,
      text: pageText,
      confidence: data.confidence || 0,
      words,
    });

    page.cleanup();
  }

  // Keep pdfjsDoc alive for second pass - don't destroy yet

  await worker.terminate();

  const fullText = allText.join('\n\n');

  let outputPdfBytes: Uint8Array | undefined;

  if (options.outputType === 'pdf' || options.outputType === 'both') {
    onProgress?.(0.9, 'Building searchable PDF...');

    // Create new PDF with text layer
    const newPdf = await PDFDocument.create();
    const { StandardFonts } = await import('pdf-lib');
    const font = await newPdf.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < totalPages; i++) {
      const pageResult = pageResults[i];
      if (!pageResult) continue;
      
      const origPage = pdfLibPages[i];
      if (!origPage) continue;
      
      const { width, height } = origPage.getSize();

      // Add original page as image (we need to re-render at a reasonable DPI)
      const page = await pdfjsDoc.getPage(i + 1);
      const viewport = page.getViewport({ scale: 150 / 72 }); // Use 150 DPI for output image

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;

      const imageDataUrl = canvas.toDataURL('image/png');
      const base64 = imageDataUrl.split(',')[1] ?? '';
      const imageBytes = base64ToBytes(base64);
      const pngImage = await newPdf.embedPng(imageBytes);

      const newPage = newPdf.addPage([width, height]);
      newPage.drawImage(pngImage, { x: 0, y: 0, width, height });

      // Add invisible text layer
      if (pageResult.words.length > 0) {
        // Group words by line (approximate)
        const lines = groupWordsIntoLines(pageResult.words);

        for (const line of lines) {
          const lineText = line.map(w => w.text).join(' ');
          const avgConfidence = line.reduce((sum, w) => sum + w.confidence, 0) / line.length;

          if (avgConfidence < 30) continue; // Skip low confidence

          // Calculate line bounding box
          const x0 = Math.min(...line.map(w => w.bbox.x0));
          const y0 = Math.min(...line.map(w => w.bbox.y0));
          const x1 = Math.max(...line.map(w => w.bbox.x1));
          const y1 = Math.max(...line.map(w => w.bbox.y1));

          // Convert from image coordinates (top-left, dpi scaled) to PDF coordinates (bottom-left, points)
          const scaleX = width / viewport.width;
          const scaleY = height / viewport.height;

          const pdfX = x0 * scaleX;
          const pdfY = height - y1 * scaleY; // Flip Y
          const pdfHeight = (y1 - y0) * scaleY;

          // Draw invisible text (font size based on height)
          const fontSize = Math.max(4, pdfHeight * 0.8);
          newPage.drawText(lineText, {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0, // Invisible text layer
          });
        }
      }

      page.cleanup();
    }

    await pdfjsDoc.destroy();

    outputPdfBytes = await newPdf.save();
  } else {
    await pdfjsDoc.destroy();
  }

  onProgress?.(1, 'Done');

  return {
    pdfBytes: outputPdfBytes,
    text: options.outputType === 'txt' || options.outputType === 'both' ? fullText : undefined,
    stats: {
      pages: totalPages,
      totalWords: pageResults.reduce((sum, p) => sum + p.words.length, 0),
      avgConfidence: pageResults.length > 0
        ? pageResults.reduce((sum, p) => sum + p.confidence, 0) / pageResults.length
        : 0,
    },
  };
}

function groupWordsIntoLines(words: OcrResult['pages'][0]['words']): typeof words[] {
  if (words.length === 0) return [];

  // Sort by y then x
  const sorted = [...words].sort((a, b) => {
    const yDiff = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(yDiff) > 10) return yDiff;
    return a.bbox.x0 - b.bbox.x0;
  });

  if (sorted.length === 0) return [];

  const lines: typeof words[] = [];
  const firstWord = sorted[0];
  if (!firstWord) return [];
  let currentLine: typeof words = [firstWord];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev || !curr) continue;
    
    const yDiff = Math.abs(curr.bbox.y0 - prev.bbox.y0);

    if (yDiff < 10) {
      // Same line
      currentLine.push(curr);
    } else {
      // New line
      lines.push(currentLine);
      currentLine = [curr];
    }
  }
  lines.push(currentLine);

  return lines;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}