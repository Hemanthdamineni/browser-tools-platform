import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { abort, firstFile, output } from './shared';
import { meta } from './pdf-ocr.meta';
import {
  buildOcrPlan,
  buildTextLayer,
  drawInvisibleTextLayer,
  encodableText,
  flattenTesseractWords,
  outputNameFor,
  type OcrPlan,
} from '@/components/panels/pdf-ocr-panel';
import {
  ocrLanguageLabel,
  ocrTextStats,
  resolveOcrMode,
} from '@/tools/image/ocr-languages';
import { supportsSimd } from '@/tools/image/ocr-image';
import { context2d, createCanvas, encodeCanvas, throwIfAborted } from '@/tools/image/image-batch';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

/**
 * The Tesseract engine, its language models and its worker script are all
 * served from this origin (see `scripts/vendor-tesseract.mjs`), exactly as
 * `image-ocr` loads them. Nothing is ever fetched from a CDN.
 */
const SITE_BASE = import.meta.env.BASE_URL || '/';
const ASSET_BASE = `${SITE_BASE}vendor/tesseract`;
const WORKER_PATH = `${ASSET_BASE}/worker.min.js`;
const LANG_PATH = `${ASSET_BASE}/lang`;
const CORE_SIMD_PATH = `${ASSET_BASE}/core/tesseract-core-simd-lstm.wasm.js`;
const CORE_PLAIN_PATH = `${ASSET_BASE}/core/tesseract-core-lstm.wasm.js`;

/** Tesseract's LSTM-only engine mode. The legacy engine is not shipped. */
const OEM_LSTM_ONLY = 1;

/** How much of the progress bar the engine start-up takes. */
const SETUP_SHARE = 0.2;

/** The phases tesseract.js reports while it starts up, and their share of it. */
const SETUP_PHASES: Record<string, [number, number]> = {
  'loading tesseract core': [0, 0.55],
  'loading language traineddata': [0.55, 0.85],
  'initializing tesseract': [0.85, 0.95],
  'initializing api': [0.95, 1],
};

const SETUP_MESSAGES: Record<string, string> = {
  'loading tesseract core': 'Loading the OCR engine…',
  'loading language traineddata': 'Loading the language model…',
  'initializing tesseract': 'Starting the OCR engine…',
  'initializing api': 'Starting the OCR engine…',
};

/** The slice of the tesseract.js API this tool uses. */
interface OcrEngine {
  recognize(
    image: Blob,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ): Promise<{ data?: { text?: string; confidence?: number; blocks?: unknown } }>;
  setParameters(params: Record<string, unknown>): Promise<unknown>;
  terminate(): Promise<unknown>;
}

type CreateWorker = (
  langs: string,
  oem: number,
  options: Record<string, unknown>,
) => Promise<OcrEngine>;

/** Turn anything thrown into an Error with a readable message. */
function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error('Unknown error');
  }
}

/** `DOMException` used to report a cancelled run. */
function abortError(): DOMException {
  return new DOMException('The operation was cancelled.', 'AbortError');
}

/**
 * Reject as soon as the caller cancels, instead of waiting for the promise it
 * is racing to settle. The work itself is stopped by the abort listener, which
 * terminates the Tesseract worker.
 */
function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  const raced = Promise.withResolvers<T>();
  const onAbort = () => raced.reject(abortError());
  signal.addEventListener('abort', onAbort, { once: true });
  promise.then(
    (value) => {
      signal.removeEventListener('abort', onAbort);
      raced.resolve(value);
    },
    (error) => {
      signal.removeEventListener('abort', onAbort);
      raced.reject(error);
    },
  );
  return raced.promise;
}

/** Pull `createWorker` out of the dynamically imported module, whatever shape it takes. */
function pickCreateWorker(module: unknown): CreateWorker {
  const candidates = [module, (module as { default?: unknown } | null)?.default];
  for (const candidate of candidates) {
    const fn = (candidate as { createWorker?: unknown } | null)?.createWorker;
    if (typeof fn === 'function') return fn as CreateWorker;
  }
  throw new ToolError('The OCR engine could not be loaded.', 'Reload the page and try again.');
}

/** Explain a failure of the engine in words the visitor can act on. */
function explainEngineError(error: unknown, language: string): ToolError {
  const message = toError(error).message;
  if (/traineddata|initialization failed|language/i.test(message)) {
    return new ToolError(
      `The ${ocrLanguageLabel(language)} language model could not be loaded.`,
      'The model files are served from this site — reload the page and try again.',
    );
  }
  if (/core|wasm|WebAssembly|memory/i.test(message)) {
    return new ToolError(
      'The OCR engine could not be started.',
      'Reload the page and try again, or close other tabs that are using a lot of memory.',
    );
  }
  return new ToolError(`The OCR engine could not be started: ${message || 'unknown error'}.`);
}

/** A load error for a PDF that pdf.js refused. */
function explainPdfError(error: unknown): ToolError {
  const message = error instanceof Error ? error.message : '';
  if (/password/i.test(message))
    return new ToolError('This PDF is password-protected — unlock it first.');
  return new ToolError('This file is not a valid, readable PDF.');
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const file = firstFile(input);
  const signal = input.signal;

  input.onProgress?.(0, 'Reading the PDF…');
  let pdf: PDFDocumentProxy;
  try {
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
    }).promise;
  } catch (error) {
    throw explainPdfError(error);
  }

  let out: PDFDocument;
  let plan: OcrPlan;
  try {
    abort(input);
    // `buildOcrPlan` throws a ToolError for a bad page range or language.
    plan = buildOcrPlan(o, pdf.numPages);
    out = await PDFDocument.create();
  } catch (error) {
    await pdf.destroy().catch(() => undefined);
    throw error;
  }
  if (!plan.pages.length) {
    await pdf.destroy().catch(() => undefined);
    throw new ToolError('There are no pages to read.');
  }
  const pageCount = plan.pages.length;
  throwIfAborted(signal);

  const font = await out.embedFont(StandardFonts.Helvetica);
  const mode = resolveOcrMode(plan.mode).psm;

  input.onProgress?.(SETUP_SHARE * 0.1, 'Loading the OCR engine…');
  const createWorker = pickCreateWorker(await import('tesseract.js'));

  let engine: OcrEngine | null = null;
  let engineReady = false;
  const { promise: creationFailure, reject: rejectCreation } =
    Promise.withResolvers<never>();
  let currentPage = plan.pages[0] ?? 1;

  const logger = (event: { status?: string; progress?: number }) => {
    const status = String(event?.status ?? '');
    const progress = Math.min(1, Math.max(0, Number(event?.progress ?? 0)));
    if (status === 'recognizing text') {
      const index = plan.pages.indexOf(currentPage);
      const within = (Math.max(0, index) + progress) / pageCount;
      input.onProgress?.(
        SETUP_SHARE + (1 - SETUP_SHARE) * within,
        `Reading page ${currentPage}…`,
      );
      return;
    }
    const phase = SETUP_PHASES[status];
    if (!phase) return;
    const within = phase[0] + (phase[1] - phase[0]) * progress;
    input.onProgress?.(SETUP_SHARE * within, SETUP_MESSAGES[status] ?? 'Starting the OCR engine…');
  };

  const errorHandler = (error: unknown) => {
    if (!engineReady) rejectCreation(toError(error));
  };

  const creating = createWorker(plan.language, OEM_LSTM_ONLY, {
    workerPath: WORKER_PATH,
    corePath: supportsSimd() ? CORE_SIMD_PATH : CORE_PLAIN_PATH,
    langPath: LANG_PATH,
    workerBlobURL: false,
    gzip: true,
    logger,
    errorHandler,
  });

  creating.then(
    (created) => {
      if (signal?.aborted) void created.terminate().catch(() => {});
    },
    () => {},
  );

  const onAbort = () => {
    void engine?.terminate().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const warnings: string[] = [];
  let characters = 0;
  let words = 0;
  let emptyPages = 0;
  let unencodableWords = 0;

  try {
    engine = await raceAbort(Promise.race([creating, creationFailure]), signal);
    engineReady = true;
    const ocr: OcrEngine = engine;
    await ocr.setParameters({ tessedit_pageseg_mode: mode });

    for (let index = 0; index < pageCount; index++) {
      throwIfAborted(signal);
      const pageNumber = plan.pages[index]!;
      currentPage = pageNumber;
      input.onProgress?.(
        SETUP_SHARE + (1 - SETUP_SHARE) * (index / pageCount),
        `Reading page ${pageNumber}…`,
      );

      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      try {
        let png: Blob;
        try {
          const viewport = page.getViewport({ scale: plan.scale });
          const canvas = createCanvas(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
            'page',
          );
          const context = context2d(canvas);
          await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            viewport,
          }).promise;
          png = await encodeCanvas(canvas, 'image/png');
        } catch (error) {
          if (signal?.aborted || error instanceof ToolError) throw error;
          throw new ToolError(
            `Page ${pageNumber} could not be rendered.`,
            'The page may be damaged or use content this browser cannot draw.',
          );
        }
        throwIfAborted(signal);

        const result = await raceAbort(ocr.recognize(png, {}, { text: true, blocks: true }), signal);
        const layerWords = flattenTesseractWords(result?.data?.blocks);
        const items = buildTextLayer(layerWords, plan.scale, {
          width: base.width,
          height: base.height,
        });

        // The output page is the rendered page's size; the raster fills it, and
        // the invisible layer sits exactly on top of the words it came from.
        const outPage = out.addPage([base.width, base.height]);
        const image = await out.embedPng(new Uint8Array(await png.arrayBuffer()));
        outPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
        drawInvisibleTextLayer(outPage, font, items);

        const pageStats = ocrTextStats(String(result?.data?.text ?? ''));
        characters += pageStats.characters;
        words += items.length;
        unencodableWords += layerWords.filter((word) => !encodableText(word.text)).length;
        if (!items.length) {
          emptyPages += 1;
          warnings.push(`Page ${pageNumber}: no text was found.`);
        }
      } finally {
        page.cleanup();
      }
    }

    input.onProgress?.(1, 'Done');
  } catch (error) {
    if (signal?.aborted) throw error;
    creating.then(
      (created) => void created.terminate().catch(() => {}),
      () => {},
    );
    if (error instanceof ToolError) throw error;
    throw explainEngineError(error, plan.language);
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await pdf.destroy().catch(() => undefined);
    if (engine) {
      try {
        await engine.terminate();
      } catch {
        /* the worker is going away anyway */
      }
    }
  }

  const bytes = await out.save();
  const result = output(outputNameFor(file.name), bytes);
  result.stats = {
    pages: pageCount,
    words,
    characters,
    language: ocrLanguageLabel(plan.language),
    scale: plan.scale,
  };
  const notes = [
    `Read with the ${ocrLanguageLabel(plan.language)} model at ${plan.scale}× render scale. The model is cached by your browser, so the next run starts faster.`,
    'The hidden text layer uses the PDF “invisible” rendering mode, so the page still shows the original scan while the words become searchable.',
    'OCR is never perfect — check names, numbers and totals before you rely on them.',
  ];
  if (unencodableWords) {
    notes.push(
      'Words in scripts the built-in PDF font cannot encode (for example Chinese, Hindi or Cyrillic) were left out of the layer; the scan itself is unchanged.',
    );
  }
  if (emptyPages) notes.push(`${emptyPages} page(s) had no recognisable text — those pages are images only.`);
  result.notes = notes;
  if (warnings.length) result.warnings = warnings;
  return result;
}

const tool: FileToolModule = { meta, run };
export default tool;
