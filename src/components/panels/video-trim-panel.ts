/**
 * The video trimmer panel.
 *
 * It does three things and nothing else:
 *
 *   1. picks the video file and previews it in a `<video>` element;
 *   2. lets the user drag the in and out points along a scrub bar (or type the
 *      times), so the frame at the cut is visible before anything is cut;
 *   3. hands the file and the chosen range to the tool's own `run()` through
 *      `runToolById`, so the cut happens in the tool worker.
 *
 * The time parsing lives in the tool's core module, so the panel and the tool
 * always agree on what "1:30" means.
 *
 * Nothing here talks to the network: the preview plays the local file through
 * an object URL, and the cut is made on this device.
 */

import type { FileRunResult } from '@/lib/types';
import { createDropZone, downloadBlob } from '@/lib/files';
import { escapeHtml, formatBytes } from '@/lib/format';
import { clearError, renderTextResult, showError } from '@/components/workbench/shared';
import { runToolById } from '@/lib/worker/client';
import { formatTrimTime, parseTrimTime } from '@/tools/video/video-trim.core';

/** The two handles never cross, and never sit closer than this. */
const MIN_GAP_SECONDS = 0.05;

/** How much one arrow key moves a handle. */
const KEY_STEP_SECONDS = 0.1;

/** Mount the trimmer UI into a `[data-video-trim-panel]` element. */
export function mountVideoTrimPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'video-trim';
  const dropEl = root.querySelector<HTMLElement>('[data-drop]')!;
  const listEl = root.querySelector<HTMLUListElement>('[data-file-list]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const stageEl = root.querySelector<HTMLElement>('[data-stage]')!;
  const videoEl = root.querySelector<HTMLVideoElement>('[data-video]')!;
  const scrubEl = root.querySelector<HTMLElement>('[data-scrub]')!;
  const rangeEl = root.querySelector<HTMLElement>('[data-range]')!;
  const playheadEl = root.querySelector<HTMLElement>('[data-playhead]')!;
  const startHandle = root.querySelector<HTMLElement>('[data-handle="start"]')!;
  const endHandle = root.querySelector<HTMLElement>('[data-handle="end"]')!;
  const startInput = root.querySelector<HTMLInputElement>('[data-start]')!;
  const endInput = root.querySelector<HTMLInputElement>('[data-end]')!;
  const durationEl = root.querySelector<HTMLElement>('[data-duration]')!;
  const formatSel = root.querySelector<HTMLSelectElement>('[data-format]')!;
  const copySel = root.querySelector<HTMLSelectElement>('[data-copy-mode]')!;
  const audioChk = root.querySelector<HTMLInputElement>('[data-keep-audio]')!;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-cancel]')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]')!;
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]')!;
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const reportEl = root.querySelector<HTMLElement>('[data-report]')!;
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]')!;

  if (
    !dropEl ||
    !listEl ||
    !statusEl ||
    !stageEl ||
    !videoEl ||
    !scrubEl ||
    !rangeEl ||
    !playheadEl ||
    !startHandle ||
    !endHandle ||
    !startInput ||
    !endInput ||
    !durationEl ||
    !formatSel ||
    !copySel ||
    !audioChk ||
    !runBtn ||
    !cancelBtn ||
    !resetBtn ||
    !errorBox ||
    !progressWrap ||
    !progressBar ||
    !progressMsg ||
    !resultWrap ||
    !reportEl ||
    !outputsEl ||
    !notesEl
  ) {
    return;
  }

  let file: File | null = null;
  let objectUrl: string | null = null;
  /** Length of the clip in seconds — 0 until the metadata is loaded. */
  let duration = 0;
  let start = 0;
  let end = 0;
  let controller: AbortController | null = null;
  // Bumped on every run and on reset, so a late worker reply from a cancelled
  // run can never publish a stale result.
  let runGeneration = 0;

  /* ---------------------------------------------------------------------- */
  /*  Small helpers                                                          */
  /* ---------------------------------------------------------------------- */

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

  const percent = (seconds: number): number =>
    duration > 0 ? clamp((seconds / duration) * 100, 0, 100) : 0;

  function announce(message: string): void {
    statusEl.textContent = message;
  }

  /** Seek the preview without disturbing the current playback state. */
  function seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    try {
      videoEl.currentTime = clamp(seconds, 0, duration || seconds);
    } catch {
      // Seeking before the metadata is loaded throws in some browsers.
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  The scrub bar                                                          */
  /* ---------------------------------------------------------------------- */

  /** The time under a pointer, in seconds. */
  function timeAt(clientX: number): number {
    const rect = scrubEl.getBoundingClientRect();
    if (rect.width <= 0 || duration <= 0) return 0;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return ratio * duration;
  }

  /** Move a handle to a time, keeping the two apart. */
  function applyHandle(which: 'start' | 'end', seconds: number): void {
    if (duration <= 0) return;
    const value = clamp(seconds, 0, duration);
    if (which === 'start') {
      start = clamp(value, 0, Math.max(0, end - MIN_GAP_SECONDS));
    } else {
      end = clamp(value, Math.min(duration, start + MIN_GAP_SECONDS), duration);
    }
    seek(which === 'start' ? start : end);
    syncUi();
  }

  /** Which handle (if any) is being dragged. */
  let dragging: 'start' | 'end' | null = null;

  scrubEl.addEventListener('pointerdown', (event) => {
    if (duration <= 0) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>('[data-handle]');
    const which = handle?.dataset.handle;
    dragging = which === 'end' || which === 'start' ? which : null;
    scrubEl.setPointerCapture(event.pointerId);
    if (dragging) {
      applyHandle(dragging, timeAt(event.clientX));
    } else {
      // A click on the bar moves the playhead there.
      const time = timeAt(event.clientX);
      seek(time);
      syncUi();
    }
    event.preventDefault();
  });

  scrubEl.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    applyHandle(dragging, timeAt(event.clientX));
  });

  const endDrag = (): void => {
    dragging = null;
  };
  scrubEl.addEventListener('pointerup', endDrag);
  scrubEl.addEventListener('pointercancel', endDrag);

  /** Arrow keys move a focused handle, so the cut can be made without a mouse. */
  function onHandleKey(event: KeyboardEvent, which: 'start' | 'end'): void {
    const step = event.shiftKey ? KEY_STEP_SECONDS * 10 : KEY_STEP_SECONDS;
    let delta = 0;
    if (event.key === 'ArrowLeft') delta = -step;
    else if (event.key === 'ArrowRight') delta = step;
    else if (event.key === 'Home') delta = -duration;
    else if (event.key === 'End') delta = duration;
    else return;
    event.preventDefault();
    applyHandle(which, (which === 'start' ? start : end) + delta);
  }

  startHandle.addEventListener('keydown', (event) => onHandleKey(event, 'start'));
  endHandle.addEventListener('keydown', (event) => onHandleKey(event, 'end'));

  /* ---------------------------------------------------------------------- */
  /*  Typed times                                                             */
  /* ---------------------------------------------------------------------- */

  /** Read a typed time, complain when it does not make sense. */
  function readTypedTime(input: HTMLInputElement, label: string): number | null {
    const raw = input.value.trim();
    if (raw === '') return null;
    try {
      const seconds = parseTrimTime(raw, label);
      if (duration > 0 && seconds > duration) {
        announce(`${label} is past the end of the clip.`);
        return null;
      }
      return seconds;
    } catch (error) {
      announce(
        error instanceof Error ? error.message : `That ${label.toLowerCase()} is not valid.`,
      );
      return null;
    }
  }

  startInput.addEventListener('change', () => {
    const seconds = readTypedTime(startInput, 'The in point');
    if (seconds === null) {
      syncUi();
      return;
    }
    applyHandle('start', seconds);
  });

  endInput.addEventListener('change', () => {
    const seconds = readTypedTime(endInput, 'The out point');
    if (seconds === null) {
      syncUi();
      return;
    }
    applyHandle('end', seconds);
  });

  /* ---------------------------------------------------------------------- */
  /*  The preview                                                             */
  /* ---------------------------------------------------------------------- */

  function onMetadata(): void {
    const total = videoEl.duration;
    if (!Number.isFinite(total) || total <= 0) {
      announce('The length of this clip could not be read.');
      duration = 0;
      syncUi();
      return;
    }
    duration = total;
    start = 0;
    end = total;
    announce(`The clip is ${formatTrimTime(total)} long — drag the handles to cut it.`);
    syncUi();
  }

  videoEl.addEventListener('loadedmetadata', onMetadata);
  // The panel module is imported lazily, so the metadata of a restored or
  // already-loading file may have arrived before this listener existed.
  if (videoEl.readyState >= 1) onMetadata();

  videoEl.addEventListener('timeupdate', () => {
    if (duration <= 0) return;
    playheadEl.style.left = `${percent(videoEl.currentTime)}%`;
  });

  /* ---------------------------------------------------------------------- */
  /*  Rendering                                                               */
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
    runBtn.disabled = !file || duration <= 0;
  }

  function syncUi(): void {
    const startPct = percent(start);
    const endPct = percent(end);
    rangeEl.style.left = `${startPct}%`;
    rangeEl.style.width = `${Math.max(0, endPct - startPct)}%`;
    startHandle.style.left = `${startPct}%`;
    endHandle.style.left = `${endPct}%`;
    playheadEl.style.left = `${percent(videoEl.currentTime)}%`;

    for (const [handle, seconds] of [
      [startHandle, start],
      [endHandle, end],
    ] as const) {
      handle.setAttribute('aria-valuemin', '0');
      handle.setAttribute('aria-valuemax', duration.toFixed(3));
      handle.setAttribute('aria-valuenow', seconds.toFixed(3));
      handle.setAttribute('aria-valuetext', formatTrimTime(seconds));
    }

    // Never fight the user while they are typing.
    if (document.activeElement !== startInput) startInput.value = formatTrimTime(start);
    if (document.activeElement !== endInput) endInput.value = formatTrimTime(end);

    durationEl.textContent =
      duration > 0
        ? `Clip length ${formatTrimTime(duration)} · keeping ${formatTrimTime(end - start)}`
        : '';
    runBtn.disabled = !file || duration <= 0;
  }

  /* ---------------------------------------------------------------------- */
  /*  File selection                                                          */
  /* ---------------------------------------------------------------------- */

  function releaseObjectUrl(): void {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function setFile(next: File | null): void {
    file = next;
    releaseObjectUrl();
    duration = 0;
    start = 0;
    end = 0;
    clearError(errorBox);
    resultWrap.hidden = true;
    stageEl.hidden = true;
    videoEl.removeAttribute('src');
    videoEl.load();
    if (file) {
      objectUrl = URL.createObjectURL(file);
      videoEl.src = objectUrl;
      announce('Loading the preview…');
    } else {
      announce('Choose a video to see its timeline.');
    }
    renderList();
    syncUi();
  }

  const dz = createDropZone(dropEl, {
    accept: root.dataset.accept || undefined,
    multiple: false,
    onFiles: (files) => {
      const next = files[0] ?? null;
      if (next) setFile(next);
    },
  });

  listEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button) return;
    setFile(null);
  });

  /* ---------------------------------------------------------------------- */
  /*  Running the tool                                                        */
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
    if (!file || duration <= 0) return;

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
            start: formatTrimTime(start),
            end: formatTrimTime(end),
            format: formatSel.value,
            copyMode: copySel.value,
            keepAudio: audioChk.checked,
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
      if (err.name !== 'AbortError') showError(errorBox, err.message || 'The cut failed', err.hint);
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
    setFile(null);
    progressWrap.hidden = true;
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';
    reportEl.hidden = true;
    reportEl.innerHTML = '';
    resultWrap.hidden = true;
    clearError(errorBox);
  });

  window.addEventListener(
    'beforeunload',
    () => {
      controller?.abort();
      runGeneration += 1;
      releaseObjectUrl();
      dz.destroy();
    },
    { once: true },
  );

  renderList();
  syncUi();
}
