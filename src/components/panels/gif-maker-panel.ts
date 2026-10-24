/**
 * The "GIF Maker" panel.
 *
 * The generic workbench cannot express a reorderable, per-frame animation
 * timeline, so this tool opts into a panel (`meta.panel = 'gif-maker'`). The
 * panel owns the DOM: choose a set of images, order and trim them on a
 * thumbnail grid, give each frame its own delay, pick the output size, size
 * limit, loop count and palette quality, then preview the finished animation
 * before it is encoded in the tool worker.
 *
 * Every piece of maths worth testing — the frame ordering operations, the
 * delay normalisation to GIF centiseconds, the size-limit downscaling and the
 * total-duration display — lives in the pure section at the top of this file,
 * so the panel and the tool share exactly one source of truth. The tool worker
 * imports the delay and size helpers from here.
 *
 * Nothing here talks to the network: the images, the preview and the encoded
 * GIF all stay on this device.
 */
import type { FileRunResult } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes, formatDuration } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  applyShowWhen,
  bindRangeOutputs,
  clearError,
  readOptions,
  showError,
} from '@/components/workbench/shared';
import { assertCanvasBudget } from '@/tools/image/image-batch';
import { estimateGifBytes } from '@/tools/video/gif';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/** Delay below this (in centiseconds) a GIF frame would be skipped by most players. */
export const MIN_DELAY_CS = 1;
/** Longest per-frame delay we allow, in centiseconds (10 seconds). */
export const MAX_DELAY_CS = 1000;
/** Slowest useful uniform frame rate, in frames per second. */
export const GIF_MIN_FPS = 1;
/** Fastest uniform frame rate we offer — beyond this a GIF is pointless and huge. */
export const GIF_MAX_FPS = 30;
/** Narrowest output width we allow, in pixels. */
export const MIN_OUTPUT_WIDTH = 16;
/** Default output width when nothing else is chosen. */
export const DEFAULT_OUTPUT_WIDTH = 480;
/** Smallest size limit, in bytes (256 KB). */
export const MIN_SIZE_LIMIT_BYTES = 256 * 1024;
/** Largest size limit, in bytes (16 MB — the shared GIF ceiling). */
export const MAX_SIZE_LIMIT_BYTES = 16 * 1024 * 1024;
/** Default size limit, in bytes (4 MB). */
export const DEFAULT_SIZE_LIMIT_BYTES = 4 * 1024 * 1024;
/** How many frames a thumbnail preview is allowed before it is skipped. */
export const MAX_PREVIEW_FRAMES = 300;
/** The preview canvas is never wider than this, in CSS pixels. */
const PREVIEW_MAX_W = 640;

/* -------------------------------------------------------------------------- */
/*  Frame ordering                                                            */
/* -------------------------------------------------------------------------- */

/** One frame on the timeline: a chosen image plus its own delay. */
export interface GifFrameEntry {
  /** Stable id — survives reordering and deletion. */
  id: number;
  file: File;
  /** Per-frame delay in GIF centiseconds (1 cs = 10 ms). */
  delayCs: number;
}

/**
 * Move the frame at `from` to `to`. Out-of-range moves are ignored; a move to
 * the same spot is a no-op.
 */
export function moveFrame(frames: GifFrameEntry[], from: number, to: number): GifFrameEntry[] {
  if (from < 0 || from >= frames.length) return frames;
  const target = Math.max(0, Math.min(frames.length - 1, to));
  if (target === from) return frames;
  const next = frames.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  return next;
}

/** Drop the frame at `index`. Out-of-range indices are ignored. */
export function removeFrame(frames: GifFrameEntry[], index: number): GifFrameEntry[] {
  if (index < 0 || index >= frames.length) return frames;
  const next = frames.slice();
  next.splice(index, 1);
  return next;
}

/** "frame 3 of 5" — the label used for a timeline row. */
export function describeFrame(entry: GifFrameEntry, index: number, total: number): string {
  return `frame ${index + 1} of ${total}`;
}

/**
 * "1, 2, 1, 3" — the current order as frame positions, for the live region.
 * The numbers are the position of each entry in the ORIGINAL upload order.
 */
export function describeOrder(frames: GifFrameEntry[], original: GifFrameEntry[]): string {
  if (!frames.length) return 'no frames';
  const byId = new Map(original.map((entry, i) => [entry.id, i + 1]));
  return frames.map((entry) => String(byId.get(entry.id) ?? '?')).join(', ');
}

/* -------------------------------------------------------------------------- */
/*  Delay normalisation                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Convert a frame rate to the GIF delay in centiseconds.
 *
 * A GIF stores each frame delay as hundredths of a second, so a rate that is
 * not a whole-number divisor of 100 cannot be represented exactly: 30 fps is
 * 33.3 ms per frame, which rounds to 3 cs (30 ms) and therefore plays back at
 * 33.3 fps. That is the caveat — the effective rate is always a divisor of
 * 100 fps (3 cs → 33.3 fps, 4 cs → 25 fps).
 */
export function fpsToCentiseconds(fps: number): number {
  const rate = Number.isFinite(fps) ? Math.max(GIF_MIN_FPS, Math.min(GIF_MAX_FPS, fps)) : 10;
  return Math.max(MIN_DELAY_CS, Math.round(1000 / rate / 10));
}

/** The effective frame rate a centisecond delay plays back at (3 cs → 33.3 fps). */
export function centisecondsToFps(cs: number): number {
  const delay = Math.max(MIN_DELAY_CS, cs);
  return Math.round((1000 / (delay * 10)) * 100) / 100;
}

/** Normalise a raw per-frame delay (in cs) into the legal range. */
export function normalizeDelayCs(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(MIN_DELAY_CS, Math.min(MAX_DELAY_CS, n)));
}

/* -------------------------------------------------------------------------- */
/*  Size limit maths                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Scale `width` × `height` down (preserving aspect ratio) so the larger side
 * is at most `maxSide`. A frame already at or under the limit is unchanged.
 */
export function fitToMaxSide(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const side = Math.max(1, Math.round(maxSide));
  if (w <= side && h <= side) return { width: w, height: h };
  const scale = side / Math.max(w, h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/**
 * The output size for a GIF of `frameCount` frames: start from the source
 * aspect ratio at `targetWidth`, then shrink (never grow) until the estimated
 * bytes fit under `limitBytes`. `limitBytes` of 0 means "no limit". Returns
 * the chosen size and the estimated size of the GIF that size would produce.
 */
export function sizeForLimit(
  frameCount: number,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  colors: number,
  limitBytes: number,
): { width: number; height: number; estimated: number } {
  const count = Math.max(1, frameCount);
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0) {
    return { width: 0, height: 0, estimated: 0 };
  }
  const aspect = sourceWidth / sourceHeight;
  let width = Math.max(1, Math.round(targetWidth));
  let height = Math.max(1, Math.round(width / aspect));

  const floor = limitBytes > 0 ? MIN_OUTPUT_WIDTH : 0;
  while (
    limitBytes > 0 &&
    width > floor &&
    estimateGifBytes(count, width, height, colors) > limitBytes
  ) {
    width = Math.max(floor, Math.round(width / 2));
    height = Math.max(1, Math.round(width / aspect));
  }
  return { width, height, estimated: estimateGifBytes(count, width, height, colors) };
}

/* -------------------------------------------------------------------------- */
/*  Duration display                                                          */
/* -------------------------------------------------------------------------- */

/** The total play time of one pass, in milliseconds. */
export function totalDurationMs(frames: GifFrameEntry[]): number {
  return frames.reduce((sum, entry) => sum + Math.max(MIN_DELAY_CS, entry.delayCs) * 10, 0);
}

/** "1.2 s" / "4.5 s" — the total-duration caption for the timeline. */
export function formatTotalDuration(frames: GifFrameEntry[]): string {
  return formatDuration(totalDurationMs(frames));
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

/** Decode a file into a thumbnail bitmap, honouring EXIF orientation. */
async function decodeForPreview(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

/** Mount the panel into a `[data-gif-maker-panel]` element. */
export function mountGifMakerPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'gif-maker';
  const accept = root.dataset.accept || undefined;
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
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const timelineStatusEl = root.querySelector<HTMLElement>('[data-timeline-status]')!;
  const resetOrderBtn = root.querySelector<HTMLButtonElement>('[data-reset-order]')!;
  const previewCanvas = root.querySelector<HTMLCanvasElement>('[data-preview-canvas]')!;
  const playBtn = root.querySelector<HTMLButtonElement>('[data-play]')!;
  const durationEl = root.querySelector<HTMLElement>('[data-duration]')!;
  const fpsInput = root.querySelector<HTMLInputElement>('[data-fps]')!;
  const optionsRoot = root;
  bindRangeOutputs(optionsRoot);

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
    !statusEl ||
    !timelineStatusEl ||
    !resetOrderBtn ||
    !previewCanvas ||
    !playBtn ||
    !durationEl ||
    !fpsInput
  ) {
    return;
  }

  /** The frames on the timeline, in the order the user arranged them. */
  let frames: GifFrameEntry[] = [];
  /** The original upload order, so "Reset order" can go back to it. */
  let originalFrames: GifFrameEntry[] = [];
  let nextId = 1;
  const thumbs = new Map<number, ImageBitmap>();
  let controller: AbortController | null = null;
  let runGeneration = 0;
  let previewTimer: number | null = null;
  let previewIndex = 0;
  let playing = false;
  const resultUrls = new Set<string>();

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  function updateRunState(): void {
    runBtn.disabled = frames.length < 1;
    resetBtn.hidden = !frames.length;
    resetOrderBtn.disabled = frames.length < 2;
    playBtn.disabled = frames.length < 2;
  }

  function releaseThumbs(): void {
    for (const bitmap of thumbs.values()) bitmap.close();
    thumbs.clear();
  }

  /* ---------------------------------------------------------------------- */
  /*  Timeline status + duration                                            */
  /* ---------------------------------------------------------------------- */

  function timelineSummary(): string {
    if (!frames.length) return 'Choose images to build an animation.';
    return `${frames.length} frame${frames.length === 1 ? '' : 's'} · ${formatTotalDuration(
      frames,
    )} · order ${describeOrder(frames, originalFrames)}`;
  }

  function updateDuration(): void {
    durationEl.textContent = frames.length ? formatTotalDuration(frames) : '—';
  }

  function announceCurrent(message: string): void {
    timelineStatusEl.textContent = message;
  }

  /* ---------------------------------------------------------------------- */
  /*  Preview animation                                                     */
  /* ---------------------------------------------------------------------- */

  function drawPreviewFrame(): void {
    if (!frames.length) return;
    const entry = frames[previewIndex % frames.length]!;
    const bitmap = thumbs.get(entry.id);
    const ctx = previewCanvas.getContext('2d');
    if (!ctx || !bitmap) return;
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.drawImage(bitmap, 0, 0, previewCanvas.width, previewCanvas.height);
  }

  function scheduleNextFrame(): void {
    if (!playing || frames.length < 2) return;
    const entry = frames[previewIndex % frames.length]!;
    const delayMs = Math.max(MIN_DELAY_CS, entry.delayCs) * 10;
    previewTimer = window.setTimeout(() => {
      previewIndex = (previewIndex + 1) % frames.length;
      drawPreviewFrame();
      scheduleNextFrame();
    }, delayMs);
  }

  function stopPreview(): void {
    playing = false;
    if (previewTimer !== null) {
      window.clearTimeout(previewTimer);
      previewTimer = null;
    }
    playBtn.textContent = 'Play';
    playBtn.setAttribute('aria-pressed', 'false');
  }

  function startPreview(): void {
    if (frames.length < 2) return;
    playing = true;
    playBtn.textContent = 'Pause';
    playBtn.setAttribute('aria-pressed', 'true');
    previewIndex = 0;
    drawPreviewFrame();
    scheduleNextFrame();
  }

  /** Redraw the first frame and the duration caption after the order changes. */
  function refreshPreview(): void {
    stopPreview();
    updateDuration();
    const ctx = previewCanvas.getContext('2d');
    if (!frames.length) {
      previewIndex = 0;
      previewCanvas.width = 16;
      previewCanvas.height = 9;
      if (ctx) {
        ctx.clearRect(0, 0, 16, 9);
        ctx.fillStyle = 'rgba(127, 127, 127, 0.06)';
        ctx.fillRect(0, 0, 16, 9);
      }
      announceCurrent('Choose images to build an animation.');
      return;
    }
    previewIndex = Math.min(previewIndex, frames.length - 1);
    const bitmap = thumbs.get(frames[0]!.id);
    if (bitmap) {
      const scale = Math.min(1, PREVIEW_MAX_W / bitmap.width);
      previewCanvas.width = Math.max(1, Math.round(bitmap.width * scale));
      previewCanvas.height = Math.max(1, Math.round(bitmap.height * scale));
    }
    drawPreviewFrame();
    announceCurrent(timelineSummary());
  }

  /* ---------------------------------------------------------------------- */
  /*  Thumbnails                                                            */
  /* ---------------------------------------------------------------------- */

  async function ensureThumbnails(): Promise<void> {
    if (frames.length > MAX_PREVIEW_FRAMES) return;
    for (const entry of frames) {
      if (thumbs.has(entry.id)) continue;
      try {
        const bitmap = await decodeForPreview(entry.file);
        assertCanvasBudget(bitmap.width, bitmap.height, 'source image');
        thumbs.set(entry.id, bitmap);
      } catch {
        // A frame that cannot be decoded keeps its placeholder; the worker
        // reports the real error when the GIF is built.
      }
    }
  }

  function drawThumbs(): void {
    for (const entry of frames) {
      const item = gridEl.querySelector<HTMLElement>(`[data-frame-id="${entry.id}"]`);
      const canvas = item?.querySelector('canvas');
      const bitmap = thumbs.get(entry.id);
      if (!canvas || !bitmap) continue;
      const scale = Math.min(1, 160 / bitmap.width, 116 / bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Timeline grid                                                         */
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
    frames.forEach((entry, index) => {
      const total = frames.length;
      const label = describeFrame(entry, index, total);

      const item = document.createElement('li');
      item.className = 'flex flex-col gap-1.5 rounded-lg border p-2';
      item.dataset.frameId = String(entry.id);
      item.setAttribute('aria-label', label);

      const frame = document.createElement('div');
      frame.className =
        'flex h-[120px] w-full items-center justify-center overflow-hidden rounded-md border';
      frame.tabIndex = 0;
      frame.setAttribute('role', 'group');
      frame.dataset.frameFocus = String(entry.id);
      frame.setAttribute(
        'aria-label',
        `${label}. Use the left and right arrow keys to move it, or the buttons below.`,
      );
      frame.draggable = true;

      const canvas = document.createElement('canvas');
      canvas.className = 'block max-h-[116px] max-w-full';
      frame.append(canvas);
      item.append(frame);

      const caption = document.createElement('p');
      caption.className = 'truncate text-xs font-medium text-[rgb(var(--text))]';
      caption.textContent = `${index + 1}. ${entry.file.name}`;
      item.append(caption);

      // Per-frame delay, in GIF centiseconds (hundredths of a second).
      const delayWrap = document.createElement('label');
      delayWrap.className = 'flex items-center gap-1.5 text-xs text-[rgb(var(--text-muted))]';
      const delayText = document.createElement('span');
      delayText.textContent = 'Delay';
      const delayInput = document.createElement('input');
      delayInput.className = 'field !w-20';
      delayInput.type = 'number';
      delayInput.min = String(MIN_DELAY_CS);
      delayInput.max = String(MAX_DELAY_CS);
      delayInput.step = '1';
      delayInput.value = String(entry.delayCs);
      delayInput.dataset.frameDelay = String(entry.id);
      delayInput.setAttribute('aria-label', `Delay of ${label} in hundredths of a second`);
      const unit = document.createElement('span');
      unit.textContent = `cs · ${centisecondsToFps(entry.delayCs)} fps`;
      delayWrap.append(delayText, delayInput, unit);
      item.append(delayWrap);

      const controls = document.createElement('div');
      controls.className = 'flex flex-wrap gap-1';
      controls.append(
        makeButton(`Move ${label} earlier`, '←', 'move-left', index === 0),
        makeButton(`Move ${label} later`, '→', 'move-right', index === total - 1),
        makeButton(`Remove ${label}`, '✕', 'delete', false),
      );
      item.append(controls);

      gridEl.append(item);
    });
    updateRunState();
  }

  /** Re-render the grid, draw the thumbnails and restart the idle preview. */
  async function refresh(): Promise<void> {
    renderGrid();
    await ensureThumbnails();
    drawThumbs();
    refreshPreview();
  }

  /** Move a frame and keep the keyboard focus on it. */
  function moveTo(index: number, target: number): void {
    const entry = frames[index];
    if (!entry) return;
    const clamped = Math.max(0, Math.min(frames.length - 1, target));
    if (clamped === index) {
      announceCurrent(`${describeFrame(entry, index, frames.length)} did not move.`);
      return;
    }
    frames = moveFrame(frames, index, clamped);
    announce(
      `${describeFrame(entry, clamped, frames.length)} moved to position ${clamped + 1} of ${frames.length}.`,
    );
    void refresh().then(() => focusFrame(entry.id));
  }

  function focusFrame(id: number): void {
    gridEl.querySelector<HTMLElement>(`[data-frame-focus="${id}"]`)?.focus();
  }

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                        */
  /* ---------------------------------------------------------------------- */

  function renderList(): void {
    if (!frames.length) {
      listEl.innerHTML = '';
    } else {
      const total = frames.reduce((sum, entry) => sum + entry.file.size, 0);
      listEl.innerHTML = `<li class="flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5">
          <span class="truncate">${frames.length} image${frames.length === 1 ? '' : 's'}</span>
          <span class="flex items-center gap-2 shrink-0 text-xs text-[rgb(var(--text-muted))]">
            ${formatBytes(total)}
            <button type="button" data-remove-all aria-label="Remove all images" class="hover:text-[rgb(var(--danger))]">✕</button>
          </span>
        </li>`;
    }
    resetBtn.hidden = !frames.length;
    updateRunState();
  }

  /** Replace the timeline with a new set of images, in upload order. */
  function setFiles(files: File[]): void {
    runGeneration += 1;
    stopPreview();
    releaseThumbs();
    const fallback = fpsToCentiseconds(Number(fpsInput.value) || 10);
    frames = files.map((file) => ({ id: nextId++, file, delayCs: fallback }));
    originalFrames = frames.slice();
    clearError(errorBox);
    resultWrap.hidden = true;
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    renderList();
    void refresh();
  }

  const dz = createDropZone(dropEl, {
    accept,
    multiple: true,
    onFiles: (files) => {
      const limit = validateFileSelection(files);
      if (limit) {
        showError(errorBox, limit);
        return;
      }
      const images = files.filter((file) => file.type.startsWith('image/'));
      if (!images.length) {
        showError(errorBox, 'Choose image files.', 'PNG, JPEG, WebP, GIF and BMP work best.');
        return;
      }
      setFiles(images);
    },
  });

  listEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-all]');
    if (!button) return;
    setFiles([]);
  });

  /* ---------------------------------------------------------------------- */
  /*  Grid interaction                                                      */
  /* ---------------------------------------------------------------------- */

  gridEl.addEventListener('input', (event) => {
    const input = event.target as HTMLElement;
    if (!(input instanceof HTMLInputElement) || input.dataset.frameDelay === undefined) return;
    const id = Number(input.dataset.frameDelay);
    const index = frames.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const next = normalizeDelayCs(input.value, frames[index]!.delayCs);
    if (next === frames[index]!.delayCs) return;
    frames = frames.slice();
    frames[index] = { ...frames[index]!, delayCs: next };
    input.value = String(next);
    const unit =
      input.parentElement?.querySelector<HTMLSpanElement>('span:last-of-type') ?? null;
    if (unit) unit.textContent = `cs · ${centisecondsToFps(next)} fps`;
    updateDuration();
    announceCurrent(timelineSummary());
  });

  gridEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!button) return;
    const item = button.closest<HTMLElement>('[data-frame-id]');
    const id = Number(item?.dataset.frameId);
    const index = frames.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const entry = frames[index]!;
    switch (button.dataset.action) {
      case 'move-left':
        moveTo(index, index - 1);
        break;
      case 'move-right':
        moveTo(index, index + 1);
        break;
      case 'delete': {
        releaseThumb(entry.id);
        frames = removeFrame(frames, index);
        announce(`${describeFrame(entry, index, frames.length + 1)} removed.`);
        void refresh();
        break;
      }
      default:
        break;
    }
  });

  function releaseThumb(id: number): void {
    const bitmap = thumbs.get(id);
    if (bitmap) {
      bitmap.close();
      thumbs.delete(id);
    }
  }

  gridEl.addEventListener('keydown', (event) => {
    const frame = (event.target as HTMLElement).closest<HTMLElement>('[data-frame-focus]');
    if (!frame) return;
    const id = Number(frame.dataset.frameFocus);
    const index = frames.findIndex((entry) => entry.id === id);
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
        moveTo(index, frames.length - 1);
        break;
      default:
        break;
    }
  });

  /* --- drag and drop ---------------------------------------------------- */

  let dragId: number | null = null;

  /** Where a dropped frame lands, from the pointer position. */
  function dropIndex(clientX: number, clientY: number): number {
    const items = Array.from(gridEl.querySelectorAll<HTMLElement>('[data-frame-id]'));
    for (let i = 0; i < items.length; i++) {
      const rect = items[i]!.getBoundingClientRect();
      if (clientY < rect.bottom) return clientX < rect.left + rect.width / 2 ? i : i + 1;
    }
    return items.length;
  }

  gridEl.addEventListener('dragstart', (event) => {
    const frame = (event.target as HTMLElement).closest<HTMLElement>('[data-frame-focus]');
    if (!frame) return;
    dragId = Number(frame.dataset.frameFocus);
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
    const from = frames.findIndex((entry) => entry.id === dragId);
    if (from < 0) return;
    const index = dropIndex((event as DragEvent).clientX, (event as DragEvent).clientY);
    const target = Math.max(0, Math.min(frames.length - 1, index > from ? index - 1 : index));
    dragId = null;
    moveTo(from, target);
  });

  /* ---------------------------------------------------------------------- */
  /*  Controls                                                              */
  /* ---------------------------------------------------------------------- */

  playBtn.addEventListener('click', () => {
    if (playing) stopPreview();
    else startPreview();
  });

  fpsInput.addEventListener('change', () => {
    const fps = Math.max(GIF_MIN_FPS, Math.min(GIF_MAX_FPS, Number(fpsInput.value) || 10));
    fpsInput.value = String(fps);
    const cs = fpsToCentiseconds(fps);
    frames = frames.map((entry) => ({ ...entry, delayCs: cs }));
    announce(
      `Every frame set to ${cs} cs — ${centisecondsToFps(cs)} fps. A GIF cannot store delays finer than 10 ms.`,
    );
    void refresh();
  });

  resetOrderBtn.addEventListener('click', () => {
    if (!originalFrames.length) return;
    frames = originalFrames.slice();
    announce('The original order was restored.');
    void refresh();
  });

  /* ---------------------------------------------------------------------- */
  /*  Options                                                               */
  /* ---------------------------------------------------------------------- */

  optionsRoot.addEventListener('input', () => applyShowWhen(optionsRoot));
  optionsRoot.addEventListener('change', () => applyShowWhen(optionsRoot));

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                   */
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
    if (!frames.length) return;
    const files = frames.map((entry) => entry.file);
    const limit = validateFileSelection(files);
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
    stopPreview();

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        {
          files,
          options: {
            ...readOptions(optionsRoot),
            delayCs: String(frames[0]!.delayCs),
            frameDelays: JSON.stringify(frames.map((entry) => entry.delayCs)),
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
      if (err.name === 'AbortError') progressMsg.textContent = 'Cancelled';
      else showError(errorBox, err.message || 'Building the GIF failed', err.hint);
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
    stopPreview();
    revokeResultUrls();
    setFiles([]);
    progressWrap.hidden = true;
    progressMsg.textContent = '';
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    resultWrap.hidden = true;
    clearError(errorBox);
    applyShowWhen(optionsRoot);
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      stopPreview();
      revokeResultUrls();
      releaseThumbs();
      dz.destroy();
    },
    { once: true },
  );

  /* ---------------------------------------------------------------------- */
  /*  Result URLs                                                           */
  /* ---------------------------------------------------------------------- */

  function revokeResultUrls(): void {
    for (const url of resultUrls) URL.revokeObjectURL(url);
    resultUrls.clear();
  }

  syncInitialState();
  applyShowWhen(optionsRoot);
  renderList();
  refreshPreview();

  function syncInitialState(): void {
    fpsInput.value = fpsInput.dataset.defaultValue ?? String(GIF_MAX_FPS / 3);
    announce('Choose two or more images to build an animation.');
  }
}