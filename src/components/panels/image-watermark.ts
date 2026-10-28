/**
 * The watermark panel.
 *
 * Owns three steps: choose images, design the watermark, preview it live. The
 * preview and the saved files share one renderer — `image-watermark.core.ts` —
 * so the on-screen mark is the mark that gets written; only the scale differs.
 * Every full-resolution pixel goes through the tool in a Web Worker, so this
 * module never blocks the tab: it draws one small preview frame and rasterises
 * the chosen logo once.
 */
import type { FileRunResult, OptionValues } from '@/lib/types';
import { createDropZone, downloadBlob, readAsDataURL, validateFileSelection } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { clearError, showError } from '@/components/workbench/shared';
import {
  computeLayout,
  drawWatermark,
  fontSpec,
  resolveWatermarkSettings,
  textFontPx,
} from '@/tools/image/image-watermark.core';

/** Longest edge, in px, of the rasterised logo that is handed to the worker. */
const MAX_LOGO_EDGE = 1024;
/** Widest the live preview canvas may be, in CSS pixels. */
const MAX_PREVIEW_WIDTH = 720;
const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp';

/** Decode an image element from a same-origin URL (a data URL or blob URL). */
async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/**
 * Intrinsic box of an SVG file, preferring its `viewBox` (the vector
 * coordinate space) so a `width="24"` icon with a `viewBox="0 0 512 512"`
 * rasterises at 512px instead of being upscaled from 24px. Browsers otherwise
 * report a default 300×150 for an SVG that only declares a viewBox, which would
 * also get the aspect ratio wrong.
 */
function svgIntrinsicSize(markup: string): { width: number; height: number } | null {
  const root = /<svg\b([^>]*)>/i.exec(markup)?.[1];
  if (root === undefined) return null;
  const attribute = (name: string) => {
    const match = new RegExp(`\\b${name}\\s*=\\s*["']\\s*([\\d.]+)(?:px)?\\s*["']`, 'i').exec(root);
    return match ? Number(match[1]) : 0;
  };
  const viewBox = /\bviewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(
    root,
  );
  const width = Math.max(attribute('width'), viewBox ? Number(viewBox[1]) : 0);
  const height = Math.max(attribute('height'), viewBox ? Number(viewBox[2]) : 0);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Rasterise a picked logo to a PNG data URL on a canvas. Browsers cannot
 * `createImageBitmap` an SVG blob, and the worker has no DOM, so SVG logos are
 * turned into pixels here, before they reach the tool.
 */
function rasteriseLogo(
  image: HTMLImageElement,
  declared: { width: number; height: number } | null,
): string {
  const width = declared?.width ?? (image.naturalWidth || image.width);
  const height = declared?.height ?? (image.naturalHeight || image.height);
  if (!width || !height) throw new Error('The logo has no usable size.');
  const scale = Math.min(1, MAX_LOGO_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot open a 2D canvas.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function mountWatermarkPanel(root: HTMLElement): void {
  const pick = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const dropEl = pick<HTMLElement>('[data-drop]');
  const logoDropEl = pick<HTMLElement>('[data-logo-drop]');
  const listEl = pick<HTMLUListElement>('[data-file-list]');
  const runBtn = pick<HTMLButtonElement>('[data-run]');
  const cancelBtn = pick<HTMLButtonElement>('[data-cancel]');
  const resetBtn = pick<HTMLButtonElement>('[data-reset]');
  const errorBox = pick<HTMLElement>('[data-error]');
  const progressWrap = pick<HTMLElement>('[data-progress-wrap]');
  const progressBar = pick<HTMLElement>('[data-progress-bar]');
  const progressMsg = pick<HTMLElement>('[data-progress-msg]');
  const resultWrap = pick<HTMLElement>('[data-result-wrap]');
  const outputsEl = pick<HTMLUListElement>('[data-outputs]');
  const notesEl = pick<HTMLUListElement>('[data-notes]');
  const previewCanvas = pick<HTMLCanvasElement>('[data-preview-canvas]');
  const previewStatus = pick<HTMLElement>('[data-preview-status]');
  const logoStatus = pick<HTMLElement>('[data-logo-status]');

  if (
    !dropEl ||
    !logoDropEl ||
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
    !previewCanvas ||
    !previewStatus ||
    !logoStatus
  ) {
    return;
  }

  const toolId = root.dataset.toolId || 'image-watermark';

  let files: File[] = [];
  let previewImage: HTMLImageElement | null = null;
  let previewImageUrl: string | null = null;
  let imageLoadToken = 0;
  let logoName: string | null = null;
  /** PNG data URL handed to the tool, or null when no logo is chosen. */
  let logoData: string | null = null;
  /** The same logo as an element, for drawing the preview. */
  let logoImage: HTMLImageElement | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;
  let previewFrame = 0;
  const outputUrls = new Set<string>();

  /* ---------------------------------------------------------------------- */
  /*  Options                                                                */
  /* ---------------------------------------------------------------------- */

  const optionEl = (key: string) =>
    root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-opt="${key}"]`);

  function readValues(): OptionValues {
    const values: OptionValues = {};
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-opt]').forEach((el) => {
      const key = el.dataset.opt;
      if (!key) return;
      values[key] =
        el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
    });
    values.logo = logoData ?? '';
    return values;
  }

  function isReady(): boolean {
    if (files.length === 0) return false;
    const mode = (optionEl('mode') as HTMLSelectElement | null)?.value ?? 'text';
    if (mode === 'logo') return logoData !== null;
    return ((optionEl('text') as HTMLInputElement | null)?.value ?? '').trim().length > 0;
  }

  function syncRunState(): void {
    runBtn.disabled = !isReady();
    resetBtn.hidden = files.length === 0;
  }

  function syncOutputs(): void {
    root.querySelectorAll<HTMLOutputElement>('output[data-out]').forEach((out) => {
      const el = optionEl(out.dataset.out ?? '');
      if (el) out.textContent = el.value;
    });
  }

  function applyVisibility(): void {
    const values = readValues();
    root.querySelectorAll<HTMLElement>('[data-visible-when]').forEach((el) => {
      const [key, expected] = (el.dataset.visibleWhen ?? '').split(':');
      const actual = key === 'tiled' ? (values.tiled ? 'on' : 'off') : String(values[key!] ?? '');
      el.hidden = actual !== expected;
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  File list                                                              */
  /* ---------------------------------------------------------------------- */

  function renderList(): void {
    listEl.innerHTML = '';
    files.forEach((file) => {
      const item = document.createElement('li');
      item.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5';

      const name = document.createElement('span');
      name.className = 'truncate';
      name.textContent = file.name;

      const meta = document.createElement('span');
      meta.className = 'shrink-0 text-xs text-[rgb(var(--text-muted))]';
      meta.textContent = formatBytes(file.size);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'hover:text-[rgb(var(--danger))]';
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.textContent = '✕';
      remove.addEventListener('click', () => void removeFile(file));

      meta.append(remove);
      item.append(name, meta);
      listEl.append(item);
    });
    syncRunState();
  }

  async function loadPreviewImage(): Promise<void> {
    const token = ++imageLoadToken;
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
      previewImageUrl = null;
      previewImage = null;
    }
    const file = files[0];
    if (!file) {
      schedulePreview();
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (token !== imageLoadToken) {
        URL.revokeObjectURL(url);
        return;
      }
      previewImageUrl = url;
      previewImage = image;
    } catch {
      URL.revokeObjectURL(url);
      showError(errorBox, 'That image could not be opened for the preview.');
    }
    schedulePreview();
  }

  async function addFiles(chosen: File[]): Promise<void> {
    const images = chosen.filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) {
      showError(errorBox, 'Choose a PNG, JPEG or WebP image.');
      return;
    }
    const next = [...files];
    const seen = new Set(files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    for (const file of images) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (!seen.has(key)) {
        seen.add(key);
        next.push(file);
      }
    }
    const limit = validateFileSelection(next);
    if (limit) {
      showError(errorBox, limit);
      return;
    }
    files = next;
    clearError(errorBox);
    resultWrap.hidden = true;
    renderList();
    if (!previewImage) await loadPreviewImage();
    else schedulePreview();
  }

  async function removeFile(file: File): Promise<void> {
    files = files.filter((candidate) => candidate !== file);
    resultWrap.hidden = true;
    renderList();
    // The preview always follows the first file, so reload it unconditionally.
    await loadPreviewImage();
  }

  const imageDrop = createDropZone(dropEl, {
    accept: ACCEPTED_IMAGES,
    multiple: true,
    onFiles: (chosen) => void addFiles(chosen),
  });

  const logoDrop = createDropZone(logoDropEl, {
    accept: 'image/png,image/jpeg,image/svg+xml',
    multiple: false,
    onFiles: (chosen) => void setLogo(chosen[0] ?? null),
  });

  /* ---------------------------------------------------------------------- */
  /*  Logo                                                                   */
  /* ---------------------------------------------------------------------- */

  function updateLogoStatus(): void {
    logoStatus.textContent = logoName
      ? `${logoName} — rasterised on your device.`
      : 'No logo chosen yet.';
  }

  async function setLogo(file: File | null): Promise<void> {
    if (!file) {
      logoName = null;
      logoData = null;
      logoImage = null;
      updateLogoStatus();
      syncRunState();
      schedulePreview();
      return;
    }
    if (!file.type.startsWith('image/')) {
      showError(
        errorBox,
        'Choose a PNG, JPEG or SVG logo.',
        'SVG logos are rasterised on your device.',
      );
      return;
    }
    try {
      const url = await readAsDataURL(file);
      const declared = file.type === 'image/svg+xml' ? svgIntrinsicSize(await file.text()) : null;
      const image = await loadImage(url);
      logoData = rasteriseLogo(image, declared);
      logoImage = image;
      logoName = file.name;
      clearError(errorBox);
    } catch {
      logoData = null;
      logoImage = null;
      logoName = null;
      showError(errorBox, 'That logo could not be read.', 'Choose a PNG, JPEG or SVG file.');
    }
    updateLogoStatus();
    syncRunState();
    schedulePreview();
  }

  /* ---------------------------------------------------------------------- */
  /*  Preview                                                                */
  /* ---------------------------------------------------------------------- */

  function schedulePreview(): void {
    if (previewFrame) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      renderPreview();
    });
  }

  function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(127, 127, 127, 0.12)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(127, 127, 127, 0.9)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Choose an image to see the watermark', width / 2, height / 2);
  }

  function renderPreview(): void {
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    const available = previewCanvas.parentElement?.clientWidth ?? MAX_PREVIEW_WIDTH;
    const boxWidth = Math.max(240, Math.min(MAX_PREVIEW_WIDTH, available));
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const natural = previewImage
      ? {
          width: previewImage.naturalWidth || previewImage.width,
          height: previewImage.naturalHeight || previewImage.height,
        }
      : { width: 16, height: 9 };
    const scale = previewImage ? Math.min(1, boxWidth / natural.width) : boxWidth / natural.width;
    const width = Math.max(1, Math.round(natural.width * scale));
    const height = Math.max(1, Math.round(natural.height * scale));
    previewCanvas.width = Math.round(width * dpr);
    previewCanvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The context is reused between renders: clear the leftover watermark alpha
    // so the source image is never drawn through it.
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);

    if (!previewImage) {
      drawPlaceholder(ctx, width, height);
      previewStatus.textContent =
        'The preview is downscaled — the saved files keep their full resolution.';
      return;
    }

    ctx.drawImage(previewImage, 0, 0, width, height);
    try {
      const settings = resolveWatermarkSettings(readValues());
      const fontPx = settings.mode === 'text' ? textFontPx(settings, width, height) : 0;
      if (settings.mode === 'text') ctx.font = fontSpec(fontPx);
      const layout = computeLayout({
        settings,
        imageWidth: width,
        imageHeight: height,
        textWidth: settings.mode === 'text' ? ctx.measureText(settings.text).width : undefined,
        logoWidth: logoImage?.naturalWidth,
        logoHeight: logoImage?.naturalHeight,
      });
      drawWatermark(ctx, layout, settings, logoImage);
      previewStatus.textContent = `Preview at ${width} × ${height} px — the saved files keep their full resolution.`;
    } catch (error) {
      previewStatus.textContent =
        error instanceof Error && error.message
          ? error.message
          : 'Finish the watermark settings to see a preview.';
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                    */
  /* ---------------------------------------------------------------------- */

  function revokeOutputUrls(): void {
    for (const url of outputUrls) URL.revokeObjectURL(url);
    outputUrls.clear();
  }

  function renderOutputs(result: FileRunResult): void {
    resultWrap.hidden = false;
    outputsEl.innerHTML = '';
    for (const output of result.outputs) {
      const item = document.createElement('li');
      item.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2';

      const left = document.createElement('div');
      left.className = 'flex min-w-0 items-center gap-3';

      const url = URL.createObjectURL(output.blob);
      outputUrls.add(url);
      const thumb = document.createElement('img');
      thumb.src = url;
      thumb.alt = '';
      thumb.className = 'h-10 w-10 shrink-0 rounded border object-cover';

      const label = document.createElement('span');
      label.className = 'truncate text-sm';
      label.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      left.append(thumb, label);

      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'btn btn-subtle btn-sm shrink-0';
      save.textContent = 'Save';
      save.addEventListener('click', () => downloadBlob(output.blob, output.filename));

      item.append(left, save);
      outputsEl.append(item);
    }

    notesEl.innerHTML = '';
    for (const note of [
      ...(result.warnings ?? []).map((warning) => `⚠ ${warning}`),
      ...(result.notes ?? []),
    ]) {
      const item = document.createElement('li');
      item.className = 'text-[rgb(var(--text-muted))]';
      item.textContent = note;
      notesEl.append(item);
    }
  }

  async function run(): Promise<void> {
    if (files.length === 0) return;
    const values = readValues();
    try {
      resolveWatermarkSettings(values);
    } catch (error) {
      const failure = error as Error & { hint?: string };
      showError(errorBox, failure.message, failure.hint);
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
    revokeOutputUrls();

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        { files, options: values },
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
      const failure = error as Error & { hint?: string };
      if (failure.name !== 'AbortError') {
        showError(errorBox, failure.message || 'Watermarking failed', failure.hint);
      } else {
        progressMsg.textContent = 'Cancelled';
      }
    } finally {
      if (generation === runGeneration) {
        cancelBtn.hidden = true;
        controller = null;
        syncRunState();
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                 */
  /* ---------------------------------------------------------------------- */

  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-opt]').forEach((el) => {
    el.addEventListener('input', () => {
      // Any option change invalidates what is on screen.
      resultWrap.hidden = true;
      clearError(errorBox);
      syncOutputs();
      applyVisibility();
      syncRunState();
      schedulePreview();
    });
  });

  runBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => controller?.abort());
  resetBtn.addEventListener('click', () => {
    // Invalidate any in-flight run so a late worker reply cannot re-publish a
    // result the user just cleared.
    runGeneration += 1;
    controller?.abort();
    controller = null;
    files = [];
    logoName = null;
    logoData = null;
    logoImage = null;
    imageLoadToken += 1;
    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
      previewImageUrl = null;
    }
    previewImage = null;
    revokeOutputUrls();
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    resultWrap.hidden = true;
    progressWrap.hidden = true;
    clearError(errorBox);
    renderList();
    updateLogoStatus();
    schedulePreview();
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      revokeOutputUrls();
      if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
      imageDrop.destroy();
      logoDrop.destroy();
    },
    { once: true },
  );

  renderList();
  updateLogoStatus();
  syncOutputs();
  applyVisibility();
  syncRunState();
  schedulePreview();
}
