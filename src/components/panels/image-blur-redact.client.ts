/**
 * Behaviour for the Blur & Redact panel, loaded on demand by
 * `image-blur-redact.astro` so no drawing code ships to pages that don't need it.
 *
 * The panel only owns the interaction: it decodes nothing, blurs nothing and
 * encodes nothing. It collects rectangles as percentages and hands them to the
 * tool (`image-blur-redact.tool.ts`), which does the pixel work in the Web
 * Worker. Everything stays in this tab — no request ever leaves the site.
 */
import type { FileRunResult } from '@/lib/types';
import { createDropZone, downloadBlob, validateFileSelection } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  MIN_REGION_PERCENT,
  addRegion,
  clampRegion,
  defaultRegion,
  moveRegion,
  parseRegions,
  regionEffect,
  removeRegionAt,
  resizeRegion,
  updateRegionAt,
  type RedactEffect,
  type Region,
} from '@/tools/image/image-blur-redact.core';
import {
  applyShowWhen,
  bindRangeOutputs,
  clearError,
  readOptions,
  renderTextResult,
  showError,
} from '../workbench/shared';

/** Percent moved or resized per arrow-key press, and with Shift held. */
const MOVE_STEP = 1;
const BIG_STEP = 5;

const EFFECTS: { value: RedactEffect; label: string }[] = [
  { value: 'blur', label: 'Blur' },
  { value: 'pixelate', label: 'Pixelate' },
  { value: 'black', label: 'Black out' },
];

interface Point {
  x: number;
  y: number;
}

type DragMode = 'draw' | 'move' | 'resize';

interface Drag {
  mode: DragMode;
  index: number;
  start: Point;
  origin: Region | null;
}

/** Look up a required element, so a markup change fails loudly instead of silently. */
function need<T extends Element>(parent: ParentNode, selector: string): T {
  const el = parent.querySelector<T>(selector);
  if (!el) throw new Error(`The redaction panel is missing ${selector}.`);
  return el;
}

function clampPercent(value: number): number {
  return value < 0 ? 0 : value > 100 ? 100 : value;
}

/** Build a region from two drag points, clamped into the image. */
function rectFromPoints(a: Point, b: Point): Region {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return clampRegion({ x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
}

function effectLabel(effect: RedactEffect): string {
  return EFFECTS.find((e) => e.value === effect)?.label ?? 'Redact';
}

/** Every element the panel binds to; a missing one is a markup bug. */
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
  reportEl: HTMLElement;
  outputsEl: HTMLUListElement;
  notesEl: HTMLUListElement;
  stageWrap: HTMLElement;
  stage: HTMLElement;
  preview: HTMLImageElement;
  overlay: HTMLElement;
  marquee: HTMLElement;
  regionList: HTMLUListElement;
  stageStatus: HTMLElement;
  addBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  optionsRoot: HTMLElement;
  regionsField: HTMLTextAreaElement;
}

/** Mount the panel into its `[data-image-blur-redact-panel]` root. */
export function mountImageBlurRedactPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'image-blur-redact';
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
        reportEl: need(root, '[data-report]'),
        outputsEl: need(root, '[data-outputs]'),
        notesEl: need(root, '[data-notes]'),
        stageWrap: need(root, '[data-stage-wrap]'),
        stage: need(root, '[data-stage]'),
        preview: need(root, '[data-preview]'),
        overlay: need(root, '[data-overlay]'),
        marquee: need(root, '[data-marquee]'),
        regionList: need(root, '[data-region-list]'),
        stageStatus: need(root, '[data-stage-status]'),
        addBtn: need(root, '[data-add-region]'),
        clearBtn: need(root, '[data-clear-regions]'),
        optionsRoot: need(root, '[data-options]'),
        regionsField: need(root, '[data-opt-key="regions"]'),
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
    reportEl,
    outputsEl,
    notesEl,
    stageWrap,
    stage,
    preview,
    overlay,
    marquee,
    regionList,
    stageStatus,
    addBtn,
    clearBtn,
    optionsRoot,
    regionsField,
  } = refs;

  let file: File | null = null;
  /** False until the chosen file has been shown, so Run cannot fire on junk. */
  let fileUsable = false;
  let previewUrl: string | null = null;
  let regions: Region[] = [];
  let selected = -1;
  let drag: Drag | null = null;
  let controller: AbortController | null = null;
  /** Bumped on every run and on reset, so a late reply cannot publish stale output. */
  let runGeneration = 0;
  const outputUrls = new Set<string>();

  /* ---------------------------------------------------------------------- */
  /*  Small view helpers                                                     */
  /* ---------------------------------------------------------------------- */

  function setStatus(message: string): void {
    stageStatus.textContent = message;
  }

  function updateRunState(): void {
    runBtn.disabled = !file;
    resetBtn.hidden = !file;
  }

  function syncRegionsField(): void {
    regionsField.value = JSON.stringify(regions);
    regionsField.removeAttribute('aria-invalid');
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
  /*  Region view                                                            */
  /* ---------------------------------------------------------------------- */

  function effectClasses(effect: RedactEffect): string {
    if (effect === 'black') return 'border-solid border-black bg-black/70';
    if (effect === 'pixelate')
      return 'border-dotted border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/25';
    return 'border-dashed border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/20';
  }

  function globalEffect(): RedactEffect {
    const value = String(readOptions(optionsRoot).effect ?? 'blur');
    return value === 'pixelate' || value === 'black' ? value : 'blur';
  }

  function regionAria(index: number): string {
    const r = regions[index]!;
    return `Region ${index + 1}, ${effectLabel(regionEffect(r, globalEffect()))}, x ${r.x}%, y ${r.y}%, ${r.w}% wide, ${r.h}% tall. Arrow keys move it, plus and minus resize it, Delete removes it.`;
  }

  function renderOverlay(): void {
    overlay.querySelectorAll('[data-region]').forEach((el) => el.remove());
    regions.forEach((region, index) => {
      const active = regionEffect(region, globalEffect());
      const box = document.createElement('div');
      box.className = `absolute cursor-move border-2 ${effectClasses(active)}${
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
        'pointer-events-none absolute left-0 top-0 rounded-br bg-[rgb(var(--accent))] px-1 text-[10px] font-semibold leading-4 text-white';
      badge.textContent = `${index + 1} ${effectLabel(active)}`;
      box.appendChild(badge);

      const handle = document.createElement('span');
      handle.className =
        'absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-[rgb(var(--accent))]';
      // Mouse-only affordance: the keyboard path is the +/- keys and the number
      // fields below, so the handle is hidden from assistive tech.
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
      head.innerHTML = `
        <span class="font-medium tabular-nums">Region ${index + 1}</span>
        <label class="text-xs text-[rgb(var(--text-muted))]" for="region-${index}-effect">Effect</label>
        <select id="region-${index}-effect" class="field" data-region-effect>
          <option value="">Use the global effect (${effectLabel(globalEffect())})</option>
          ${EFFECTS.map(
            (e) =>
              `<option value="${e.value}"${region.effect === e.value ? ' selected' : ''}>${e.label}</option>`,
          ).join('')}
        </select>
        <button type="button" class="btn btn-subtle btn-sm ml-auto" data-region-remove aria-label="Remove region ${index + 1}">Delete</button>
      `;

      const fields = document.createElement('div');
      fields.className = 'mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4';
      fields.innerHTML = (['x', 'y', 'w', 'h'] as const)
        .map(
          (key) => `
        <span class="flex items-center gap-1.5">
          <label class="text-xs text-[rgb(var(--text-muted))]" for="region-${index}-${key}">${
            key === 'w' ? 'Width' : key === 'h' ? 'Height' : key === 'x' ? 'X' : 'Y'
          } (%)</label>
          <input id="region-${index}-${key}" class="field" type="number" min="0" max="100" step="1"
            inputmode="numeric" value="${region[key]}" data-region-field="${key}" />
        </span>`,
        )
        .join('');

      item.append(head, fields);
      regionList.appendChild(item);
    });
  }

  function commit(): void {
    syncRegionsField();
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

  function setRegion(index: number, next: Region, keepFocus = true): void {
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
    if (!regions.length) setStatus('No rectangles left — drag on the image to add one.');
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

  function showMarquee(rect: Region): void {
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
      // `preventDefault()` suppresses the focus that would follow the click, so
      // focus the box explicitly to keep the arrow keys working after a drag.
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
        setStatus('That rectangle is too small — drag a larger one, or use “Add a region”.');
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
    const step = event.shiftKey ? BIG_STEP : MOVE_STEP;
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

    let next: Region | null = null;
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
      return;
    }
    if (target.hasAttribute('data-region-effect')) {
      const value = (target as HTMLSelectElement).value;
      const patch: Partial<Region> = { effect: value === '' ? undefined : value };
      regions = updateRegionAt(regions, index, patch);
      commit();
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
    if (target.closest('button, input, select, label')) return;
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

  regionsField.addEventListener('input', () => {
    try {
      regions = parseRegions(regionsField.value);
      regionsField.removeAttribute('aria-invalid');
      selected = regions.length - 1;
      renderOverlay();
      renderRegionList();
      setStatus(
        regions.length
          ? `${regions.length} rectangle${regions.length === 1 ? '' : 's'} read from the region list.`
          : 'The region list is empty — drag on the image to add one.',
      );
    } catch {
      regionsField.setAttribute('aria-invalid', 'true');
      setStatus('The region list is not valid JSON — fix it, or clear it to redraw.');
    }
  });

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                         */
  /* ---------------------------------------------------------------------- */

  function whenPreviewReady(): Promise<boolean> {
    if (typeof preview.decode === 'function') {
      return preview.decode().then(
        () => true,
        () => false,
      );
    }
    if (preview.complete) return Promise.resolve(preview.naturalWidth > 0);
    return new Promise((resolve) => {
      preview.addEventListener('load', () => resolve(true), { once: true });
      preview.addEventListener('error', () => resolve(false), { once: true });
    });
  }

  async function setFile(next: File | null): Promise<void> {
    file = next;
    fileUsable = false;
    regions = [];
    selected = -1;
    drag = null;
    clearError(errorBox);
    resultWrap.hidden = true;
    reportEl.hidden = true;
    reportEl.innerHTML = '';
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    for (const url of outputUrls) URL.revokeObjectURL(url);
    outputUrls.clear();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    syncRegionsField();
    renderFileList();
    renderOverlay();
    renderRegionList();
    updateRunState();

    if (!file) {
      stageWrap.hidden = true;
      preview.removeAttribute('src');
      setStatus('Choose an image to start drawing.');
      return;
    }

    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    if (!(await whenPreviewReady())) {
      stageWrap.hidden = true;
      fileUsable = false;
      showError(
        errorBox,
        'That file could not be shown as an image.',
        'Choose a PNG, JPEG or WebP file.',
      );
      setStatus('That file could not be read — choose another image.');
      return;
    }

    fileUsable = true;
    stageWrap.hidden = false;
    setStatus(
      `${file.name} — ${preview.naturalWidth} × ${preview.naturalHeight} pixels. Drag on the image to mark what to hide.`,
    );
    updateRunState();
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

  addBtn.addEventListener('click', () => {
    regions = addRegion(regions, defaultRegion());
    selected = regions.length - 1;
    commit();
    focusRegion(selected);
    setStatus(`Added region ${selected + 1} in the middle of the image.`);
  });

  clearBtn.addEventListener('click', () => {
    regions = [];
    selected = -1;
    commit();
    setStatus('No rectangles left — drag on the image to add one.');
  });

  /* ---------------------------------------------------------------------- */
  /*  Run                                                                    */
  /* ---------------------------------------------------------------------- */

  function renderOutputs(result: FileRunResult): void {
    resultWrap.hidden = false;
    if (result.report) {
      renderTextResult(reportEl, {
        output: result.report.output,
        render: result.report.render,
        language: result.report.language,
      });
      reportEl.hidden = false;
    } else {
      reportEl.hidden = true;
      reportEl.innerHTML = '';
    }

    outputsEl.innerHTML = '';
    for (const output of result.outputs) {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2';

      const left = document.createElement('div');
      left.className = 'flex min-w-0 items-center gap-3';
      if (output.blob.type.startsWith('image/')) {
        const thumb = document.createElement('img');
        const url = URL.createObjectURL(output.blob);
        outputUrls.add(url);
        thumb.src = url;
        thumb.alt = '';
        thumb.className = 'h-10 w-10 rounded object-cover';
        left.appendChild(thumb);
      }
      const name = document.createElement('span');
      name.className = 'truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      left.appendChild(name);

      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'btn btn-subtle btn-sm shrink-0';
      save.textContent = 'Save';
      save.addEventListener('click', () => downloadBlob(output.blob, output.filename));

      li.append(left, save);
      outputsEl.appendChild(li);
    }

    notesEl.innerHTML = '';
    for (const warning of result.warnings ?? []) {
      const li = document.createElement('li');
      li.style.color = 'rgb(var(--warning))';
      li.textContent = `⚠ ${warning}`;
      notesEl.appendChild(li);
    }
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      li.className = 'text-[rgb(var(--text-muted))]';
      li.textContent = note;
      notesEl.appendChild(li);
    }
  }

  async function run(): Promise<void> {
    if (!file) {
      showError(errorBox, 'Choose an image file.');
      return;
    }
    if (!fileUsable) {
      showError(
        errorBox,
        'That file could not be read as an image.',
        'Choose a PNG, JPEG or WebP file.',
      );
      return;
    }
    if (!regions.length) {
      showError(
        errorBox,
        'Nothing to redact.',
        'Draw at least one rectangle on the image, or add one with “Add a region”.',
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
          // The JSON field is the single source of truth for `run()`, so a
          // hand-edited list and the drawn rectangles can never disagree.
          options: { ...readOptions(optionsRoot), regions: JSON.stringify(regions) },
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
      if (err.name !== 'AbortError')
        showError(errorBox, err.message || 'Redaction failed', err.hint);
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

  optionsRoot.addEventListener('input', () => applyShowWhen(optionsRoot));
  optionsRoot.addEventListener('change', () => {
    applyShowWhen(optionsRoot);
    // The badge and border style show the effect a region will use, so the
    // overlay follows the global option.
    renderOverlay();
  });

  bindRangeOutputs(root);
  applyShowWhen(optionsRoot);
  syncRegionsField();
  renderFileList();
  renderOverlay();
  renderRegionList();
  updateRunState();

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      for (const url of outputUrls) URL.revokeObjectURL(url);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      dz.destroy();
    },
    { once: true },
  );
}
