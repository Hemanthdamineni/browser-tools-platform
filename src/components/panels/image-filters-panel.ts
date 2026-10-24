/**
 * The "Image Filters" panel.
 *
 * The generic file workbench cannot show a live, filtered preview, so the tool
 * sets `meta.panel = 'image-filters'` and this component replaces it. The panel
 * decodes the chosen image, draws it — downscaled — onto a `<canvas>` and runs
 * the very same `image-filters.core` pipeline the worker uses on export, so the
 * preview and the downloaded file always match. The only difference is
 * resolution: the export runs the pipeline on the full-resolution pixels.
 *
 * The DOM code lives here; every pixel operation is delegated to the pure core
 * module, which is unit-tested without a canvas.
 */
import type { FileRunResult, OptionValues } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  applyShowWhen,
  bindRangeOutputs,
  clearError,
  readOptions,
  showError,
} from '@/components/workbench/shared';
import {
  applyFilters,
  describeParams,
  parseParams,
  previewSize,
} from '@/tools/image/image-filters.core';
import { assertCanvasBudget } from '@/tools/image/image-batch';

/** Largest preview canvas, in pixels. Bigger images are previewed downscaled. */
export const PREVIEW_MAX_PIXELS = 2_000_000;

/** Preview canvas size for an image, capped so a huge photo stays responsive. */
export function previewDimensions(
  width: number,
  height: number,
): { width: number; height: number; scale: number } {
  return previewSize(width, height, PREVIEW_MAX_PIXELS);
}

/** The label the compare button shows: what the click will do next. */
export function compareLabel(showOriginal: boolean): string {
  return showOriginal ? 'Show the edited image' : 'Compare with the original';
}

/** Look up a required element, so a markup change fails loudly. */
function need<T extends Element>(parent: ParentNode, selector: string): T {
  const el = parent.querySelector<T>(selector);
  if (!el) throw new Error(`image-filters panel is missing ${selector}`);
  return el;
}

/**
 * Decode a file into a bitmap for the preview, honouring EXIF orientation — the
 * same path the worker takes (`image-batch.ts: decodeOriented`).
 */
async function decodeForPreview(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

/** Mount the panel into its `[data-image-filters-panel]` root. */
export function mountImageFiltersPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'image-filters';
  const accept = root.dataset.accept || undefined;

  const dropEl = need<HTMLElement>(root, '[data-drop]');
  const listEl = need<HTMLUListElement>(root, '[data-file-list]');
  const previewWrap = need<HTMLElement>(root, '[data-preview-wrap]');
  const canvas = need<HTMLCanvasElement>(root, '[data-preview-canvas]');
  const previewStatus = need<HTMLElement>(root, '[data-preview-status]');
  const compareBtn = need<HTMLButtonElement>(root, '[data-compare]');
  const resetFiltersBtn = need<HTMLButtonElement>(root, '[data-reset-filters]');
  const runBtn = need<HTMLButtonElement>(root, '[data-run]');
  const cancelBtn = need<HTMLButtonElement>(root, '[data-cancel]');
  const resetBtn = need<HTMLButtonElement>(root, '[data-reset]');
  const errorBox = need<HTMLElement>(root, '[data-error]');
  const progressWrap = need<HTMLElement>(root, '[data-progress-wrap]');
  const progressBar = need<HTMLElement>(root, '[data-progress-bar]');
  const progressMsg = need<HTMLElement>(root, '[data-progress-msg]');
  const resultWrap = need<HTMLElement>(root, '[data-result-wrap]');
  const outputsEl = need<HTMLUListElement>(root, '[data-outputs]');
  const notesEl = need<HTMLUListElement>(root, '[data-notes]');
  // Every option control lives inside the panel, so the panel root is the scope.
  const optionsRoot = root;
  bindRangeOutputs(optionsRoot);

  // Snapshot the declared defaults before the user can change anything, so the
  // Reset button restores exactly the values the form started with.
  const defaultValues: OptionValues = readOptions(optionsRoot);

  let file: File | null = null;
  let bitmap: ImageBitmap | null = null;
  /** The unfiltered preview pixels, kept so Compare and re-renders stay exact. */
  let original: ImageData | null = null;
  let showOriginal = false;
  let controller: AbortController | null = null;
  /** Bumped on every run / load / reset so a late reply cannot publish stale state. */
  let runGeneration = 0;
  let loadGeneration = 0;
  let rafId = 0;
  const resultUrls = new Set<string>();

  const announce = (message: string) => {
    previewStatus.textContent = message;
  };

  const currentParams = () => parseParams(readOptions(optionsRoot));

  function syncRunState(): void {
    runBtn.disabled = !file;
    resetBtn.hidden = !file;
    compareBtn.disabled = !bitmap;
  }

  function releaseBitmap(): void {
    bitmap?.close();
    bitmap = null;
  }

  function revokeResultUrls(): void {
    for (const url of resultUrls) URL.revokeObjectURL(url);
    resultUrls.clear();
  }

  /* ---------------------------------------------------------------------- */
  /*  Preview                                                                */
  /* ---------------------------------------------------------------------- */

  function placeCompareButton(): void {
    compareBtn.textContent = compareLabel(showOriginal);
    compareBtn.setAttribute('aria-pressed', String(showOriginal));
  }

  function clearPreview(message: string): void {
    releaseBitmap();
    original = null;
    previewWrap.hidden = true;
    compareBtn.disabled = true;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    announce(message);
  }

  /**
   * Redraw the preview from the cached source pixels. The pipeline is the same
   * one the worker runs, so this is the real result, not a CSS approximation.
   */
  function renderPreview(): void {
    if (!bitmap || !original) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      announce('This browser cannot draw a 2D canvas, so the preview is unavailable.');
      return;
    }
    // Work on a copy so the cached source stays pristine for the next render.
    const frame = ctx.createImageData(original.width, original.height);
    frame.data.set(original.data);
    const params = currentParams();
    if (!showOriginal) applyFilters(frame.data, frame.width, frame.height, params);
    ctx.putImageData(frame, 0, 0);

    const size = previewDimensions(bitmap.width, bitmap.height);
    const scaleNote = size.scale < 1 ? ` · preview at ${Math.round(size.scale * 100)}% scale` : '';
    announce(
      showOriginal
        ? `Showing the original image${scaleNote}`
        : `Filtered · ${describeParams(params)}${scaleNote}`,
    );
  }

  /** Coalesce rapid `input` events (a slider drag) into one render per frame. */
  function scheduleRender(): void {
    if (rafId) return;
    const run = () => {
      rafId = 0;
      renderPreview();
    };
    if (typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(run);
    else run();
  }

  function setShowOriginal(next: boolean): void {
    if (showOriginal === next) return;
    showOriginal = next;
    placeCompareButton();
    renderPreview();
  }

  /** Draw the source bitmap at preview scale and cache its unfiltered pixels. */
  function drawSource(): void {
    if (!bitmap) return;
    const size = previewDimensions(bitmap.width, bitmap.height);
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      announce('This browser cannot draw a 2D canvas, so the preview is unavailable.');
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    original = ctx.getImageData(0, 0, canvas.width, canvas.height);
    previewWrap.hidden = false;
    renderPreview();
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
    syncRunState();
  }

  async function setFile(next: File | null): Promise<void> {
    const generation = ++loadGeneration;
    revokeResultUrls();
    file = next;
    clearError(errorBox);
    resultWrap.hidden = true;
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    setShowOriginal(false);
    renderList();
    if (!file) {
      clearPreview('Choose an image to see it here.');
      return;
    }
    announce('Loading the image…');
    let decoded: ImageBitmap;
    try {
      decoded = await decodeForPreview(file);
      assertCanvasBudget(decoded.width, decoded.height, 'source image');
    } catch (error) {
      if (generation !== loadGeneration) return;
      clearPreview('That image could not be opened.');
      showError(
        errorBox,
        error instanceof Error ? error.message : 'That image could not be opened.',
        'Choose a PNG, JPEG or WebP image.',
      );
      return;
    }
    if (generation !== loadGeneration) {
      decoded.close();
      return;
    }
    releaseBitmap();
    bitmap = decoded;
    syncRunState();
    drawSource();
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
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button) return;
    void setFile(null);
  });

  /* ---------------------------------------------------------------------- */
  /*  Options                                                                */
  /* ---------------------------------------------------------------------- */

  /** Fill the controls from an option bag (presets / reset) and re-render. */
  function applyValues(values: OptionValues): void {
    for (const [key, value] of Object.entries(values)) {
      const field = optionsRoot.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(`[data-opt-key="${key}"]`);
      if (!field) continue;
      if (field.dataset.optType === 'boolean') {
        (field as HTMLInputElement).checked = value === true || value === 'true';
      } else {
        field.value = String(value);
      }
      const out = optionsRoot.querySelector<HTMLOutputElement>(`[data-range-out="${key}"]`);
      if (out) out.value = String(value);
    }
    applyShowWhen(optionsRoot);
    renderPreview();
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-example]')) {
    button.addEventListener('click', () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(button.dataset.exampleOptions ?? '{}');
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;
      // Start from the neutral defaults so a preset never inherits a stray slider.
      applyValues({ ...defaultValues, ...(parsed as OptionValues) });
    });
  }

  optionsRoot.addEventListener('input', () => {
    applyShowWhen(optionsRoot);
    scheduleRender();
  });
  optionsRoot.addEventListener('change', () => {
    applyShowWhen(optionsRoot);
    scheduleRender();
  });

  compareBtn.addEventListener('click', () => setShowOriginal(!showOriginal));
  resetFiltersBtn.addEventListener('click', () => {
    setShowOriginal(false);
    applyValues(defaultValues);
    announce(`Filters reset · ${describeParams(currentParams())}`);
  });

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                    */
  /* ---------------------------------------------------------------------- */

  function renderOutputs(result: FileRunResult): void {
    resultWrap.hidden = false;
    outputsEl.innerHTML = '';
    for (const output of result.outputs) {
      const li = document.createElement('li');
      li.className = 'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2';
      const preview = document.createElement('img');
      const url = URL.createObjectURL(output.blob);
      resultUrls.add(url);
      preview.src = url;
      preview.alt = `Preview of ${output.filename}`;
      preview.className = 'max-h-64 w-auto rounded border';
      const name = document.createElement('span');
      name.className = 'min-w-0 flex-1 truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'btn btn-subtle btn-sm shrink-0';
      download.textContent = 'Save';
      download.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      li.append(preview, name, download);
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
    if (!file) return;
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
    revokeResultUrls();

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        { files: [file], options: readOptions(optionsRoot) },
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
      if (err.name === 'AbortError') progressMsg.textContent = 'Cancelled';
      else showError(errorBox, err.message || 'Applying the filters failed', err.hint);
    } finally {
      if (generation === runGeneration) {
        runBtn.disabled = !file;
        cancelBtn.hidden = true;
        controller = null;
      }
    }
  }

  // Exposing `run` keeps the button's handler testable and idempotent.
  runBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => controller?.abort());

  resetBtn.addEventListener('click', () => {
    runGeneration += 1;
    loadGeneration += 1;
    controller?.abort();
    controller = null;
    void setFile(null);
    progressWrap.hidden = true;
    progressMsg.textContent = '';
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    resultWrap.hidden = true;
    clearError(errorBox);
    applyValues(defaultValues);
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      loadGeneration += 1;
      if (rafId) cancelAnimationFrame(rafId);
      revokeResultUrls();
      releaseBitmap();
      dz.destroy();
    },
    { once: true },
  );

  placeCompareButton();
  syncRunState();
  applyShowWhen(optionsRoot);
  clearPreview('Choose an image to see it here.');
}
