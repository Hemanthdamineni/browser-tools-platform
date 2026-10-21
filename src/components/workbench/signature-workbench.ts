/**
 * The PDF signing workbench.
 *
 * Owns three steps: pick the PDF, capture a signature, place it on a preview
 * of the chosen page. The actual signing happens in the generic Web Worker
 * (`pdf-sign.tool.ts`), so a large document never freezes the tab.
 *
 * The page preview is rendered locally with pdf.js — a lazily loaded, same
 * origin dependency. No request ever leaves the site.
 */
import type { FileRunResult } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { SIGNATURE_CHANGE_EVENT, type SignatureAsset } from '@/lib/signature/types';
import { clampRect, defaultPlacement, fitSize, type DisplayRect } from '@/tools/pdf/pdf-sign.core';
import { runToolById } from '@/lib/worker/client';
import { clearError, showError } from './shared';

type PdfJsModule = typeof import('pdfjs-dist');
type PdfDocument = Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>;

/** Page size used when the preview cannot be rendered (A4 in points). */
const FALLBACK_PAGE = { width: 595.28, height: 841.89 };

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

/** Mount the signing panel into a `[data-file-workbench]` element. */
export function mountSignatureWorkbench(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'pdf-sign';
  const dropEl = root.querySelector<HTMLElement>('[data-drop]')!;
  const listEl = root.querySelector<HTMLUListElement>('[data-file-list]')!;
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
  const pageInput = root.querySelector<HTMLInputElement>('[data-page-input]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-page-canvas]')!;
  const box = root.querySelector<HTMLElement>('[data-signature-box]')!;
  const image = root.querySelector<HTMLImageElement>('[data-signature-image]')!;
  const previewStatus = root.querySelector<HTMLElement>('[data-preview-status]')!;
  const xInput = root.querySelector<HTMLInputElement>('[data-placement="x"]')!;
  const yInput = root.querySelector<HTMLInputElement>('[data-placement="y"]')!;
  const widthInput = root.querySelector<HTMLInputElement>('[data-placement="width"]')!;
  const capture = root.querySelector<HTMLElement>('[data-signature-capture]');

  if (
    !dropEl ||
    !listEl ||
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
    !pageInput ||
    !canvas ||
    !box ||
    !image ||
    !previewStatus ||
    !xInput ||
    !yInput ||
    !widthInput
  ) {
    return;
  }
  let file: File | null = null;
  let asset: SignatureAsset | null = null;
  let placement: DisplayRect | null = null;
  let pageNumber = 1;
  let pageCount = 1;
  let pageSize = { ...FALLBACK_PAGE };
  /** CSS pixels per point. */
  let scale = 1;
  let pdfDoc: PdfDocument | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;

  /* ---------------------------------------------------------------------- */
  /*  Placement helpers                                                      */
  /* ---------------------------------------------------------------------- */

  const aspect = (): number => (asset && asset.height ? asset.width / asset.height : 1);

  function syncInputs(): void {
    if (!placement) return;
    xInput.value = String(Math.round(placement.x * 10) / 10);
    yInput.value = String(Math.round(placement.y * 10) / 10);
    widthInput.value = String(Math.round(placement.width * 10) / 10);
  }

  function updateOverlay(): void {
    if (!asset || !placement) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.style.left = `${placement.x * scale}px`;
    box.style.top = `${placement.y * scale}px`;
    box.style.width = `${Math.max(4, placement.width * scale)}px`;
    box.style.height = `${Math.max(4, placement.height * scale)}px`;
  }

  function applyPlacement(next: Partial<DisplayRect>): void {
    if (!placement) return;
    const merged: DisplayRect = { ...placement, ...next };
    if (next.width !== undefined) {
      // The height always follows the signature's own aspect ratio.
      const size = fitSize(next.width, aspect(), pageSize);
      merged.width = size.width;
      merged.height = size.height;
    }
    placement = clampRect(merged, pageSize);
    syncInputs();
    updateOverlay();
  }

  function resetPlacement(): void {
    if (!asset) {
      placement = null;
      updateOverlay();
      return;
    }
    const width = Math.min(180, pageSize.width * 0.35);
    placement = defaultPlacement(pageSize, aspect(), width);
    syncInputs();
    updateOverlay();
  }

  function updateRunState(): void {
    runBtn.disabled = !file || !asset || !placement;
  }

  /* ---------------------------------------------------------------------- */
  /*  Page preview                                                           */
  /* ---------------------------------------------------------------------- */

  async function renderPreview(): Promise<void> {
    if (!file) return;
    previewStatus.textContent = 'Rendering the page preview…';
    try {
      const pdfjs = await loadPdfJs();
      if (!pdfDoc) {
        const data = new Uint8Array(await file.arrayBuffer());
        pdfDoc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        pageCount = pdfDoc.numPages;
        pageInput.max = String(pageCount);
      }
      if (pageNumber > pageCount) {
        pageNumber = pageCount;
        pageInput.value = String(pageNumber);
      }
      const page = await pdfDoc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      pageSize = { width: base.width, height: base.height };

      const cssWidth = Math.max(240, canvas.getBoundingClientRect().width || 640);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot open a 2D canvas.');
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      scale = cssWidth / base.width;
      previewStatus.textContent = `Page ${pageNumber} of ${pageCount} — ${Math.round(base.width)} × ${Math.round(base.height)} pt.`;
      if (placement) {
        placement = clampRect(placement, pageSize);
        syncInputs();
      } else {
        resetPlacement();
      }
      updateOverlay();
    } catch (error) {
      // The preview is a convenience: if it cannot be rendered the signature
      // can still be placed on a blank sheet of the right proportions.
      const message = error instanceof Error ? error.message : '';
      if (/password/i.test(message)) {
        previewStatus.textContent = 'This PDF is password-protected — unlock it before signing.';
      } else {
        previewStatus.textContent =
          'The page preview could not be rendered — the signature is placed on a blank A4 outline.';
      }
      pageSize = { ...FALLBACK_PAGE };
      const cssWidth = Math.max(240, canvas.getBoundingClientRect().width || 640);
      scale = cssWidth / FALLBACK_PAGE.width;
      canvas.width = Math.round(FALLBACK_PAGE.width * scale * 2);
      canvas.height = Math.round(FALLBACK_PAGE.height * scale * 2);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // A blank sheet of paper, not a black rectangle.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (placement) {
        placement = clampRect(placement, pageSize);
        syncInputs();
      } else {
        resetPlacement();
      }
      updateOverlay();
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                         */
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
    pageNumber = 1;
    pageInput.value = '1';
    if (pdfDoc) {
      await pdfDoc.destroy().catch(() => undefined);
      pdfDoc = null;
    }
    clearError(errorBox);
    resultWrap.hidden = true;
    renderList();
    if (!file) {
      canvas.width = 0;
      canvas.height = 0;
      box.hidden = true;
      previewStatus.textContent = 'Choose a PDF to see the page.';
      return;
    }
    await renderPreview();
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
  /*  Signature + placement interaction                                      */
  /* ---------------------------------------------------------------------- */

  capture?.addEventListener(SIGNATURE_CHANGE_EVENT, (event) => {
    const detail = (event as CustomEvent<SignatureAsset | null>).detail ?? null;
    asset = detail;
    if (asset) {
      image.src = asset.dataUrl;
      resetPlacement();
    } else {
      placement = null;
      updateOverlay();
    }
    updateRunState();
  });

  pageInput.addEventListener('change', () => {
    const next = Math.round(Number(pageInput.value) || 1);
    pageNumber = next < 1 ? 1 : next;
    pageInput.value = String(pageNumber);
    void renderPreview();
  });

  xInput.addEventListener('input', () => applyPlacement({ x: Number(xInput.value) || 0 }));
  yInput.addEventListener('input', () => applyPlacement({ y: Number(yInput.value) || 0 }));
  widthInput.addEventListener('input', () => {
    const width = Number(widthInput.value);
    if (Number.isFinite(width) && width > 0) applyPlacement({ width });
  });

  type Drag = { mode: 'move' | 'resize'; startX: number; startY: number; origin: DisplayRect };
  let drag: Drag | null = null;

  box.addEventListener('pointerdown', (event) => {
    if (!placement || !asset) return;
    const target = event.target as HTMLElement;
    const mode = target.closest('[data-resize-handle]') ? 'resize' : 'move';
    drag = { mode, startX: event.clientX, startY: event.clientY, origin: { ...placement } };
    box.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  box.addEventListener('pointermove', (event) => {
    if (!drag || !placement) return;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    if (drag.mode === 'move') {
      applyPlacement({ x: drag.origin.x + dx, y: drag.origin.y + dy });
    } else {
      const width = Math.max(8, drag.origin.width + dx);
      applyPlacement({ width });
    }
  });

  const endDrag = () => {
    drag = null;
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);

  box.addEventListener('keydown', (event) => {
    if (!placement) return;
    const step = event.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    else return;
    event.preventDefault();
    applyPlacement({ x: placement.x + dx, y: placement.y + dy });
  });

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                    */
  /* ---------------------------------------------------------------------- */

  async function run(): Promise<void> {
    if (!file) return;
    if (!asset || !placement) {
      showError(errorBox, 'Create a signature first — draw it, type it or upload one.');
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
            page: pageNumber,
            x: Math.round(placement.x * 100) / 100,
            y: Math.round(placement.y * 100) / 100,
            width: Math.round(placement.width * 100) / 100,
            signature: asset.dataUrl,
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
      if (err.name !== 'AbortError') showError(errorBox, err.message || 'Signing failed', err.hint);
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
}
