/**
 * The PDF redaction panel.
 *
 * Owns the page preview: the user picks a PDF, clicks a page, draws black
 * rectangles over the content that must be destroyed, then runs the tool. The
 * resulting redaction plan — which page and which rectangles — is handed to the
 * generic Web Worker (`pdf-redact.tool.ts`), which rasterises the covered pages
 * and burns the boxes in, so a large document never freezes the tab.
 *
 * The pure model at the top of this module (regions, page geometry and the
 * build plan) is DOM-free and unit-tested directly; the panel mount below is
 * the only part that touches the document. Nothing here ever leaves the tab.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  applyShowWhen,
  bindRangeOutputs,
  clearError,
  readOptions,
  showError,
} from '../workbench/shared';
import { looksLikePdfBytes } from '@/tools/pdf/pdf-sign.core';

/* -------------------------------------------------------------------------- */
/*  Pure model — regions, geometry and the build plan                         */
/* -------------------------------------------------------------------------- */

/** A redaction rectangle in percent (0–100) of the displayed page. */
export interface PageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One planned page: a 1-based page number and the rectangles to burn on it. */
export interface PagePlanEntry {
  page: number;
  regions: PageRegion[];
}

/** A rectangle in whole pixels, relative to a rendered page's top-left corner. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Smallest rectangle the panel creates or keeps, in percent of each axis. */
export const MIN_REGION_PERCENT = 1;

/** Where the build plan splits the document. */
export interface RedactionPlan {
  /** Pages that carry at least one rectangle — these are rasterised. */
  rasterise: number[];
  /** Pages with no rectangles — these keep their original text layer. */
  keep: number[];
  /** The entries in the order the panel drew them, one per redacted page. */
  entries: PagePlanEntry[];
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/** Round to two decimals so percentages survive a JSON round-trip unchanged. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clamp a rectangle into `0..100`, keeping at least `min` on each side. */
export function clampRegion(region: PageRegion, min = MIN_REGION_PERCENT): PageRegion {
  const w = clamp(Number.isFinite(region.w) ? round2(region.w) : min, min, 100);
  const h = clamp(Number.isFinite(region.h) ? round2(region.h) : min, min, 100);
  const x = clamp(Number.isFinite(region.x) ? round2(region.x) : 0, 0, 100 - w);
  const y = clamp(Number.isFinite(region.y) ? round2(region.y) : 0, 0, 100 - h);
  return { x, y, w, h };
}

/** Move a rectangle by a percent delta, keeping it inside the page. */
export function moveRegion(region: PageRegion, dx: number, dy: number): PageRegion {
  const base = clampRegion(region);
  return clampRegion({ ...base, x: base.x + dx, y: base.y + dy });
}

/**
 * Grow or shrink a rectangle from its bottom-right corner. The top-left corner
 * stays put, so the size can only grow as far as the page edge.
 */
export function resizeRegion(region: PageRegion, dw: number, dh: number): PageRegion {
  const base = clampRegion(region);
  return {
    ...base,
    w: clamp(base.w + dw, MIN_REGION_PERCENT, 100 - base.x),
    h: clamp(base.h + dh, MIN_REGION_PERCENT, 100 - base.y),
  };
}

/** Index of the topmost rectangle containing a percent point, or -1. */
export function regionAt(regions: PageRegion[], x: number, y: number): number {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i]!;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

/** Append a rectangle (it becomes the topmost one). */
export function addRegion(regions: PageRegion[], region: PageRegion): PageRegion[] {
  return [...regions, clampRegion(region)];
}

/** Remove the rectangle at `index`; out-of-range indexes leave the list alone. */
export function removeRegionAt(regions: PageRegion[], index: number): PageRegion[] {
  if (index < 0 || index >= regions.length) return regions;
  return regions.filter((_, i) => i !== index);
}

/** Patch one rectangle, re-clamping the result. */
export function updateRegionAt(
  regions: PageRegion[],
  index: number,
  patch: Partial<PageRegion>,
): PageRegion[] {
  return regions.map((region, i) => (i === index ? clampRegion({ ...region, ...patch }) : region));
}

/** A sensible starting rectangle: 40% wide, 20% tall, centred. */
export function defaultRegion(): PageRegion {
  return { x: 30, y: 40, w: 40, h: 20 };
}

/* --- page geometry: PDF points → rendered pixels ------------------------- */

/**
 * The size a page takes when printed to a bitmap. `width`/`height` are the
 * page's own media box in PDF points (1 pt = 1/72 in); a quarter turn swaps
 * them, exactly as the renderer does; `scale` is rendered pixels per point, so
 * 72 dpi is scale 1 and 144 dpi is scale 2.
 */
export function displaySize(
  widthPt: number,
  heightPt: number,
  rotation: number,
  scale: number,
): { width: number; height: number } {
  const turn = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  const swapped = turn === 90 || turn === 270;
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return swapped
    ? { width: heightPt * s, height: widthPt * s }
    : { width: widthPt * s, height: heightPt * s };
}

/** Convert a length in PDF points to whole rendered pixels at `scale`. */
export function pointsToPixels(points: number, scale: number): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return Math.round(points * s);
}

/**
 * Map a percent rectangle onto a rendered page of `widthPx × heightPx` pixels,
 * rounding to whole pixels and clipping to the page. Returns `null` when the
 * rectangle cannot cover a single pixel — a zero-size or off-page region, which
 * must never be burned as an invisible no-op.
 */
export function regionToPixels(
  region: PageRegion,
  widthPx: number,
  heightPx: number,
): PixelRect | null {
  if (
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.w) ||
    !Number.isFinite(region.h) ||
    region.w <= 0 ||
    region.h <= 0 ||
    !(widthPx >= 1) ||
    !(heightPx >= 1)
  ) {
    return null;
  }
  const x0 = clamp(Math.round((region.x / 100) * widthPx), 0, widthPx);
  const y0 = clamp(Math.round((region.y / 100) * heightPx), 0, heightPx);
  const x1 = clamp(Math.round(((region.x + region.w) / 100) * widthPx), 0, widthPx);
  const y1 = clamp(Math.round(((region.y + region.h) / 100) * heightPx), 0, heightPx);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* --- parsing and the build plan ------------------------------------------ */

/** Read one region out of untrusted JSON, keeping only finite numbers. */
function regionFromJson(item: unknown, where: string): PageRegion {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new ToolError(
      `${where} is not a rectangle.`,
      'Each region needs x, y, w and h numbers in percent.',
    );
  }
  const raw = item as Record<string, unknown>;
  const region: PageRegion = {
    x: Number(raw.x),
    y: Number(raw.y),
    w: Number(raw.w),
    h: Number(raw.h),
  };
  if (
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.w) ||
    !Number.isFinite(region.h)
  ) {
    throw new ToolError(
      `${where} has a coordinate that is not a number.`,
      'Each region needs x, y, w and h numbers in percent.',
    );
  }
  return region;
}

/**
 * Parse a JSON array of `{ x, y, w, h }` rectangles in percent. An empty or
 * absent value means "no regions"; malformed JSON or a non-array is a
 * user-facing error naming the field.
 */
export function parseRegions(value: unknown, field = 'The region list'): PageRegion[] {
  if (value === undefined || value === null) return [];
  let data: unknown = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') return [];
    try {
      data = JSON.parse(text);
    } catch {
      throw new ToolError(
        `${field} is not valid JSON.`,
        'It must be an array like [{"x":10,"y":10,"w":20,"h":20}].',
      );
    }
  }
  if (!Array.isArray(data)) {
    throw new ToolError(`${field} must be a JSON array of rectangles.`);
  }
  return data.map((item, i) => regionFromJson(item, `Region ${i + 1}`));
}

/**
 * Parse a whole redaction plan: a JSON array of `{ page, regions }` entries.
 * This only checks the shape — page numbers are validated against the document
 * later, in {@link planPages}.
 */
export function parsePlanEntries(value: unknown): PagePlanEntry[] {
  if (value === undefined || value === null) return [];
  let data: unknown = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') return [];
    try {
      data = JSON.parse(text);
    } catch {
      throw new ToolError(
        'The redaction plan is not valid JSON.',
        'It must be an array like [{"page":1,"regions":[...]}].',
      );
    }
  }
  if (!Array.isArray(data)) {
    throw new ToolError('The redaction plan must be a JSON array of pages.');
  }
  return data.map((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ToolError(`Entry ${i + 1} of the redaction plan is not a page.`);
    }
    const raw = item as Record<string, unknown>;
    return {
      page: Number(raw.page),
      regions: parseRegions(raw.regions, `Page ${String(raw.page)} regions`),
    };
  });
}

/**
 * Split the document into the pages that must be rasterised and the pages that
 * can be copied through untouched.
 *
 * A page rasterises when it carries at least one rectangle; an entry with no
 * usable rectangles is ignored, so a stray empty entry can never flatten a page
 * to no purpose. Every page number is checked against the document — an entry
 * pointing outside it is a user-facing error rather than a silent no-op.
 */
export function planPages(entries: PagePlanEntry[], totalPages: number): RedactionPlan {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new ToolError('This PDF has no pages to redact.');
  }
  const byPage = new Map<number, PageRegion[]>();

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new ToolError(`Entry ${index + 1} of the redaction plan is not a page.`);
    }
    const page = Math.trunc(Number(entry.page));
    if (!Number.isInteger(page) || page < 1) {
      throw new ToolError(
        `Entry ${index + 1} of the redaction plan has no page number.`,
        'Each entry needs a whole "page" number.',
      );
    }
    if (page > totalPages) {
      throw new ToolError(
        `The redaction plan points at page ${page}, but this PDF has ${totalPages} pages.`,
        'Redraw the rectangles on the page you want to cover.',
      );
    }
    if (!Array.isArray(entry.regions)) {
      throw new ToolError(`Page ${page} of the redaction plan has no region list.`);
    }
    const regions = entry.regions.map((region, i) =>
      clampRegion(regionFromJson(region, `Page ${page}, region ${i + 1}`)),
    );
    if (!regions.length) return;
    // Two entries for the same page are merged so a page is never rendered twice.
    byPage.set(page, [...(byPage.get(page) ?? []), ...regions]);
  });

  const entriesOut: PagePlanEntry[] = [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, regions]) => ({ page, regions }));
  const rasterise = entriesOut.map((entry) => entry.page);
  const keep: number[] = [];
  for (let page = 1; page <= totalPages; page++) if (!byPage.has(page)) keep.push(page);
  return { rasterise, keep, entries: entriesOut };
}

/** Serialise the plan back to the JSON the tool understands. */
export function planToJson(entries: PagePlanEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => ({
      page: entry.page,
      regions: entry.regions.map((region) => clampRegion(region)),
    })),
  );
}

/** The output file name derived from the source name. */
export function outputNameFor(name: string): string {
  const base = name.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}-redacted.pdf`;
}

/* -------------------------------------------------------------------------- */
/*  pdf.js                                                                     */
/* -------------------------------------------------------------------------- */

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; isEvalSupported: boolean }) => {
    promise: Promise<PDFDocumentProxy>;
  };
};

/** How many bytes of a file are inspected for the `%PDF-` header. */
const HEADER_SCAN_BYTES = 1024;

let pdfJsPromise: Promise<PdfJsModule> | null = null;

/** Load pdf.js once, pointing it at the bundled (same-origin) worker. */
function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).href;
      return mod;
    });
  }
  return pdfJsPromise;
}

/** Cheap check that a file really is a PDF: the `%PDF-` header. */
async function looksLikePdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, HEADER_SCAN_BYTES).arrayBuffer());
  return looksLikePdfBytes(head);
}

export { loadPdfJs };
/** Largest page-preview edge, in CSS pixels. */
const PREVIEW_MAX_W = 520;
const PREVIEW_MAX_H = 680;

/* -------------------------------------------------------------------------- */
/*  Panel                                                                       */
/* -------------------------------------------------------------------------- */

interface Point {
  x: number;
  y: number;
}

type DragMode = 'draw' | 'move' | 'resize';

interface Drag {
  mode: DragMode;
  index: number;
  start: Point;
  origin: PageRegion | null;
}

/** Look up a required element, so a markup change fails loudly. */
function need<T extends Element>(parent: ParentNode, selector: string): T {
  const el = parent.querySelector<T>(selector);
  if (!el) throw new Error(`The redaction panel is missing ${selector}.`);
  return el;
}

function clampPercent(value: number): number {
  return value < 0 ? 0 : value > 100 ? 100 : value;
}

/** Build a rectangle from two drag points, clamped into the page. */
function rectFromPoints(a: Point, b: Point): PageRegion {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return clampRegion({ x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
}

interface Refs {
  errorBox: HTMLElement;
  dropEl: HTMLElement;
  listEl: HTMLUListElement;
  runBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  progressWrap: HTMLElement;
  progressBar: HTMLElement;
  progressMsg: HTMLElement;
  resultWrap: HTMLElement;
  outputsEl: HTMLUListElement;
  notesEl: HTMLUListElement;
  stageWrap: HTMLElement;
  stage: HTMLElement;
  preview: HTMLCanvasElement;
  overlay: HTMLElement;
  marquee: HTMLElement;
  regionList: HTMLUListElement;
  pageTabs: HTMLElement;
  pageStatus: HTMLElement;
  addBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  optionsRoot: HTMLElement;
  planField: HTMLTextAreaElement;
}

/** Mount the panel into its `[data-pdf-redact-panel]` root. */
export function mountPdfRedactPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'pdf-redact';
  const accept = root.dataset.accept || undefined;

  const collect = (): Refs | null => {
    try {
      return {
        errorBox: need(root, '[data-error]'),
        dropEl: need(root, '[data-drop]'),
        listEl: need(root, '[data-file-list]'),
        runBtn: need(root, '[data-run]'),
        cancelBtn: need(root, '[data-cancel]'),
        resetBtn: need(root, '[data-reset]'),
        progressWrap: need(root, '[data-progress-wrap]'),
        progressBar: need(root, '[data-progress-bar]'),
        progressMsg: need(root, '[data-progress-msg]'),
        resultWrap: need(root, '[data-result-wrap]'),
        outputsEl: need(root, '[data-outputs]'),
        notesEl: need(root, '[data-notes]'),
        stageWrap: need(root, '[data-stage-wrap]'),
        stage: need(root, '[data-stage]'),
        preview: need(root, '[data-preview]'),
        overlay: need(root, '[data-overlay]'),
        marquee: need(root, '[data-marquee]'),
        regionList: need(root, '[data-region-list]'),
        pageTabs: need(root, '[data-page-tabs]'),
        pageStatus: need(root, '[data-page-status]'),
        addBtn: need(root, '[data-add-region]'),
        clearBtn: need(root, '[data-clear-regions]'),
        optionsRoot: need(root, '[data-options]'),
        planField: need(root, '[data-opt-key="plan"]'),
      };
    } catch (error) {
      const box = root.querySelector<HTMLElement>('[data-error]');
      if (box) {
        box.hidden = false;
        box.textContent = error instanceof Error ? error.message : 'The panel is unavailable.';
      }
      return null;
    }
  };

  const refs = collect();
  if (!refs) return;
  const {
    errorBox,
    dropEl,
    listEl,
    runBtn,
    cancelBtn,
    resetBtn,
    progressWrap,
    progressBar,
    progressMsg,
    resultWrap,
    outputsEl,
    notesEl,
    stageWrap,
    stage,
    preview,
    overlay,
    marquee,
    regionList,
    pageTabs,
    pageStatus,
    addBtn,
    clearBtn,
    optionsRoot,
    planField,
  } = refs;

  let file: File | null = null;
  let pdfDoc: PDFDocumentProxy | null = null;
  let fileUsable = false;
  let pageCount = 0;
  let currentPage = 1;
  /** The rectangles drawn on the current page, in percent. */
  let regions: PageRegion[] = [];
  /** Every page's rectangles, keyed by 1-based page number. */
  const regionsByPage = new Map<number, PageRegion[]>();
  let selected = -1;
  let drag: Drag | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;
  const outputUrls = new Set<string>();

  /* ---------------------------------------------------------------------- */
  /*  Small view helpers                                                     */
  /* ---------------------------------------------------------------------- */

  function setPageStatus(message: string): void {
    pageStatus.textContent = message;
  }

  function updateRunState(): void {
    runBtn.disabled = !fileUsable;
    resetBtn.hidden = !file;
  }

  function syncPlanField(): void {
    regionsByPage.set(currentPage, regions);
    const entries: PagePlanEntry[] = [];
    for (const [page, rects] of regionsByPage) {
      if (rects.length) entries.push({ page, regions: rects });
    }
    planField.value = planToJson(entries);
    planField.removeAttribute('aria-invalid');
  }

  function renderFileList(): void {
    listEl.innerHTML = file
      ? `<li class="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
          <span class="truncate">${escapeHtml(file.name)}</span>
          <span class="flex items-center gap-2 shrink-0 text-xs text-[rgb(var(--text-muted))]">
            ${formatBytes(file.size)}
            <button type="button" data-remove aria-label="Remove ${escapeHtml(file.name)}" class="hover:text-[rgb(var(--danger))]">✕</button>
          </span>
        </li>`
      : '';
  }

  /* ---------------------------------------------------------------------- */
  /*  Page tabs                                                              */
  /* ---------------------------------------------------------------------- */

  function renderPageTabs(): void {
    pageTabs.innerHTML = '';
    for (let page = 1; page <= pageCount; page++) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `btn btn-sm ${
        page === currentPage ? 'btn-primary' : 'btn-subtle'
      } tabular-nums`;
      tab.dataset.pageTab = String(page);
      tab.setAttribute('aria-label', `Redact page ${page}`);
      tab.setAttribute('aria-pressed', String(page === currentPage));
      tab.textContent = String(page);
      pageTabs.appendChild(tab);
    }
  }
  /* ---------------------------------------------------------------------- */
  /*  Region view                                                            */
  /* ---------------------------------------------------------------------- */

  function regionAria(index: number): string {
    const r = regions[index]!;
    return `Region ${index + 1}, x ${r.x}%, y ${r.y}%, ${r.w}% wide, ${r.h}% tall. Arrow keys move it, plus and minus resize it, Delete removes it.`;
  }

  function renderOverlay(): void {
    overlay.querySelectorAll('[data-region]').forEach((el) => el.remove());
    regions.forEach((region, index) => {
      const box = document.createElement('div');
      box.className = `absolute cursor-move border-2 border-solid border-black bg-black/70${
        index === selected ? ' outline outline-2 outline-offset-2 outline-[rgb(var(--accent))]' : ''
      }`;
      box.style.left = `${region.x}%`;
      box.style.top = `${region.y}%`;
      box.style.width = `${region.w}%`;
      box.style.height = `${region.h}%`;
      box.dataset.region = String(index);
      box.tabIndex = 0;
      box.setAttribute('role', 'button');
      box.setAttribute('aria-pressed', String(index === selected));
      box.setAttribute('aria-label', regionAria(index));

      const badge = document.createElement('span');
      badge.className =
        'pointer-events-none absolute left-0 top-0 rounded-br bg-black px-1 text-[10px] font-semibold leading-4 text-white';
      badge.textContent = String(index + 1);
      box.appendChild(badge);

      const handle = document.createElement('span');
      handle.className =
        'absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-[rgb(var(--accent))]';
      handle.setAttribute('aria-hidden', 'true');
      handle.dataset.handle = '';
      box.appendChild(handle);

      overlay.appendChild(box);
    });
  }

  function renderRegionList(): void {
    regionList.innerHTML = '';
    regions.forEach((region, index) => {
      const item = document.createElement('li');
      item.className = `rounded-lg border px-3 py-2${
        index === selected ? ' outline outline-1 outline-[rgb(var(--accent))]' : ''
      }`;
      item.dataset.regionItem = String(index);

      const head = document.createElement('div');
      head.className = 'flex flex-wrap items-center gap-2';
      const label = document.createElement('span');
      label.className = 'font-medium tabular-nums';
      label.textContent = `Region ${index + 1}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-subtle btn-sm ml-auto';
      remove.setAttribute('data-region-remove', '');
      remove.setAttribute('aria-label', `Remove region ${index + 1}`);
      remove.textContent = "Delete";
      head.append(label, remove);

      const fields = document.createElement('div');
      fields.className = 'mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4';
      for (const key of ['x', 'y', 'w', 'h'] as const) {
        const span = document.createElement('span');
        span.className = 'flex items-center gap-1.5';
        const fieldLabel = document.createElement('label');
        fieldLabel.className = 'text-xs text-[rgb(var(--text-muted))]';
        fieldLabel.htmlFor = `redact-${currentPage}-region-${index}-${key}`;
        fieldLabel.textContent =
          key === 'w' ? 'Width' : key === 'h' ? 'Height' : key === 'x' ? 'X' : 'Y';
        const input = document.createElement('input');
        input.id = fieldLabel.htmlFor;
        input.className = 'field';
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.step = '1';
        input.inputMode = 'numeric';
        input.value = String(region[key]);
        input.dataset.regionField = key;
        span.append(fieldLabel, input);
        fields.appendChild(span);
      }

      item.append(head, fields);
      regionList.appendChild(item);
    });
  }

  function commit(): void {
    syncPlanField();
    renderOverlay();
    renderRegionList();
  }

  function focusRegion(index: number): void {
    const box = overlay.querySelector<HTMLElement>(`[data-region="${index}"]`);
    box?.focus();
  }

  function selectRegion(index: number): void {
    selected = index;
    commit();
  }

  function setRegion(index: number, next: PageRegion, keepFocus = true): void {
    regions = updateRegionAt(regions, index, next);
    commit();
    if (keepFocus) focusRegion(index);
  }

  function removeRegion(index: number): void {
    regions = removeRegionAt(regions, index);
    selected = regions.length ? Math.min(index, regions.length - 1) : -1;
    commit();
    if (selected >= 0) focusRegion(selected);
    else addBtn.focus();
    if (!regions.length) setPageStatus('No rectangles on this page — drag on the preview to add one.');
  }

  /* ---------------------------------------------------------------------- */
  /*  Pointer interaction                                                    */
  /* ---------------------------------------------------------------------- */

  function pointFromEvent(event: PointerEvent): Point {
    const box = stage.getBoundingClientRect();
    return {
      x: box.width ? clampPercent(((event.clientX - box.left) / box.width) * 100) : 0,
      y: box.height ? clampPercent(((event.clientY - box.top) / box.height) * 100) : 0,
    };
  }

  function showMarquee(rect: PageRegion): void {
    marquee.hidden = false;
    marquee.style.left = `${rect.x}%`;
    marquee.style.top = `${rect.y}%`;
    marquee.style.width = `${rect.w}%`;
    marquee.style.height = `${rect.h}%`;
  }

  overlay.addEventListener('pointerdown', (event) => {
    if (!fileUsable || event.button !== 0) return;
    const target = event.target as HTMLElement;
    const box = target.closest<HTMLElement>('[data-region]');
    const handle = target.closest<HTMLElement>('[data-handle]');
    const point = pointFromEvent(event);
    if (box) {
      const index = Number(box.dataset.region);
      const origin = regions[index];
      if (!origin) return;
      selected = index;
      drag = {
        mode: handle ? 'resize' : 'move',
        index,
        start: point,
        origin: { ...origin },
      };
      box.focus();
    } else {
      selected = -1;
      drag = { mode: 'draw', index: -1, start: point, origin: null };
    }
    overlay.setPointerCapture(event.pointerId);
    event.preventDefault();
    commit();
  });

  overlay.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = pointFromEvent(event);
    if (drag.mode === 'draw') {
      showMarquee(rectFromPoints(drag.start, point));
      return;
    }
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    const origin = drag.origin;
    if (!origin) return;
    setRegion(
      drag.index,
      drag.mode === 'move' ? moveRegion(origin, dx, dy) : resizeRegion(origin, dx, dy),
      false,
    );
  });

  function endDrag(event: PointerEvent): void {
    if (!drag) return;
    const finished = drag;
    drag = null;
    marquee.hidden = true;
    if (finished.mode === 'draw') {
      const rect = rectFromPoints(finished.start, pointFromEvent(event));
      if (rect.w >= MIN_REGION_PERCENT && rect.h >= MIN_REGION_PERCENT) {
        regions = addRegion(regions, rect);
        selected = regions.length - 1;
        commit();
        focusRegion(selected);
      } else {
        setPageStatus('That rectangle is too small — drag a larger one, or use “Add a region”.');
      }
      return;
    }
    commit();
  }

  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

  /* ---------------------------------------------------------------------- */
  /*  Keyboard interaction                                                   */
  /* ---------------------------------------------------------------------- */

  overlay.addEventListener('keydown', (event) => {
    const box = (event.target as HTMLElement).closest<HTMLElement>('[data-region]');
    if (!box) return;
    const index = Number(box.dataset.region);
    const region = regions[index];
    if (!region) return;
    const step = event.shiftKey ? 5 : 1;
    const key = event.key;

    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      removeRegion(index);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      selectRegion(index);
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      selected = -1;
      commit();
      return;
    }

    let next: PageRegion | null = null;
    if (key === 'ArrowLeft') next = moveRegion(region, -step, 0);
    else if (key === 'ArrowRight') next = moveRegion(region, step, 0);
    else if (key === 'ArrowUp') next = moveRegion(region, 0, -step);
    else if (key === 'ArrowDown') next = moveRegion(region, 0, step);
    else if (key === '+' || key === '=') next = resizeRegion(region, step, step);
    else if (key === '-' || key === '_') next = resizeRegion(region, -step, -step);
    if (!next) return;
    event.preventDefault();
    setRegion(index, next);
  });

  regionList.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    const item = target.closest<HTMLElement>('[data-region-item]');
    if (!item) return;
    const index = Number(item.dataset.regionItem);
    const field = target.getAttribute('data-region-field');
    if (field === 'x' || field === 'y' || field === 'w' || field === 'h') {
      const value = Number((target as HTMLInputElement).value);
      setRegion(index, { ...regions[index]!, [field]: value }, false);
    }
  });

  regionList.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const item = target.closest<HTMLElement>('[data-region-item]');
    if (!item) return;
    const index = Number(item.dataset.regionItem);
    if (target.closest('[data-region-remove]')) {
      removeRegion(index);
      return;
    }
    if (target.closest('button, input, label')) return;
    selected = index;
    commit();
  });

  regionList.addEventListener('focusin', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-region-item]');
    if (!item) return;
    const index = Number(item.dataset.regionItem);
    if (index !== selected) {
      selected = index;
      renderOverlay();
    }
  });
  /* ---------------------------------------------------------------------- */
  /*  Page preview                                                           */
  /* ---------------------------------------------------------------------- */

  /** Draw the current page onto the preview canvas, sized to the stage. */
  async function renderPagePreview(): Promise<void> {
    if (!pdfDoc) return;
    const pdfPage = await pdfDoc.getPage(currentPage);
    const rotation = pdfPage.rotate || 0;
    const base = pdfPage.getViewport({ scale: 1, rotation });
    const fit = Math.min(PREVIEW_MAX_W / base.width, PREVIEW_MAX_H / base.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewport = pdfPage.getViewport({ scale: fit * dpr, rotation });
    preview.width = Math.max(1, Math.ceil(viewport.width));
    preview.height = Math.max(1, Math.ceil(viewport.height));
    preview.style.width = `${Math.round(viewport.width / dpr)}px`;
    preview.style.height = `${Math.round(viewport.height / dpr)}px`;
    stage.style.width = preview.style.width;
    stage.style.height = preview.style.height;
    const ctx = preview.getContext('2d');
    if (!ctx) return;
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    pdfPage.cleanup();
    // `base` is the page at 1 px per point with its rotation already applied,
    // so its width and height are the displayed size — do not rotate again.
    setPageStatus(
      `Page ${currentPage} of ${pageCount} — ${Math.round(base.width)} × ${Math.round(base.height)} pt. Drag on the page to cover content, then run.`,
    );
  }

  /** Save the current page's rectangles, then show another page. */
  async function switchPage(page: number): Promise<void> {
    if (!pdfDoc || page < 1 || page > pageCount) return;
    regionsByPage.set(currentPage, regions);
    currentPage = page;
    regions = regionsByPage.get(page) ?? [];
    selected = -1;
    renderPageTabs();
    commit();
    try {
      await renderPagePreview();
    } catch {
      setPageStatus('That page could not be drawn, but you can still run the redaction.');
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                         */
  /* ---------------------------------------------------------------------- */

  async function setFile(next: File | null): Promise<void> {
    file = next;
    fileUsable = false;
    pageCount = 0;
    currentPage = 1;
    regions = [];
    regionsByPage.clear();
    selected = -1;
    drag = null;
    clearError(errorBox);
    resultWrap.hidden = true;
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    for (const url of outputUrls) URL.revokeObjectURL(url);
    outputUrls.clear();
    // Hide the stage the moment the file is cleared, before any async teardown,
    // so a reset never leaves a stale preview visible.
    if (!next) stageWrap.hidden = true;
    renderFileList();
    renderPageTabs();
    syncPlanField();
    renderOverlay();
    renderRegionList();
    updateRunState();

    if (pdfDoc) {
      await pdfDoc.destroy().catch(() => undefined);
      pdfDoc = null;
    }
    if (!file) {
      stageWrap.hidden = true;
      setPageStatus('Choose a PDF to start redacting.');
      return;
    }
    if (!(await looksLikePdf(file))) {
      stageWrap.hidden = true;
      showError(errorBox, 'That file is not a PDF.', 'Choose a PDF document to redact.');
      setPageStatus('That file could not be read — choose a PDF.');
      return;
    }
    try {
      const pdfjs = await loadPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      pdfDoc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
      pageCount = pdfDoc.numPages;
      currentPage = 1;
      fileUsable = true;
      stageWrap.hidden = false;
      renderPageTabs();
      updateRunState();
      await renderPagePreview();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      stageWrap.hidden = true;
      showError(
        errorBox,
        /password/i.test(message)
          ? 'This PDF is password-protected — unlock it first.'
          : 'That PDF could not be read.',
        'The document may be damaged or encrypted.',
      );
      setPageStatus('That PDF could not be read.');
    }
  }

  const dz = createDropZone(dropEl, {
    accept,
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
    if (!(event.target as HTMLElement).closest('[data-remove]')) return;
    void setFile(null);
  });

  pageTabs.addEventListener('click', (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-page-tab]');
    if (!tab) return;
    void switchPage(Number(tab.dataset.pageTab));
  });

  addBtn.addEventListener('click', () => {
    regions = addRegion(regions, defaultRegion());
    selected = regions.length - 1;
    commit();
    focusRegion(selected);
    setPageStatus(`Added region ${selected + 1} in the middle of this page.`);
  });

  clearBtn.addEventListener('click', () => {
    regions = [];
    selected = -1;
    commit();
    setPageStatus('No rectangles on this page — drag on the preview to add one.');
  });

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                    */
  /* ---------------------------------------------------------------------- */

  function renderOutputs(result: FileRunResult): void {
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
  }

  async function run(): Promise<void> {
    if (!file || !fileUsable) {
      showError(errorBox, 'Choose a PDF to redact.');
      return;
    }
    syncPlanField();
    let planned: RedactionPlan;
    try {
      planned = planPages(parsePlanEntries(planField.value), pageCount);
    } catch (error) {
      const err = error as Error & { hint?: string };
      showError(errorBox, err.message || 'The redaction plan could not be read.', err.hint);
      return;
    }
    if (!planned.rasterise.length) {
      showError(
        errorBox,
        'Nothing to redact.',
        'Draw at least one rectangle over the content you want to destroy.',
      );
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
        {
          files: [file],
          options: {
            ...readOptions(optionsRoot),
            plan: planField.value,
            outputName: outputNameFor(file.name),
          },
        },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => {
            if (generation !== runGeneration) return;
            const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
            progressBar.style.width = `${percent}%`;
            progressMsg.textContent = message ? `${message} — ${percent}%` : `${percent}%`;
          },
        },
      );
      if (generation !== runGeneration) return;
      progressBar.style.width = '100%';
      progressMsg.textContent = 'Done';
      renderOutputs(result);
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name !== 'AbortError') showError(errorBox, err.message || 'Redaction failed', err.hint);
      else progressMsg.textContent = 'Cancelled';
    } finally {
      if (generation === runGeneration) {
        runBtn.disabled = false;
        cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

  runBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => controller?.abort());
  resetBtn.addEventListener('click', () => {
    runGeneration += 1;
    controller?.abort();
    controller = null;
    progressWrap.hidden = true;
    progressBar.style.width = '0%';
    progressMsg.textContent = '';
    void setFile(null);
    updateRunState();
  });

  planField.addEventListener('input', () => planField.removeAttribute('aria-invalid'));
  optionsRoot.addEventListener('input', () => applyShowWhen(optionsRoot));
  optionsRoot.addEventListener('change', () => applyShowWhen(optionsRoot));

  bindRangeOutputs(root);
  applyShowWhen(optionsRoot);
  renderFileList();
  renderPageTabs();
  syncPlanField();
  renderOverlay();
  renderRegionList();
  updateRunState();
  setPageStatus('Choose a PDF to start redacting.');

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      for (const url of outputUrls) URL.revokeObjectURL(url);
      dz.destroy();
      void pdfDoc?.destroy().catch(() => undefined);
    },
    { once: true },
  );
}
