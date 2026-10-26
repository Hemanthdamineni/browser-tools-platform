/**
 * The PDF OCR panel.
 *
 * Two jobs live here.
 *
 * 1. **The planning maths** — the per-page plan (render scale, OCR language,
 *    layout mode and page order), the word-box → PDF-coordinate mapping and
 *    the invisible-text-layer builder. None of it touches the DOM, so the tool
 *    (`pdf-ocr.tool.ts`) and this panel call the very same helpers, and the
 *    tests exercise the exact code that writes the searchable layer.
 * 2. **The panel** — the file picker, the options and the result list, wired
 *    up by `mountPdfOcrPanel`. It hands the work to the tool through the
 *    worker client, so this file never performs the OCR itself.
 *
 * Coordinates. Tesseract reports word boxes in the rasterised page's own
 * pixels: origin at the top left, y pointing down. The output page is built at
 * the rendered page's size, so mapping a box back to PDF user space (origin
 * bottom left, y pointing up, units of 1/72 inch) is a division by the render
 * scale and a flip of the y axis.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFFont, PDFPage } from 'pdf-lib';
import { TextRenderingMode, setTextRenderingMode } from 'pdf-lib';
import type { FileRunResult, OptionValues } from '@/lib/types';
import { escapeHtml, formatBytes } from '@/lib/format';
import { clearError, showError } from '../workbench/shared';
import { ocrLanguageLabel, resolveOcrLanguage, resolveOcrMode } from '@/tools/image/ocr-languages';
import { parsePages } from '@/tools/pdf/shared';
import { looksLikePdfBytes } from '@/tools/pdf/pdf-sign.core';

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; isEvalSupported: boolean }) => {
    promise: Promise<PDFDocumentProxy>;
  };
};

/** How many bytes of a file are inspected for the `%PDF-` header. */
const HEADER_SCAN_BYTES = 1024;

/* -------------------------------------------------------------------------- */
/*  The plan — pure, testable without a DOM                                    */
/* -------------------------------------------------------------------------- */

/** Smallest render scale: one raster pixel per PDF point. */
export const MIN_OCR_SCALE = 1;
/** Largest render scale: past this the OCR gains nothing for the extra memory. */
export const MAX_OCR_SCALE = 4;
/** The default: a comfortable middle ground for scanned text. */
export const DEFAULT_OCR_SCALE = 2;

/** Clamp the render-scale value to the supported range, defaulting to 2. */
export function resolveScale(value: unknown): number {
  if (value === undefined || value === null || value === '') return DEFAULT_OCR_SCALE;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return DEFAULT_OCR_SCALE;
  return Math.min(MAX_OCR_SCALE, Math.max(MIN_OCR_SCALE, Math.round(raw)));
}

/** A word Tesseract recognised, with its box in raster pixels (origin top left). */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

/** A page's size in PDF points. The raster is this size times the render scale. */
export interface PageSize {
  width: number;
  height: number;
}

/** One hidden word, positioned in PDF user space. */
export interface InvisibleTextItem {
  /** The recognised word. */
  text: string;
  /** Left edge, in points from the page's left edge. */
  x: number;
  /** Baseline, in points from the page's bottom edge. */
  y: number;
  /** Font size, in points — the height of the word's box. */
  size: number;
  /** Always 3: the PDF “invisible” text rendering mode, so nothing is drawn. */
  renderingMode: 3;
}

/** The plan for one OCR run. */
export interface OcrPlan {
  /** 1-based page numbers, in the order they are written to the new PDF. */
  pages: number[];
  /** Raster pixels per PDF point. */
  scale: number;
  /** Tesseract language code. */
  language: string;
  /** Tesseract page-segmentation mode value (`auto`, `block`, …). */
  mode: string;
}

/**
 * The pages to process, in order and without repeats. `all` means every page,
 * in its own order; `3,1,3-4` means page 3, then 1, then 4.
 */
export function pageOrder(value: unknown, totalPages: number): number[] {
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const page of parsePages(value, totalPages)) {
    if (seen.has(page)) continue;
    seen.add(page);
    ordered.push(page);
  }
  return ordered;
}

/**
 * Turn the workbench options into the per-page plan. Every page is planned
 * with the same render scale and language, because a mixed-language document
 * still has to be read with one model at a time.
 */
export function buildOcrPlan(values: OptionValues, totalPages: number): OcrPlan {
  return {
    pages: pageOrder(values.pages, totalPages),
    scale: resolveScale(values.scale),
    language: resolveOcrLanguage(values.language),
    mode: resolveOcrMode(values.mode).value,
  };
}

/** A plain-language summary of a plan, for the panel's live region. */
export function describePlan(plan: OcrPlan, totalPages: number): string {
  const count = plan.pages.length;
  const pages =
    count === totalPages ? `all ${totalPages} pages` : `${count} of ${totalPages} pages`;
  return `${pages} · ${ocrLanguageLabel(plan.language)} · ${plan.scale}× render scale`;
}

/* -------------------------------------------------------------------------- */
/*  Word boxes → PDF coordinates — pure                                        */
/* -------------------------------------------------------------------------- */

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Map a Tesseract word box (raster pixels) into a PDF user-space rectangle.
 * `page` is the rendered page's size in points, so the box in points is the
 * box in pixels divided by the render scale; the y axis is flipped because the
 * raster counts down from the top and PDF counts up from the bottom.
 */
export function wordBoxToPdf(
  word: OcrWord,
  scale: number,
  page: PageSize,
): { x: number; y: number; width: number; height: number } {
  const factor = scale > 0 ? scale : 1;
  const left = Math.min(word.x0, word.x1) / factor;
  const right = Math.max(word.x0, word.x1) / factor;
  const top = Math.min(word.y0, word.y1) / factor;
  const bottom = Math.max(word.y0, word.y1) / factor;
  return {
    x: round(left),
    y: round(page.height - bottom),
    width: round(right - left),
    height: round(bottom - top),
  };
}

/**
 * Characters a standard PDF font (WinAnsi) can actually encode. Common
 * typographic punctuation is folded to its ASCII twin; anything else is
 * dropped, so a word the font cannot write never ends up as a broken glyph.
 */
const PUNCTUATION_MAP: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201a': ',',
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
  '\u2022': '-',
  '\u00b7': '-',
  '\u2026': '...',
  '\u00a0': ' ',
};

/** WinAnsi has these non-ASCII characters, so they can stay as they are. */
const ENCODABLE_NON_ASCII: Record<string, true> = {
  '\u00a9': true,
  '\u00ae': true,
  '\u00b0': true,
  '\u00b1': true,
  '\u00a3': true,
  '\u00a5': true,
  '\u00a7': true,
  '\u00b6': true,
};

/** Reduce a recognised word to what a standard PDF font can encode. */
export function encodableText(value: unknown): string {
  if (typeof value !== 'string') return '';
  let out = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= 0x20 && code <= 0x7e) {
      out += character;
      continue;
    }
    const mapped = PUNCTUATION_MAP[character];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (ENCODABLE_NON_ASCII[character]) out += character;
  }
  return out.trim();
}

/**
 * Reading order: top to bottom, then left to right. Two boxes count as the
 * same line when their tops differ by less than half of the shorter box, which
 * keeps a slightly wavy scan reading in a sensible order.
 */
function readingOrder(a: OcrWord, b: OcrWord): number {
  const aHeight = Math.max(1, Math.abs(a.y1 - a.y0));
  const bHeight = Math.max(1, Math.abs(b.y1 - b.y0));
  const tolerance = Math.min(aHeight, bHeight) / 2;
  if (Math.abs(a.y0 - b.y0) > tolerance) return a.y0 - b.y0;
  return a.x0 - b.x0;
}

/**
 * Build the invisible text layer for one page: every recognised word becomes a
 * hidden text object drawn where the word actually sits.
 */
export function buildTextLayer(
  words: OcrWord[],
  scale: number,
  page: PageSize,
  options: { minConfidence?: number } = {},
): InvisibleTextItem[] {
  const minConfidence = Number.isFinite(Number(options.minConfidence))
    ? Number(options.minConfidence)
    : 0;
  const items: InvisibleTextItem[] = [];
  for (const word of [...words].sort(readingOrder)) {
    if (word.confidence < minConfidence) continue;
    const text = encodableText(word.text);
    if (!text) continue;
    const box = wordBoxToPdf(word, scale, page);
    if (box.width <= 0 || box.height <= 0) continue;
    items.push({ text, x: box.x, y: box.y, size: Math.max(1, box.height), renderingMode: 3 });
  }
  return items;
}

/**
 * Draw the layer onto a pdf-lib page using the “invisible” text rendering mode,
 * so the words are selectable and searchable but paint nothing over the scan.
 * Returns how many words were written.
 */
export function drawInvisibleTextLayer(
  page: PDFPage,
  font: PDFFont,
  items: InvisibleTextItem[],
): number {
  if (!items.length) return 0;
  page.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
  let drawn = 0;
  for (const item of items) {
    try {
      page.drawText(item.text, { x: item.x, y: item.y, size: item.size, font });
      drawn += 1;
    } catch {
      // A word the font cannot encode is left out of the layer. The scan still
      // shows it, and the rest of the page stays searchable.
    }
  }
  page.pushOperators(setTextRenderingMode(TextRenderingMode.Fill));
  return drawn;
}

/* -------------------------------------------------------------------------- */
/*  Tesseract output → words — pure                                            */
/* -------------------------------------------------------------------------- */

function toOcrWord(value: unknown): OcrWord | null {
  if (!value || typeof value !== 'object') return null;
  const word = value as { text?: unknown; confidence?: unknown; bbox?: unknown };
  const box = word.bbox as { x0?: unknown; y0?: unknown; x1?: unknown; y1?: unknown } | undefined;
  if (!box) return null;
  const numbers = [box.x0, box.y0, box.x1, box.y1].map((n) => Number(n));
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const confidence = Number(word.confidence);
  return {
    text: typeof word.text === 'string' ? word.text : '',
    x0: numbers[0]!,
    y0: numbers[1]!,
    x1: numbers[2]!,
    y1: numbers[3]!,
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}

/**
 * Flatten Tesseract's nested `blocks → paragraphs → lines → words` tree into a
 * flat list of words. Anything malformed is skipped rather than thrown over.
 */
export function flattenTesseractWords(blocks: unknown): OcrWord[] {
  const words: OcrWord[] = [];
  if (!Array.isArray(blocks)) return words;
  for (const block of blocks) {
    const paragraphs = (block as { paragraphs?: unknown } | null)?.paragraphs;
    if (!Array.isArray(paragraphs)) continue;
    for (const paragraph of paragraphs) {
      const lines = (paragraph as { lines?: unknown } | null)?.lines;
      if (!Array.isArray(lines)) continue;
      for (const line of lines) {
        const lineWords = (line as { words?: unknown } | null)?.words;
        if (!Array.isArray(lineWords)) continue;
        for (const word of lineWords) {
          const parsed = toOcrWord(word);
          if (parsed) words.push(parsed);
        }
      }
    }
  }
  return words;
}

/* -------------------------------------------------------------------------- */
/*  Output name — pure                                                         */
/* -------------------------------------------------------------------------- */

/** `scan.pdf` → `scan-searchable.pdf`. */
export function outputNameFor(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base.replace(/[\\/:*?"<>|]/g, '_')}-searchable.pdf`;
}

/* -------------------------------------------------------------------------- */
/*  pdf.js                                                                     */
/* -------------------------------------------------------------------------- */

let pdfJsPromise: Promise<PdfJsModule> | null = null;

/** Load pdf.js once, pointing it at the bundled (same-origin) worker. */
function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then((module) => {
      module.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).href;
      return module;
    });
  }
  return pdfJsPromise;
}

/** Cheap check that a file really is a PDF: the `%PDF-` header. */
async function looksLikePdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, HEADER_SCAN_BYTES).arrayBuffer());
  return looksLikePdfBytes(head);
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Mount the OCR panel into a `[data-file-workbench]` element.
 *
 * The browser-only helpers are imported on demand. This module also holds the
 * pure planning maths that `pdf-ocr.tool.ts` imports, and a static import of
 * `@/lib/files` or the worker client would drag that browser-only code into a
 * tool's own chunk — the opposite of what those helpers are for.
 */
export async function mountPdfOcrPanel(root: HTMLElement): Promise<void> {
  const [{ createDropZone, downloadBlob, validateFileSelection }, { runToolById }] =
    await Promise.all([import('@/lib/files'), import('@/lib/worker/client')]);

  const dropEl = root.querySelector<HTMLElement>('[data-drop]')!;
  const listEl = root.querySelector<HTMLUListElement>('[data-file-list]')!;
  const languageEl = root.querySelector<HTMLSelectElement>('[data-language]')!;
  const scaleEl = root.querySelector<HTMLInputElement>('[data-scale]')!;
  const scaleValueEl = root.querySelector<HTMLElement>('[data-scale-value]')!;
  const modeEl = root.querySelector<HTMLSelectElement>('[data-mode]')!;
  const pagesEl = root.querySelector<HTMLInputElement>('[data-pages]')!;
  const planStatusEl = root.querySelector<HTMLElement>('[data-plan-status]')!;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]')!;
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]')!;
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]')!;
  const statsEl = root.querySelector<HTMLUListElement>('[data-stats]')!;

  const toolId = root.dataset.toolId || 'pdf-ocr';
  let file: File | null = null;
  let pdfDoc: PDFDocumentProxy | null = null;
  let totalPages = 0;
  let controller: AbortController | null = null;
  let runGeneration = 0;

  /** The options the panel hands to the tool. */
  function readOptions(): OptionValues {
    return {
      language: languageEl.value,
      scale: Number(scaleEl.value),
      mode: modeEl.value,
      pages: pagesEl.value.trim() || 'all',
    };
  }

  function updateScaleLabel(): void {
    scaleValueEl.textContent = `${resolveScale(scaleEl.value)}×`;
  }

  /** Show the plan, or the reason it cannot be built yet. */
  function updatePlan(): void {
    if (!file) {
      planStatusEl.textContent = 'Choose a PDF to plan its pages.';
      runBtn.disabled = true;
      return;
    }
    runBtn.disabled = !totalPages;
    if (!totalPages) return;
    try {
      const plan = buildOcrPlan(readOptions(), totalPages);
      planStatusEl.textContent = `Ready: ${describePlan(plan, totalPages)}.`;
      clearError(errorBox);
    } catch (error) {
      const err = error as Error & { hint?: string };
      planStatusEl.textContent = 'Fix the page range to continue.';
      showError(errorBox, err.message || 'Those options cannot be used.', err.hint);
    }
  }

  function renderList(): void {
    listEl.innerHTML = file
      ? `<li class="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
          <span class="truncate">${escapeHtml(file.name)}</span>
          <span class="flex items-center gap-2 shrink-0 text-xs text-[rgb(var(--text-muted))]">
            ${formatBytes(file.size)}${totalPages ? ` · ${totalPages} pages` : ''}
            <button type="button" data-remove aria-label="Remove ${escapeHtml(file.name)}" class="hover:text-[rgb(var(--danger))]">✕</button>
          </span>
        </li>`
      : '';
    resetBtn.hidden = !file;
  }

  async function setFile(next: File | null): Promise<void> {
    file = next;
    totalPages = 0;
    if (pdfDoc) {
      await pdfDoc.destroy().catch(() => undefined);
      pdfDoc = null;
    }
    clearError(errorBox);
    resultWrap.hidden = true;
    renderList();
    updatePlan();
    if (!file) return;
    if (!(await looksLikePdf(file))) {
      showError(errorBox, 'That file is not a PDF.', 'Choose a PDF document to make searchable.');
      file = null;
      renderList();
      updatePlan();
      return;
    }
    try {
      const pdfjs = await loadPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      const loaded = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
      pdfDoc = loaded;
      totalPages = loaded.numPages;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      showError(
        errorBox,
        /password/i.test(message)
          ? 'This PDF is password-protected — unlock it first.'
          : 'That PDF could not be read.',
        'The document may be damaged or encrypted.',
      );
      file = null;
    }
    renderList();
    updatePlan();
  }

  const dropZone = createDropZone(dropEl, {
    accept: 'application/pdf',
    multiple: false,
    onFiles: (files) => {
      const next = files[0] ?? null;
      if (next) {
        const limit = validateFileSelection([next]);
        if (limit) {
          showError(errorBox, limit);
          return;
        }
      }
      void setFile(next);
    },
  });

  listEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button) return;
    void setFile(null);
  });

  scaleEl.addEventListener('input', () => {
    updateScaleLabel();
    updatePlan();
  });
  for (const control of [languageEl, modeEl]) {
    control.addEventListener('change', updatePlan);
  }
  pagesEl.addEventListener('input', updatePlan);

  async function run(): Promise<void> {
    if (!file || !totalPages) return;
    try {
      buildOcrPlan(readOptions(), totalPages);
    } catch (error) {
      const err = error as Error & { hint?: string };
      showError(errorBox, err.message || 'Those options cannot be used.', err.hint);
      return;
    }
    controller?.abort();
    const generation = ++runGeneration;
    controller = new AbortController();
    clearError(errorBox);
    runBtn.disabled = true;
    cancelBtn.hidden = false;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    progressMsg.textContent = 'Working…';
    resultWrap.hidden = true;

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        { files: [file], options: readOptions() },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => {
            if (generation !== runGeneration) return;
            const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
            progressBar.style.width = `${pct}%`;
            progressMsg.textContent = message ? `${message} — ${pct}%` : `${pct}%`;
          },
        },
      );
      if (generation !== runGeneration) return;
      progressBar.style.width = '100%';
      progressMsg.textContent = 'Done';
      renderResult(result);
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name !== 'AbortError')
        showError(errorBox, err.message || 'Making the PDF failed', err.hint);
      else progressMsg.textContent = 'Cancelled';
    } finally {
      if (generation === runGeneration) {
        runBtn.disabled = !totalPages;
        cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

  function renderResult(result: FileRunResult): void {
    resultWrap.hidden = false;
    outputsEl.innerHTML = '';
    for (const output of result.outputs) {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2';
      const name = document.createElement('span');
      name.className = 'truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'btn btn-subtle btn-sm shrink-0';
      download.textContent = 'Save';
      download.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      li.append(name, download);
      outputsEl.append(li);
    }
    notesEl.innerHTML = '';
    for (const warning of result.warnings ?? []) {
      const li = document.createElement('li');
      li.style.color = 'rgb(var(--warning))';
      li.textContent = `⚠ ${warning}`;
      notesEl.append(li);
    }
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesEl.append(li);
    }
    statsEl.innerHTML = '';
    for (const [key, value] of Object.entries(result.stats ?? {})) {
      const li = document.createElement('li');
      li.className = 'text-[rgb(var(--text-muted))]';
      li.textContent = `${key}: ${value}`;
      statsEl.append(li);
    }
  }

  runBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => controller?.abort());
  resetBtn.addEventListener('click', () => {
    runGeneration += 1;
    controller?.abort();
    controller = null;
    void setFile(null);
    progressWrap.hidden = true;
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    statsEl.innerHTML = '';
    resultWrap.hidden = true;
    clearError(errorBox);
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      dropZone.destroy();
      void pdfDoc?.destroy().catch(() => undefined);
    },
    { once: true },
  );

  updateScaleLabel();
  updatePlan();
}
