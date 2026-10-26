/**
 * The PDF organiser panel.
 *
 * Owns the thumbnail grid: the user reorders the pages (by dragging or with
 * the keyboard), rotates them, deletes them and inserts blank sheets. The
 * resulting page plan is handed to the generic Web Worker
 * (`pdf-organize.tool.ts`), which rebuilds the PDF with pdf-lib — so a large
 * document never freezes the tab.
 *
 * The thumbnails are rendered locally with pdf.js — a lazily loaded, same
 * origin dependency. No request ever leaves the site.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { FileRunResult } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { clearError, showError } from '../workbench/shared';
import {
  DEFAULT_BLANK_SIZE,
  PAGE_SIZES,
  planToJson,
  type PlanEntry,
} from '@/tools/pdf/pdf-organize.core';
// The `%PDF-` header probe is shared with the signing workbench.
import { looksLikePdfBytes } from '@/tools/pdf/pdf-sign.core';

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; isEvalSupported: boolean }) => {
    promise: Promise<PDFDocumentProxy>;
  };
};

/** How many bytes of a file are inspected for the `%PDF-` header. */
const HEADER_SCAN_BYTES = 1024;

/** Largest thumbnail edge, in CSS pixels. */
const THUMB_MAX_W = 132;
const THUMB_MAX_H = 176;

/* -------------------------------------------------------------------------- */
/*  Pure helpers — the plan maths, testable without a DOM                      */
/* -------------------------------------------------------------------------- */

/** A page on the grid: a plan entry plus a stable id used to track its DOM. */
export interface OrganizerPage extends PlanEntry {
  /** Stable id — survives reordering, rotation and deletion. */
  id: number;
}

/** Move the page at `from` to `to`. Out-of-range moves are ignored. */
export function movePage(pages: OrganizerPage[], from: number, to: number): OrganizerPage[] {
  if (from < 0 || from >= pages.length) return pages;
  const target = Math.max(0, Math.min(pages.length - 1, to));
  if (target === from) return pages;
  const next = pages.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  return next;
}

/** Turn the page at `index` by `delta` degrees (clockwise). */
export function rotatePage(pages: OrganizerPage[], index: number, delta: number): OrganizerPage[] {
  if (index < 0 || index >= pages.length) return pages;
  const step = (((Math.round(delta / 90) * 90) % 360) + 360) % 360;
  const next = pages.slice();
  const page = next[index]!;
  next[index] = { ...page, rotate: (page.rotate + step) % 360 };
  return next;
}

/** Drop the page at `index`. */
export function removePage(pages: OrganizerPage[], index: number): OrganizerPage[] {
  if (index < 0 || index >= pages.length) return pages;
  const next = pages.slice();
  next.splice(index, 1);
  return next;
}

/** Insert a blank page at `at` (0 = the very beginning). */
export function insertBlankPage(
  pages: OrganizerPage[],
  at: number,
  sizeId: string,
  id: number,
): OrganizerPage[] {
  const index = Math.max(0, Math.min(pages.length, at));
  const next = pages.slice();
  next.splice(index, 0, { id, rotate: 0, blank: true, size: sizeId });
  return next;
}

/** The JSON page plan the tool understands. */
export function buildPlan(pages: OrganizerPage[]): string {
  return planToJson(pages);
}

/** "page 2 of 5" / "blank page 3 of 5" — the name used in labels. */
export function describePage(page: OrganizerPage, index: number, total: number): string {
  return page.blank ? `blank page ${index + 1} of ${total}` : `page ${index + 1} of ${total}`;
}

/** "3, 1, blank, 2" — the current order, for the live region. */
export function describeOrder(pages: OrganizerPage[]): string {
  if (!pages.length) return 'no pages';
  return pages.map((page) => (page.blank ? 'blank' : String(page.source))).join(', ');
}

/** The output file name derived from the source name. */
export function outputNameFor(name: string): string {
  const base = name.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}-organized.pdf`;
}

/* -------------------------------------------------------------------------- */
/*  pdf.js                                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Panel                                                                       */
/* -------------------------------------------------------------------------- */

/** Mount the organiser panel into a `[data-file-workbench]` element. */
export function mountPdfOrganizePanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'pdf-organize';
  const dropEl = root.querySelector<HTMLElement>('[data-drop]')!;
  const listEl = root.querySelector<HTMLUListElement>('[data-file-list]')!;
  const gridEl = root.querySelector<HTMLUListElement>('[data-grid]')!;
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
  const blankSizeEl = root.querySelector<HTMLSelectElement>('[data-blank-size]')!;
  const insertBtn = root.querySelector<HTMLButtonElement>('[data-insert-blank]')!;
  const resetOrderBtn = root.querySelector<HTMLButtonElement>('[data-reset-order]')!;
  const orderStatusEl = root.querySelector<HTMLElement>('[data-order-status]')!;

  if (
    !dropEl ||
    !listEl ||
    !gridEl ||
    !runBtn ||
    !cancelBtn ||
    !resetBtn ||
    !errorBox ||
    !progressWrap ||
    !progressBar ||
    !progressMsg ||
    !resultWrap ||
    !outputsEl ||
    !notesEl ||
    !blankSizeEl ||
    !insertBtn ||
    !resetOrderBtn ||
    !orderStatusEl
  ) {
    return;
  }

  let file: File | null = null;
  let pdfDoc: PDFDocumentProxy | null = null;
  /** The pages on the grid, in the order the user arranged them. */
  let pages: OrganizerPage[] = [];
  /** The original order, so "Reset order" can go back to it. */
  let originalPages: OrganizerPage[] = [];
  let nextId = 1;
  /** The canvas of every page, reused across re-renders. */
  const thumbs = new Map<number, HTMLCanvasElement>();
  /** The rotation each canvas was last drawn at. */
  const rendered = new Map<number, number>();
  let controller: AbortController | null = null;
  let runGeneration = 0;
  /** The page id being dragged, or null. */
  let dragId: number | null = null;

  /* ---------------------------------------------------------------------- */
  /*  Status + summary                                                      */
  /* ---------------------------------------------------------------------- */

  function announce(message: string): void {
    orderStatusEl.textContent = `${message} New order: ${describeOrder(pages)}.`;
  }

  function announceCurrent(message: string): void {
    orderStatusEl.textContent = message;
  }

  function updateRunState(): void {
    runBtn.disabled = !file || !pages.length;
    insertBtn.disabled = !file;
    resetOrderBtn.disabled = !file || !pages.length;
  }

  /* ---------------------------------------------------------------------- */
  /*  Thumbnails                                                            */
  /* ---------------------------------------------------------------------- */

  async function renderThumb(page: OrganizerPage, canvas: HTMLCanvasElement): Promise<void> {
    if (page.blank || !pdfDoc || page.source === undefined) return;
    // Make sure pdf.js (and its worker) is ready before a page is drawn.
    await loadPdfJs();
    const doc = pdfDoc;
    if (!doc) return;
    const pdfPage = await doc.getPage(page.source);
    // The turn the user picked is added to the rotation the page already has,
    // which is exactly what the tool does when it rebuilds the PDF.
    const rotation = ((((pdfPage.rotate || 0) + page.rotate) % 360) + 360) % 360;
    const probe = pdfPage.getViewport({ scale: 1, rotation });
    const scale = Math.min(THUMB_MAX_W / probe.width, THUMB_MAX_H / probe.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewport = pdfPage.getViewport({ scale: scale * dpr, rotation });
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    pdfPage.cleanup();
  }

  /** Draw every thumbnail that is missing or out of date. */
  async function ensureThumbnails(): Promise<void> {
    for (const page of pages) {
      if (page.blank) continue;
      const canvas = thumbs.get(page.id);
      if (!canvas) continue;
      if (rendered.get(page.id) === page.rotate) continue;
      try {
        await renderThumb(page, canvas);
        rendered.set(page.id, page.rotate);
      } catch {
        // A page that cannot be drawn keeps its blank placeholder; the PDF
        // itself is still assembled correctly by the worker.
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Grid                                                                  */
  /* ---------------------------------------------------------------------- */

  function makeButton(
    label: string,
    glyph: string,
    action: string,
    disabled: boolean,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-subtle btn-sm';
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    button.dataset.action = action;
    button.disabled = disabled;
    return button;
  }

  function renderGrid(): void {
    gridEl.innerHTML = '';
    pages.forEach((page, index) => {
      const total = pages.length;
      const label = describePage(page, index, total);

      const item = document.createElement('li');
      item.className = 'flex flex-col gap-1.5 rounded-lg border p-2';
      item.dataset.pageId = String(page.id);
      item.setAttribute(
        'aria-label',
        page.blank
          ? `${label}, ${PAGE_SIZES[page.size ?? DEFAULT_BLANK_SIZE]?.label ?? 'blank sheet'}`
          : `${label}, from original page ${page.source}`,
      );

      const frame = document.createElement('div');
      frame.className =
        'flex h-[184px] w-full items-center justify-center rounded-md border bg-white';
      frame.tabIndex = 0;
      frame.setAttribute('role', 'group');
      frame.dataset.pageFocus = String(page.id);
      frame.setAttribute(
        'aria-label',
        `${label}. Use the left and right arrow keys to move it, or the buttons below.`,
      );
      frame.draggable = true;

      if (page.blank) {
        const placeholder = document.createElement('span');
        placeholder.className = 'text-xs text-[rgb(var(--text-muted))]';
        placeholder.textContent = PAGE_SIZES[page.size ?? DEFAULT_BLANK_SIZE]?.label ?? 'Blank';
        frame.append(placeholder);
      } else {
        let canvas = thumbs.get(page.id);
        if (!canvas) {
          canvas = document.createElement('canvas');
          thumbs.set(page.id, canvas);
        }
        canvas.className = 'block';
        frame.append(canvas);
      }
      item.append(frame);

      const caption = document.createElement('p');
      caption.className = 'text-xs font-medium text-[rgb(var(--text))]';
      const position = document.createElement('span');
      position.textContent = `${index + 1}. ${page.blank ? 'Blank page' : `Original page ${page.source}`}`;
      caption.append(position);
      if (page.rotate) {
        const turn = document.createElement('span');
        turn.className = 'ml-1 text-[rgb(var(--text-muted))]';
        turn.textContent = `· turned ${page.rotate}°`;
        caption.append(turn);
      }
      item.append(caption);

      const controls = document.createElement('div');
      controls.className = 'flex flex-wrap gap-1';
      controls.append(
        makeButton(`Move ${label} earlier`, '←', 'move-left', index === 0),
        makeButton(`Move ${label} later`, '→', 'move-right', index === total - 1),
        makeButton(`Rotate ${label} counter-clockwise`, '⟲', 'rotate-left', false),
        makeButton(`Rotate ${label} clockwise`, '⟳', 'rotate-right', false),
        makeButton(`Delete ${label}`, '✕', 'delete', false),
      );
      item.append(controls);

      gridEl.append(item);
    });
    updateRunState();
  }

  /** Re-render the grid and draw the thumbnails that changed. */
  function refresh(): void {
    renderGrid();
    void ensureThumbnails();
  }

  /** Move a page and keep the keyboard focus on it. */
  function moveTo(index: number, target: number): void {
    const page = pages[index];
    if (!page) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, target));
    if (clamped === index) {
      announceCurrent(`${describePage(page, index, pages.length)} did not move.`);
      return;
    }
    pages = movePage(pages, index, clamped);
    refresh();
    announce(
      `${describePage(page, clamped, pages.length)} moved to position ${clamped + 1} of ${pages.length}.`,
    );
    focusPage(page.id);
  }

  function focusPage(id: number): void {
    const frame = gridEl.querySelector<HTMLElement>(`[data-page-focus="${id}"]`);
    frame?.focus();
  }

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                        */
  /* ---------------------------------------------------------------------- */

  function renderList(): void {
    listEl.innerHTML = file
      ? `<li class="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
          <span class="truncate">${escapeHtml(file.name)}</span>
          <span class="flex items-center gap-2 shrink-0 text-xs text-[rgb(var(--text-muted))]">
            ${formatBytes(file.size)}
            <button type="button" data-remove aria-label="Remove ${escapeHtml(file.name)}" class="hover:text-[rgb(var(--danger))]">✕</button>
          </span>
        </li>`
      : '';
    resetBtn.hidden = !file;
    updateRunState();
  }

  async function setFile(next: File | null): Promise<void> {
    file = next;
    pages = [];
    originalPages = [];
    nextId = 1;
    thumbs.clear();
    rendered.clear();
    if (pdfDoc) {
      await pdfDoc.destroy().catch(() => undefined);
      pdfDoc = null;
    }
    clearError(errorBox);
    resultWrap.hidden = true;
    renderList();
    gridEl.innerHTML = '';
    updateRunState();
    if (!file) {
      announceCurrent('Choose a PDF to arrange its pages.');
      return;
    }
    if (!(await looksLikePdf(file))) {
      showError(errorBox, 'That file is not a PDF.', 'Choose a PDF document to organise.');
      announceCurrent('Choose a PDF to arrange its pages.');
      return;
    }
    try {
      const pdfjs = await loadPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      pdfDoc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
      pages = Array.from({ length: pdfDoc.numPages }, (_, i) => ({
        id: nextId++,
        source: i + 1,
        rotate: 0,
        blank: false,
      }));
      originalPages = pages.slice();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      showError(
        errorBox,
        /password/i.test(message)
          ? 'This PDF is password-protected — unlock it first.'
          : 'That PDF could not be read.',
        'The document may be damaged or encrypted.',
      );
      announceCurrent('That PDF could not be read.');
      return;
    }
    refresh();
    announceCurrent(
      `${pages.length} pages loaded. Drag a page or use the arrow keys to rearrange.`,
    );
  }

  const dz = createDropZone(dropEl, {
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

  /* ---------------------------------------------------------------------- */
  /*  Grid interaction                                                      */
  /* ---------------------------------------------------------------------- */

  gridEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!button) return;
    const item = button.closest<HTMLElement>('[data-page-id]');
    const id = Number(item?.dataset.pageId);
    const index = pages.findIndex((page) => page.id === id);
    if (index < 0) return;
    const page = pages[index]!;
    switch (button.dataset.action) {
      case 'move-left':
        moveTo(index, index - 1);
        break;
      case 'move-right':
        moveTo(index, index + 1);
        break;
      case 'rotate-left': {
        pages = rotatePage(pages, index, -90);
        refresh();
        announce(
          `${describePage(page, index, pages.length)} turned ${pages[index]!.rotate}° clockwise.`,
        );
        break;
      }
      case 'rotate-right': {
        pages = rotatePage(pages, index, 90);
        refresh();
        announce(
          `${describePage(page, index, pages.length)} turned ${pages[index]!.rotate}° clockwise.`,
        );
        break;
      }
      case 'delete': {
        pages = removePage(pages, index);
        refresh();
        announce(`${describePage(page, index, pages.length + 1)} deleted.`);
        break;
      }
      default:
        break;
    }
  });

  gridEl.addEventListener('keydown', (event) => {
    const frame = (event.target as HTMLElement).closest<HTMLElement>('[data-page-focus]');
    if (!frame) return;
    const id = Number(frame.dataset.pageFocus);
    const index = pages.findIndex((page) => page.id === id);
    if (index < 0) return;
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        moveTo(index, index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        moveTo(index, index + 1);
        break;
      case 'Home':
        event.preventDefault();
        moveTo(index, 0);
        break;
      case 'End':
        event.preventDefault();
        moveTo(index, pages.length - 1);
        break;
      default:
        break;
    }
  });

  /* --- drag and drop ---------------------------------------------------- */

  gridEl.addEventListener('dragstart', (event) => {
    const frame = (event.target as HTMLElement).closest<HTMLElement>('[data-page-focus]');
    if (!frame) return;
    dragId = Number(frame.dataset.pageFocus);
    const transfer = (event as DragEvent).dataTransfer;
    if (transfer) {
      transfer.effectAllowed = 'move';
      transfer.setData('text/plain', String(dragId));
    }
  });

  gridEl.addEventListener('dragend', () => {
    dragId = null;
  });

  gridEl.addEventListener('dragover', (event) => {
    if (dragId === null) return;
    event.preventDefault();
    const transfer = (event as DragEvent).dataTransfer;
    if (transfer) transfer.dropEffect = 'move';
  });

  gridEl.addEventListener('drop', (event) => {
    if (dragId === null) return;
    event.preventDefault();
    const from = pages.findIndex((page) => page.id === dragId);
    if (from < 0) return;
    const index = dropIndex((event as DragEvent).clientX, (event as DragEvent).clientY);
    dragId = null;
    const page = pages[from]!;
    const without = pages.filter((entry) => entry.id !== page.id);
    const target = Math.max(0, Math.min(without.length, index > from ? index - 1 : index));
    without.splice(target, 0, page);
    pages = without;
    refresh();
    announce(
      `${describePage(page, target, pages.length)} moved to position ${target + 1} of ${pages.length}.`,
    );
  });

  /** Where a dropped page lands, from the pointer position. */
  function dropIndex(clientX: number, clientY: number): number {
    const items = Array.from(gridEl.querySelectorAll<HTMLElement>('[data-page-id]'));
    for (let i = 0; i < items.length; i++) {
      const rect = items[i]!.getBoundingClientRect();
      if (clientY < rect.bottom) {
        return clientX < rect.left + rect.width / 2 ? i : i + 1;
      }
    }
    return items.length;
  }

  /* ---------------------------------------------------------------------- */
  /*  Blank pages + reset                                                   */
  /* ---------------------------------------------------------------------- */

  insertBtn.addEventListener('click', () => {
    if (!file) return;
    const size = blankSizeEl.value || DEFAULT_BLANK_SIZE;
    pages = insertBlankPage(pages, pages.length, size, nextId++);
    refresh();
    announce(`A blank page was added at the end.`);
  });

  resetOrderBtn.addEventListener('click', () => {
    if (!originalPages.length) return;
    pages = originalPages.slice();
    refresh();
    announceCurrent('The original order was restored.');
  });

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                   */
  /* ---------------------------------------------------------------------- */

  async function run(): Promise<void> {
    if (!file) return;
    if (!pages.length) {
      showError(errorBox, 'There are no pages to save.', 'Pick a PDF with at least one page.');
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
            pages: buildPlan(pages),
            blankSize: blankSizeEl.value || DEFAULT_BLANK_SIZE,
            outputName: outputNameFor(file.name),
          },
        },
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
      renderOutputs(result);
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name !== 'AbortError') showError(errorBox, err.message || 'Saving failed', err.hint);
      else progressMsg.textContent = 'Cancelled';
    } finally {
      if (generation === runGeneration) {
        runBtn.disabled = false;
        cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

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
    resultWrap.hidden = true;
    clearError(errorBox);
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      dz.destroy();
      void pdfDoc?.destroy().catch(() => undefined);
    },
    { once: true },
  );

  announceCurrent('Choose a PDF to arrange its pages.');
}
