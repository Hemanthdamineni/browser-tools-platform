import type { FileRunInput, FileRunResult, FileToolModule, ToolOption } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { capabilities } from '@/lib/capabilities';
import { checkAbort, stem } from './common';
import { meta } from './image-ocr.meta';

/** Above this many pixels the browser is likely to run out of memory. */
export const MAX_OCR_PIXELS = 25_000_000;

/* -------------------------------------------------------------------------- */
/*  Languages — the option in `meta` is the single source of truth            */
/* -------------------------------------------------------------------------- */

const languageOption = meta.options?.find(
  (option): option is Extract<ToolOption, { type: 'select' }> =>
    option.key === 'language' && option.type === 'select',
);

/** Language codes this build ships traineddata for. */
export const SUPPORTED_LANGUAGES: readonly string[] =
  languageOption?.choices.map((choice) => choice.value) ?? ['eng'];

const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  (languageOption?.choices ?? []).map((choice) => [choice.value, choice.label]),
);

/** Validate the chosen language before anything is downloaded. */
export function resolveLanguage(value: unknown): string {
  const language = String(value ?? '');
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new ToolError(
      `The language "${language}" is not available.`,
      `Choose one of: ${SUPPORTED_LANGUAGES.join(', ')}.`,
    );
  }
  return language;
}

/* -------------------------------------------------------------------------- */
/*  Pure post-processing                                                      */
/* -------------------------------------------------------------------------- */

/** Normalise line endings, strip trailing spaces, and cap runs of blank lines. */
export function cleanOcrText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** `scan.png` → `scan.txt`. */
export function ocrOutputName(filename: string): string {
  return `${stem(filename)}.txt`;
}

/** tesseract reports a 0–100 mean confidence; `undefined`/NaN become `null`. */
export function formatConfidence(confidence: number | undefined): string | null {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null;
  return `${Math.round(confidence)}%`;
}

interface ProgressPhase {
  /** Substring of tesseract's status label. */
  match: string;
  /** Fraction at progress 0 and 1 for this phase. */
  start: number;
  end: number;
  message: string;
}

// tesseract's own progress only covers one phase at a time, so each phase is
// mapped onto its own slice of the overall bar.
const PROGRESS_PHASES: readonly ProgressPhase[] = [
  { match: 'loading tesseract core', start: 0.05, end: 0.2, message: 'Loading OCR engine…' },
  { match: 'initializing tesseract', start: 0.2, end: 0.25, message: 'Starting OCR engine…' },
  {
    match: 'loading language traineddata',
    start: 0.25,
    end: 0.55,
    message: 'Downloading OCR model…',
  },
  { match: 'initializing api', start: 0.55, end: 0.65, message: 'Preparing OCR engine…' },
  { match: 'recognizing text', start: 0.65, end: 1, message: 'Reading text…' },
];

/** Map a tesseract status+progress onto the tool's overall progress. */
export function progressForStatus(
  status: string,
  progress: number,
): { fraction: number; message: string } | null {
  const phase = PROGRESS_PHASES.find((candidate) => status.includes(candidate.match));
  if (!phase) return null;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const message = status.includes('from cache') ? 'Loading saved OCR model…' : phase.message;
  return { fraction: phase.start + (phase.end - phase.start) * clamped, message };
}

/** Reject images that would exhaust memory before the model is downloaded. */
export function assertOcrImageSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ToolError('That image has no readable pixel size.');
  }
  if (width * height > MAX_OCR_PIXELS) {
    const megapixels = Math.round((MAX_OCR_PIXELS / 1_000_000) * 10) / 10;
    throw new ToolError(
      `That image is too large to read (${width} × ${height} pixels).`,
      `Crop or resize it to less than ${megapixels} megapixels, then try again.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Engine contract (injected so tests can supply a fake)                     */
/* -------------------------------------------------------------------------- */

export interface OcrEngineResult {
  text: string;
  confidence?: number;
}

export interface OcrEngine {
  recognize(file: File): Promise<OcrEngineResult>;
  terminate(): Promise<void> | void;
}

export interface OcrImageInfo {
  width: number;
  height: number;
}

export type OcrProgressFn = (fraction: number, message: string) => void;

export interface OcrDeps {
  /** Prepare an engine for `language`, reporting download/setup progress. */
  loadEngine(language: string, onProgress: OcrProgressFn): Promise<OcrEngine>;
  /** Pixel size of an image; overridable so tests avoid a real canvas. */
  measure?(file: File): Promise<OcrImageInfo>;
}

/** Settle like `promise`, but reject as soon as `signal` aborts. */
export function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('The operation was cancelled.', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('The operation was cancelled.', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function resolveRequest(input: FileRunInput): { file: File; language: string } {
  if (!input.files?.length) {
    throw new ToolError('Choose an image file.', 'Drop in a PNG, JPEG, WebP, GIF or BMP file.');
  }
  if (input.files.length !== 1) {
    throw new ToolError('Choose exactly one image file.', 'OCR reads a single image at a time.');
  }
  const file = input.files[0]!;
  if (!file.type.startsWith('image/')) {
    throw new ToolError('The selected file is not an image.', 'Read text from a PNG, JPEG, WebP, GIF or BMP file.');
  }
  const options = resolveOptions(meta, input.options);
  const language = resolveLanguage(options.language);
  checkAbort(input.signal);
  return { file, language };
}

async function measureImage(file: File): Promise<OcrImageInfo> {
  if (!capabilities.createImageBitmap) {
    throw new ToolError(
      'This browser cannot read image pixels for OCR.',
      'Try a recent version of Chrome, Edge, Firefox or Safari.',
    );
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ToolError(
      'That file could not be read as an image.',
      'Check that it is a valid PNG, JPEG, WebP, GIF or BMP file.',
    );
  }
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

function buildResult(
  file: File,
  language: string,
  size: OcrImageInfo,
  text: string,
  confidence: number | undefined,
): FileRunResult {
  const stats: Record<string, string | number> = {
    language: LANGUAGE_LABELS[language] ?? language,
    pixels: `${size.width} × ${size.height}`,
    characters: text.length,
  };
  const confidenceLabel = formatConfidence(confidence);
  if (confidenceLabel) stats.confidence = confidenceLabel;

  if (!text) {
    return {
      outputs: [],
      warnings: ['No text was detected in this image.'],
      stats,
    };
  }

  return {
    outputs: [{ filename: ocrOutputName(file.name), blob: new Blob([text], { type: 'text/plain' }) }],
    report: { output: text, render: 'text' },
    stats,
  };
}

/**
 * Full OCR pipeline with the engine injected. `run()` supplies the real
 * tesseract.js engine; tests supply a fake one.
 */
export async function runOcr(input: FileRunInput, deps: OcrDeps): Promise<FileRunResult> {
  const { file, language } = resolveRequest(input);
  const progress: OcrProgressFn = (fraction, message) => input.onProgress?.(fraction, message);

  const size = await (deps.measure ?? measureImage)(file);
  assertOcrImageSize(size.width, size.height);
  checkAbort(input.signal);

  const engine = await deps.loadEngine(language, progress);
  try {
    progress(0.65, 'Reading text…');
    const result = await raceAbort(engine.recognize(file), input.signal);
    const text = cleanOcrText(result.text ?? '');
    progress(1, 'Done');
    return buildResult(file, language, size, text, result.confidence);
  } finally {
    // Release the OCR worker on success and on abort alike.
    await engine.terminate();
  }
}

/* -------------------------------------------------------------------------- */
/*  The real engine: self-hosted tesseract.js                                 */
/* -------------------------------------------------------------------------- */

/** Same-origin paths produced by `scripts/gen-ocr-assets.mjs` (`npm run build`). */
const OCR_ASSET_BASE = '/ocr';

async function loadTesseractEngine(language: string, onProgress: OcrProgressFn): Promise<OcrEngine> {
  onProgress(0.02, 'Loading OCR engine…');
  const { createWorker, OEM } = await import('tesseract.js');
  onProgress(0.05, 'Downloading OCR model…');

  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker(language, OEM.LSTM_ONLY, {
      workerPath: `${OCR_ASSET_BASE}/worker.min.js`,
      corePath: `${OCR_ASSET_BASE}/`,
      langPath: `${OCR_ASSET_BASE}/tessdata`,
      // Never fetch from a CDN; the worker and its core load from this origin.
      workerBlobURL: false,
      gzip: true,
      logger: (message: { status: string; progress: number }) => {
        const mapped = progressForStatus(message.status, message.progress);
        if (mapped) onProgress(mapped.fraction, mapped.message);
      },
    });
  } catch (error) {
    throw new ToolError(
      'The OCR engine could not be loaded.',
      `${error instanceof Error ? error.message : String(error)} — its files are served from this site, so check your connection and try again.`,
    );
  }

  return {
    recognize: async (file) => {
      let data: Awaited<ReturnType<typeof worker.recognize>>['data'];
      try {
        ({ data } = await worker.recognize(file));
      } catch {
        throw new ToolError(
          'The text could not be read from this image.',
          'Try a sharper image with dark text on a light background.',
        );
      }
      return {
        text: data.text ?? '',
        confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
      };
    },
    terminate: () => worker.terminate(),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runOcr(input, { loadEngine: loadTesseractEngine });
}

const tool: FileToolModule = { meta, run };
export default tool;
