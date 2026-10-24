/**
 * The Image Collage panel.
 *
 * Owns the flow: choose several photos, arrange them on a grid, drag the order
 * around, and export. The pure geometry — cell rectangles, the letterbox fit
 * inside a cell and the placement order — lives in
 * `@/tools/image/image-collage.core`, which the Web Worker uses verbatim, so
 * the live preview and the saved file come from one renderer. Only the scale
 * differs: the preview draws downscaled copies to stay responsive, while the
 * export renders at full resolution.
 *
 * Nothing here talks to the network: the photos, the preview and the export all
 * stay on this device.
 */
import type { FileRunResult, OptionValues } from '@/lib/types';
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
} from '@/components/workbench/shared';
import { assertCanvasBudget } from '@/tools/image/image-batch';
import {
  collageCanvas,
  drawCell,
  fitRect,
  gridCells,
  moveItem,
  previewCanvas,
  readCollageOptions,
  type CellRect,
} from '@/tools/image/image-collage.core';

/** Longest edge, in px, of a decoded preview copy. Keeps big photos cheap. */
const PREVIEW_EDGE = 1600;
/** Largest preview canvas, in pixels, the panel will draw. */
const MAX_PREVIEW_PIXELS = 2_000_000;

/** One chosen photo, in display order. */
interface Slide {
  /** Stable id used to track the row and the drag. */
  id: number;
  /** Index of the source file in `files`. */
  source: number;
  file: File;
  bitmap: ImageBitmap;
}

/* -------------------------------------------------------------------------- */
/*  Decoding                                                                   */
/* -------------------------------------------------------------------------- */

/** Decode a file, honouring EXIF orientation (the same path the worker takes). */
async function decodePreview(file: File): Promise<ImageBitmap> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  return shrink(bitmap);
}

/** Downscale a decoded bitmap to {@link PREVIEW_EDGE}; a no-op when it fits. */
async function shrink(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const edge = Math.max(bitmap.width, bitmap.height);
  if (edge <= PREVIEW_EDGE || typeof OffscreenCanvas === 'undefined') return bitmap;
  try {
    const scale = PREVIEW_EDGE / edge;
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) return bitmap;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const small = await createImageBitmap(canvas);
    bitmap.close();
    return small;
  } catch {
    return bitmap;
  }
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                      */
/* -------------------------------------------------------------------------- */

/** Mount the collage panel into a `[data-image-collage-panel]` element. */
export function mountImageCollagePanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'image-collage';
  const accept = root.dataset.accept || undefined;
  const dropEl = root.querySelector<HTMLElement>('[data-drop]');
  const orderEl = root.querySelector<HTMLUListElement>('[data-order]');
  const orderStatus = root.querySelector<HTMLElement>('[data-order-status]');
  const resetOrderBtn = root.querySelector<HTMLButtonElement>('[data-reset-order]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-preview-canvas]');
  const previewStatus = root.querySelector<HTMLElement>('[data-preview-status]');
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]');
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]');
  const errorBox = root.querySelector<HTMLElement>('[data-error]');
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]');
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]');
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]');
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]');
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]');
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]');

  // Astro always renders these; the guard keeps a markup change from crashing.
  if (
    !dropEl ||
    !orderEl ||
    !orderStatus ||
    !resetOrderBtn ||
    !canvas ||
    !previewStatus ||
    !runBtn ||
    !cancelBtn ||
    !resetBtn ||
    !errorBox ||
    !progressWrap ||
    !progressBar ||
    !progressMsg ||
    !resultWrap ||
    !outputsEl ||
    !notesEl
  ) {
    return;
  }

  const optionsRoot = root;
  bindRangeOutputs(optionsRoot);

  /** The files as chosen (the export payload), keyed by {@link Slide.source}. */
  let files: File[] = [];
  /** The photos in display order — reordering moves these, never the pixels. */
  let slides: Slide[] = [];
  let nextId = 1;
  let dragId: number | null = null;
  let controller: AbortController | null = null;
  /** Bumped on every run / load / reset so a late reply cannot publish stale state. */
  let runGeneration = 0;
  let loadGeneration = 0;
  /** The preview cell rectangles, for hit-testing a drag. */
  let previewCells: CellRect[] = [];
  const resultUrls = new Set<string>();

  const announce = (message: string) => {
    previewStatus.textContent = message;
  };

  function syncRunState(): void {
    const ready = slides.length > 0;
    runBtn!.disabled = !ready;
    resetBtn!.hidden = !ready;
    resetOrderBtn!.disabled = slides.length < 2;
  }

  function releaseBitmaps(): void {
    for (const slide of slides) slide.bitmap.close();
  }

  function revokeResultUrls(): void {
    for (const url of resultUrls) URL.revokeObjectURL(url);
    resultUrls.clear();
  }

  /* ---------------------------------------------------------------------- */
  /*  Preview                                                                */
  /* ---------------------------------------------------------------------- */

  function clearPreview(message: string): void {
    previewCells = [];
    canvas!.width = 16;
    canvas!.height = 9;
    const ctx = canvas!.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx.fillStyle = 'rgba(127, 127, 127, 0.06)';
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);
    }
    announce(message);
  }

  /**
   * Redraw the composite preview. The cells and the drawing come from the same
   * core functions the worker uses, so the preview matches the export; only the
   * resolution differs (the preview is capped and its gaps are scaled).
   */
  function renderPreview(): void {
    const count = slides.length;
    if (!count) {
      clearPreview('Choose photos to see the collage here.');
      return;
    }
    const ctx = canvas!.getContext('2d');
    if (!ctx) {
      announce('This browser cannot draw a 2D canvas, so the preview is unavailable.');
      return;
    }
    let options;
    try {
      options = readCollageOptions(readOptions(optionsRoot), count);
    } catch (error) {
      previewCells = [];
      announce(
        error instanceof ToolError ? error.message : 'Check the colour options to see a preview.',
      );
      return;
    }
    const cellSize = slides.reduce(
      (max, slide) => Math.max(max, slide.bitmap.width, slide.bitmap.height),
      0,
    );
    const size = collageCanvas(count, options.columns, options.spacing, cellSize);
    const preview = previewCanvas(size.width, size.height, MAX_PREVIEW_PIXELS);
    const scale = preview.scale;
    if (canvas!.width !== preview.width || canvas!.height !== preview.height) {
      canvas!.width = preview.width;
      canvas!.height = preview.height;
    }
    const gap = Math.max(0, Math.round(options.spacing * scale));
    const { cells } = gridCells(count, options.columns, gap, preview.width, preview.height);
    previewCells = cells;

    ctx.clearRect(0, 0, preview.width, preview.height);
    if (options.background !== 'transparent') {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, preview.width, preview.height);
    }
    slides.forEach((slide, index) => {
      const cell = cells[index]!;
      drawCell(ctx, slide.bitmap, cell, fitRect(cell, slide.bitmap.width, slide.bitmap.height), {
        radius: Math.max(0, Math.round(options.radius * scale)),
        border: options.border,
        borderColor: options.borderColor,
        borderWidth: Math.max(1, Math.round(options.borderWidth * scale)),
      });
    });

    const rows = Math.ceil(count / options.columns);
    const note = scale < 1 ? ` · preview at ${Math.round(scale * 100)}%` : '';
    announce(
      `${count} image${count === 1 ? '' : 's'} · ${options.columns} × ${rows} grid · ${Math.round(options.spacing)} px gap${note}`,
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Order list                                                             */
  /* ---------------------------------------------------------------------- */

  function renderOrder(): void {
    orderEl!.innerHTML = '';
    slides.forEach((slide, index) => {
      const label = escapeHtml(slide.file.name);
      const item = document.createElement('li');
      item.className = 'flex items-center gap-2 rounded-lg border px-2 py-1.5';
      item.dataset.slideId = String(slide.id);
      item.draggable = true;
      item.setAttribute('aria-label', `${label}, position ${index + 1} of ${slides.length}`);

      const position = document.createElement('span');
      position.className = 'w-5 shrink-0 text-center text-xs tabular-nums text-[rgb(var(--text-muted))]';
      position.textContent = String(index + 1);

      const name = document.createElement('span');
      name.className = 'min-w-0 flex-1 truncate text-sm';
      name.textContent = slide.file.name;

      const size = document.createElement('span');
      size.className = 'shrink-0 text-xs tabular-nums text-[rgb(var(--text-muted))]';
      size.textContent = formatBytes(slide.file.size);

      const makeButton = (glyph: string, action: string, text: string, disabled: boolean) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-subtle btn-sm shrink-0';
        button.textContent = glyph;
        button.dataset.action = action;
        button.setAttribute('aria-label', text);
        button.disabled = disabled;
        return button;
      };

      item.append(
        position,
        name,
        size,
        makeButton('◀', 'move-left', `Move ${label} earlier`, index === 0),
        makeButton('▶', 'move-right', `Move ${label} later`, index === slides.length - 1),
        makeButton('✕', 'remove', `Remove ${label}`, false),
      );
      orderEl!.append(item);
    });
    resetOrderBtn!.disabled = slides.length < 2;
  }

  /** Re-render the order list and the preview together. */
  function refresh(): void {
    renderOrder();
    renderPreview();
    syncRunState();
  }

  /** Move the photo at `from` to position `to`, then announce it. */
  function reorder(from: number, to: number): void {
    const clamped = Math.max(0, Math.min(slides.length - 1, to));
    if (from === clamped || from < 0 || from >= slides.length) return;
    const slide = slides[from]!;
    slides = moveItem(slides, from, clamped);
    refresh();
    orderStatus!.textContent = `${slide.file.name} moved to position ${clamped + 1} of ${slides.length}.`;
  }

  /** Run a row action (move earlier / later / remove). */
  function runAction(id: number, action: string): void {
    const index = slides.findIndex((slide) => slide.id === id);
    if (index < 0) return;
    if (action === 'move-left') reorder(index, index - 1);
    else if (action === 'move-right') reorder(index, index + 1);
    else if (action === 'remove') void removeSlide(id);
  }

  /**
   * Drop one photo and renumber `files` so the placement order stays a full
   * permutation of the remaining sources. Only the removed bitmap is freed —
   * every other photo keeps its decoded pixels, so nothing is re-encoded.
   */
  async function removeSlide(id: number): Promise<void> {
    const slide = slides.find((entry) => entry.id === id);
    if (!slide) return;
    const kept = slides.filter((entry) => entry.id !== id);
    const sources = kept.map((entry) => entry.source).sort((a, b) => a - b);
    const remap = new Map(sources.map((source, index) => [source, index]));
    files = sources.map((source) => files[source]!);
    for (const entry of kept) entry.source = remap.get(entry.source)!;
    slides = kept;
    slide.bitmap.close();
    if (!slides.length) {
      resultWrap!.hidden = true;
      outputsEl!.innerHTML = '';
      notesEl!.innerHTML = '';
    }
    clearError(errorBox!);
    refresh();
  }

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                         */
  /* ---------------------------------------------------------------------- */

  async function addFiles(selected: File[]): Promise<void> {
    if (!selected.length) return;
    const limit = validateFileSelection([...files, ...selected]);
    if (limit) {
      showError(errorBox!, limit);
      return;
    }
    const generation = ++loadGeneration;
    clearError(errorBox!);
    announce(selected.length === 1 ? 'Loading the photo…' : `Loading ${selected.length} photos…`);

    const additions: Slide[] = [];
    for (const file of selected) {
      try {
        const bitmap = await decodePreview(file);
        assertCanvasBudget(bitmap.width, bitmap.height, `image “${file.name}”`);
        additions.push({ id: nextId++, source: files.length + additions.length, file, bitmap });
      } catch (error) {
        if (generation !== loadGeneration) return;
        showError(
          errorBox!,
          error instanceof ToolError ? error.message : `“${file.name}” could not be opened.`,
          error instanceof ToolError ? error.hint : 'Choose a PNG, JPEG or WebP image.',
        );
      }
    }
    if (generation !== loadGeneration) {
      additions.forEach((slide) => slide.bitmap.close());
      return;
    }
    files = [...files, ...selected];
    slides = [...slides, ...additions];
    refresh();
  }

  const dz = createDropZone(dropEl, {
    accept,
    multiple: true,
    onFiles: (selected) => void addFiles(selected),
  });

  orderEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-slide-id]');
    if (!button || !row) return;
    runAction(Number(row.dataset.slideId), button.dataset.action ?? '');
  });

  orderEl.addEventListener('keydown', (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-slide-id]');
    if (!row) return;
    const index = slides.findIndex((slide) => slide.id === Number(row.dataset.slideId));
    if (index < 0) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      reorder(index, index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      reorder(index, index + 1);
    }
  });

  /* --- drag and drop ---------------------------------------------------- */

  orderEl.addEventListener('dragstart', (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-slide-id]');
    if (!row) return;
    dragId = Number(row.dataset.slideId);
    const transfer = (event as DragEvent).dataTransfer;
    if (transfer) {
      transfer.effectAllowed = 'move';
      transfer.setData('text/plain', String(dragId));
    }
  });

  orderEl.addEventListener('dragend', () => {
    dragId = null;
  });

  orderEl.addEventListener('dragover', (event) => {
    if (dragId === null) return;
    event.preventDefault();
    const transfer = (event as DragEvent).dataTransfer;
    if (transfer) transfer.dropEffect = 'move';
  });

  orderEl.addEventListener('drop', (event) => {
    if (dragId === null) return;
    event.preventDefault();
    const from = slides.findIndex((slide) => slide.id === dragId);
    if (from < 0) return;
    const target = dropIndex((event as DragEvent).clientX, (event as DragEvent).clientY);
    dragId = null;
    reorder(from, target > from ? target - 1 : target);
  });

  /** Where a dropped row lands, from the pointer position. */
  function dropIndex(clientX: number, clientY: number): number {
    const rows = Array.from(orderEl!.querySelectorAll<HTMLElement>('[data-slide-id]'));
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i]!.getBoundingClientRect();
      if (clientY < rect.bottom) {
        return clientX < rect.left + rect.width / 2 ? i : i + 1;
      }
    }
    return rows.length;
  }

  /* ---------------------------------------------------------------------- */
  /*  Options                                                                */
  /* ---------------------------------------------------------------------- */

  /** Fill the controls from an option bag (examples) without touching markup. */
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
      const parsed: unknown = JSON.parse(button.dataset.exampleOptions ?? '{}');
      if (!parsed || typeof parsed !== 'object') return;
      applyValues(parsed as OptionValues);
    });
  }

  optionsRoot.addEventListener('input', () => {
    applyShowWhen(optionsRoot);
    renderPreview();
  });
  optionsRoot.addEventListener('change', () => {
    applyShowWhen(optionsRoot);
    renderPreview();
  });

  resetOrderBtn.addEventListener('click', () => {
    if (slides.length < 2) return;
    slides = [...slides].sort((a, b) => a.source - b.source);
    refresh();
    orderStatus!.textContent = 'The original order was restored.';
  });

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                    */
  /* ---------------------------------------------------------------------- */

  function renderOutputs(result: FileRunResult): void {
    resultWrap!.hidden = false;
    outputsEl!.innerHTML = '';
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
      outputsEl!.append(li);
    }
    notesEl!.innerHTML = '';
    for (const warning of result.warnings ?? []) {
      const li = document.createElement('li');
      li.style.color = 'rgb(var(--warning))';
      li.textContent = `⚠ ${warning}`;
      notesEl!.append(li);
    }
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesEl!.append(li);
    }
  }

  async function run(): Promise<void> {
    if (!slides.length) return;
    const limit = validateFileSelection(files);
    if (limit) {
      showError(errorBox!, limit);
      return;
    }
    controller?.abort();
    const generation = ++runGeneration;
    controller = new AbortController();
    clearError(errorBox!);
    runBtn!.disabled = true;
    cancelBtn!.hidden = false;
    progressWrap!.hidden = false;
    progressBar!.style.width = '0%';
    progressMsg!.textContent = 'Working…';
    resultWrap!.hidden = true;
    revokeResultUrls();

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        {
          files,
          // The order travels as a permutation of the source indices, so a
          // reorder only ever changes where a photo is placed.
          options: { ...readOptions(optionsRoot), order: slides.map((s) => s.source).join(',') },
        },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => {
            if (generation !== runGeneration) return;
            const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
            progressBar!.style.width = `${percent}%`;
            progressMsg!.textContent = message ? `${message} — ${percent}%` : `${percent}%`;
          },
        },
      );
      if (generation !== runGeneration) return;
      progressBar!.style.width = '100%';
      progressMsg!.textContent = 'Done';
      renderOutputs(result);
    } catch (error) {
      if (generation !== runGeneration) return;
      const err = error as Error & { hint?: string };
      if (err.name === 'AbortError') progressMsg!.textContent = 'Cancelled';
      else showError(errorBox!, err.message || 'Building the collage failed', err.hint);
    } finally {
      if (generation === runGeneration) {
        runBtn!.disabled = false;
        cancelBtn!.hidden = true;
        controller = null;
      }
    }
  }

  runBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => controller?.abort());

  resetBtn.addEventListener('click', () => {
    runGeneration += 1;
    loadGeneration += 1;
    controller?.abort();
    controller = null;
    revokeResultUrls();
    releaseBitmaps();
    files = [];
    slides = [];
    nextId = 1;
    progressWrap!.hidden = true;
    progressMsg!.textContent = '';
    outputsEl!.innerHTML = '';
    notesEl!.innerHTML = '';
    resultWrap!.hidden = true;
    clearError(errorBox!);
    orderStatus!.textContent = '';
    refresh();
    applyShowWhen(optionsRoot);
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      loadGeneration += 1;
      revokeResultUrls();
      releaseBitmaps();
      dz.destroy();
    },
    { once: true },
  );

  syncRunState();
  applyShowWhen(optionsRoot);
  clearPreview('Choose photos to see the collage here.');
}