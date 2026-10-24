/**
 * The "Add Text to Image" panel.
 *
 * The generic workbench cannot express a draggable text block, so this tool
 * opts into a panel (`meta.panel`). The panel owns the DOM: choose an image,
 * write the caption, drag it into place on a live preview and export.
 *
 * Everything worth testing lives elsewhere: the layout maths and the drawing
 * routine are in `src/tools/image/image-add-text.core.ts` (the preview calls
 * them with the preview canvas, the worker with the real one), and the file is
 * produced by the tool's `run()` through `runToolById`, so the encode happens
 * off the main thread.
 *
 * Nothing here talks to the network: the image, the preview and the export all
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
import {
  clamp,
  dragToAnchor,
  drawCaption,
  planCaption,
  previewSize,
  readTextOptions,
  toPercent,
  type CaptionPlan,
  type MeasureFn,
  type Position,
} from '@/tools/image/image-add-text.core';
import { assertCanvasBudget } from '@/tools/image/image-batch';

/** Arrow-key step, as a percentage of the image, and the Shift multiple. */
const KEY_STEP = 1;
const KEY_STEP_LARGE = 10;

/** Placeholder canvas aspect ratio while no image is chosen. */
const PLACEHOLDER = { width: 16, height: 9 };

/** Round to two decimals, the precision the position inputs keep. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Measure text with the very font string the draw call will use. */
function canvasMeasure(ctx: CanvasRenderingContext2D): MeasureFn {
  return (text, fontPx, fontStack) => {
    ctx.font = `${fontPx}px ${fontStack}`;
    return ctx.measureText(text).width;
  };
}

/**
 * Decode a file into a bitmap for the preview, honouring EXIF orientation.
 *
 * This is the same path the worker takes (`image-batch.ts: decodeOriented`):
 * `HTMLImageElement.decode()` can stay pending forever in some Chromium
 * builds, so the preview must not depend on it.
 */
async function decodeForPreview(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

/** Mount the panel into a `[data-image-add-text-panel]` element. */
export function mountImageAddTextPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'image-add-text';
  const accept = root.dataset.accept || undefined;
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
  const canvas = root.querySelector<HTMLCanvasElement>('[data-preview-canvas]')!;
  const surface = root.querySelector<HTMLElement>('[data-drag-surface]')!;
  const boxEl = root.querySelector<HTMLElement>('[data-text-box]')!;
  const previewStatus = root.querySelector<HTMLElement>('[data-preview-status]')!;
  const positionReset = root.querySelector<HTMLButtonElement>('[data-position-reset]');
  const xInput = root.querySelector<HTMLInputElement>('[data-position="x"]')!;
  const yInput = root.querySelector<HTMLInputElement>('[data-position="y"]')!;
  // Every option control lives inside the panel (the position inputs sit next
  // to the preview), so the panel root is the options scope.
  const optionsRoot = root;
  bindRangeOutputs(optionsRoot);

  // Astro always renders these; the guard keeps a markup change from crashing.
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
    !canvas ||
    !surface ||
    !boxEl ||
    !previewStatus ||
    !xInput ||
    !yInput
  ) {
    return;
  }

  let file: File | null = null;
  let bitmap: ImageBitmap | null = null;
  /** The last successfully planned caption, in preview-canvas pixels. */
  let plan: CaptionPlan | null = null;
  let drag: { grab: Position } | null = null;
  let controller: AbortController | null = null;
  /** Bumped on every run / load / reset so a late reply cannot publish stale state. */
  let runGeneration = 0;
  let loadGeneration = 0;
  const resultUrls = new Set<string>();

  const announce = (message: string) => {
    previewStatus.textContent = message;
  };

  const positionValues = (): Position => ({
    x: round2(clamp(Number(xInput.value), 0, 100)),
    y: round2(clamp(Number(yInput.value), 0, 100)),
  });

  function syncRunState(): void {
    runBtn.disabled = !file;
    resetBtn.hidden = !file;
    if (positionReset) positionReset.disabled = !bitmap;
  }

  /** Free the decoded preview bitmap, if any. */
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

  function clearPreview(message: string): void {
    plan = null;
    boxEl.hidden = true;
    releaseBitmap();
    canvas.width = PLACEHOLDER.width;
    canvas.height = PLACEHOLDER.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // A neutral backdrop, so an empty box never looks like a black image.
      ctx.fillStyle = 'rgba(127, 127, 127, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    announce(message);
  }

  /** Put the block outline over the part of the canvas the text occupies. */
  function placeBox(next: CaptionPlan): void {
    boxEl.hidden = false;
    const width = canvas.width || 1;
    const height = canvas.height || 1;
    boxEl.style.left = `${(next.box.left / width) * 100}%`;
    boxEl.style.top = `${(next.box.top / height) * 100}%`;
    boxEl.style.width = `${(next.box.width / width) * 100}%`;
    boxEl.style.height = `${(next.box.height / height) * 100}%`;
  }

  /**
   * Redraw the preview. The plan and the drawing come from the same core
   * functions the worker uses, so the preview matches the exported file; only
   * the canvas resolution differs (large images are previewed scaled down).
   */
  function renderPreview(): void {
    if (!bitmap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      announce('This browser cannot draw a 2D canvas, so the preview is unavailable.');
      return;
    }
    const size = previewSize(bitmap.width, bitmap.height);
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const values = readOptions(optionsRoot);
    if (String(values.text ?? '').trim() === '') {
      plan = null;
      boxEl.hidden = true;
      announce('Type some text to see it on the image.');
      return;
    }
    try {
      const next = planCaption(
        canvasMeasure(ctx),
        readTextOptions(values),
        canvas.width,
        canvas.height,
      );
      drawCaption(ctx, next);
      plan = next;
      placeBox(next);
      const position = positionValues();
      const scaleNote = size.scale < 1 ? ` · preview at ${Math.round(size.scale * 100)}% scale` : '';
      announce(
        `${next.lines.length} line${next.lines.length === 1 ? '' : 's'} · ${Math.round(next.fontPx)} px font · ${position.x}% / ${position.y}%${scaleNote}`,
      );
    } catch (error) {
      plan = null;
      boxEl.hidden = true;
      announce(
        error instanceof ToolError
          ? error.message
          : 'The preview could not be drawn — check the options.',
      );
    }
  }

  /** Move the text from the position inputs (both drag and typing land here). */
  function setPosition(xPercent: number, yPercent: number): void {
    xInput.value = String(round2(clamp(xPercent, 0, 100)));
    yInput.value = String(round2(clamp(yPercent, 0, 100)));
    renderPreview();
  }

  /* ---------------------------------------------------------------------- */
  /*  Dragging                                                               */
  /* ---------------------------------------------------------------------- */

  /** Pointer event → canvas pixels (the preview can be scaled down). */
  function toCanvasPixels(event: PointerEvent): Position {
    const rect = canvas.getBoundingClientRect();
    const unitX = rect.width > 0 ? canvas.width / rect.width : 1;
    const unitY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * unitX,
      y: (event.clientY - rect.top) * unitY,
    };
  }

  function moveTo(pointer: Position, grab: Position): void {
    if (!plan) return;
    const anchor = dragToAnchor(
      pointer,
      grab,
      { width: plan.box.width, height: plan.box.height },
      plan.align,
      canvas.width,
      canvas.height,
    );
    const percent = toPercent(anchor, canvas.width, canvas.height);
    setPosition(percent.x, percent.y);
  }

  surface.addEventListener('pointerdown', (event) => {
    if (!plan || !bitmap) return;
    const pointer = toCanvasPixels(event);
    const insideX = pointer.x >= plan.box.left && pointer.x <= plan.box.left + plan.box.width;
    const insideY = pointer.y >= plan.box.top && pointer.y <= plan.box.top + plan.box.height;
    // Grabbing the block keeps it under the pointer; clicking elsewhere brings
    // the block to the pointer, centred, which makes tap-to-place work.
    drag =
      insideX && insideY
        ? { grab: { x: pointer.x - plan.box.left, y: pointer.y - plan.box.top } }
        : { grab: { x: plan.box.width / 2, y: plan.box.height / 2 } };
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // A stale pointer id throws here; dragging still works without capture.
    }
    // preventDefault() suppresses the compatibility mouse events, so focus the
    // surface explicitly to keep the arrow keys working after a drag.
    surface.focus();
    event.preventDefault();
    moveTo(pointer, drag.grab);
  });

  surface.addEventListener('pointermove', (event) => {
    if (!drag) return;
    moveTo(toCanvasPixels(event), drag.grab);
  });

  const endDrag = () => {
    drag = null;
  };
  surface.addEventListener('pointerup', endDrag);
  surface.addEventListener('pointercancel', endDrag);
  surface.addEventListener('lostpointercapture', endDrag);

  surface.addEventListener('keydown', (event) => {
    if (!bitmap) return;
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const stepX = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const stepY = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    if (stepX === 0 && stepY === 0) return;
    event.preventDefault();
    const current = positionValues();
    setPosition(current.x + stepX, current.y + stepY);
  });

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
        error instanceof ToolError ? error.message : 'That image could not be opened.',
        error instanceof ToolError ? error.hint : 'Choose a PNG, JPEG or WebP image.',
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
    renderPreview();
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

  positionReset?.addEventListener('click', () => {
    applyValues({ x: xInput.dataset.defaultValue ?? 50, y: yInput.dataset.defaultValue ?? 85 });
  });

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                    */
  /* ---------------------------------------------------------------------- */

  function renderOutputs(result: FileRunResult): void {
    resultWrap.hidden = false;
    outputsEl.innerHTML = '';
    for (const output of result.outputs) {
      const li = document.createElement('li');
      li.className =
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2';
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
    const limit = validateFileSelection([file]);
    if (limit) {
      showError(errorBox, limit);
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
      else showError(errorBox, err.message || 'Adding the text failed', err.hint);
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
    // Put the position back where it started, so the panel is clean again.
    applyValues({
      x: xInput.dataset.defaultValue ?? '50',
      y: yInput.dataset.defaultValue ?? '85',
    });
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      loadGeneration += 1;
      revokeResultUrls();
      releaseBitmap();
      dz.destroy();
    },
    { once: true },
  );

  syncRunState();
  applyShowWhen(optionsRoot);
  clearPreview('Choose an image to see it here.');
}
