/**
 * The screen recorder panel.
 *
 * `getDisplayMedia` and `MediaRecorder` are main-thread browser APIs, so the
 * capture UI cannot live in the generic file workbench (nor in the tool
 * worker). This module owns the capture:
 *
 *   1. **Share screen** — `getDisplayMedia()` opens the browser's own picker.
 *      The user chooses what is recorded, and the browser's "Stop sharing"
 *      button ends the capture.
 *   2. **Microphone** — an optional toggle that adds a microphone track from
 *      `getUserMedia({ audio: true })`.
 *   3. **Record** — `MediaRecorder` writes the clip in this tab.
 *
 * When the recording stops, the blob is handed to the tool as a `File` in the
 * payload; the tool (running in the Web Worker) validates it and produces the
 * downloadable output.
 *
 * Privacy: nothing is uploaded. The only network traffic is the browser
 * fetching this app's own lazily-loaded chunk.
 */
import type { FileRunResult } from '@/lib/types';
import { downloadBlob } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  describeCaptureError,
  formatElapsed,
  formatForMimeType,
  labelForFormat,
  pickMimeType,
  recordingFileName,
  supportsMp4,
  supportsWebm,
  type RecordingFormat,
} from '@/tools/video/screen-recorder.core';
import { clearError, renderTextResult, showError } from './shared';

/** How often the recorder hands over a chunk of the recording (ms). */
const CHUNK_MS = 1000;
/** How often the elapsed timer is refreshed (ms). */
const TIMER_MS = 250;

/** `MediaRecorder.isTypeSupported`, guarded for browsers without the API. */
function isTypeSupported(type: string): boolean {
  try {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type);
  } catch {
    return false;
  }
}

/** Start a media element without letting a missing/denied playback throw. */
function playQuietly(el: HTMLVideoElement): void {
  try {
    const played = el.play() as unknown as Promise<void> | undefined;
    if (played && typeof played.catch === 'function') played.catch(() => undefined);
  } catch {
    /* playback is a nicety, never a requirement */
  }
}

/** Mount the recorder panel into a `[data-screen-recorder-workbench]` element. */
export function mountScreenRecorderPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'screen-recorder';
  const shareBtn = root.querySelector<HTMLButtonElement>('[data-share]')!;
  const shareLabel = root.querySelector<HTMLElement>('[data-share-label]');
  const micBtn = root.querySelector<HTMLButtonElement>('[data-mic]')!;
  const micState = root.querySelector<HTMLElement>('[data-mic-state]');
  const startBtn = root.querySelector<HTMLButtonElement>('[data-start]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-stop]')!;
  const formatSelect = root.querySelector<HTMLSelectElement>('[data-format]')!;
  const qualitySelect = root.querySelector<HTMLSelectElement>('[data-quality]');
  const timerEl = root.querySelector<HTMLElement>('[data-timer]')!;
  const recDot = root.querySelector<HTMLElement>('[data-rec-dot]');
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const previewWrap = root.querySelector<HTMLElement>('[data-preview-wrap]');
  const preview = root.querySelector<HTMLVideoElement>('[data-preview]');
  const clipWrap = root.querySelector<HTMLElement>('[data-clip-wrap]');
  const clip = root.querySelector<HTMLVideoElement>('[data-clip]');
  const progressWrap = root.querySelector<HTMLElement>('[data-progress-wrap]');
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]');
  const progressMsg = root.querySelector<HTMLElement>('[data-progress-msg]');
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]');
  const reportEl = root.querySelector<HTMLElement>('[data-report]');
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]')!;

  // Astro always renders these; the guard keeps a markup change from crashing.
  if (
    !shareBtn ||
    !micBtn ||
    !startBtn ||
    !stopBtn ||
    !formatSelect ||
    !timerEl ||
    !statusEl ||
    !errorBox ||
    !outputsEl ||
    !notesEl
  ) {
    return;
  }

  let displayStream: MediaStream | null = null;
  let micStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let startedAt = 0;
  let timerId: number | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;
  let clipUrl: string | null = null;
  /** Whether the microphone was part of the recording that is running. */
  let micIncluded = false;
  /** Set while we tear the share down ourselves, so `ended` stays quiet. */
  let closingShare = false;
  /** True once the browser ended the share (the "Stop sharing" button). */
  let shareEnded = false;

  /* ---------------------------------------------------------------------- */
  /*  Small helpers                                                          */
  /* ---------------------------------------------------------------------- */

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  const fail = (message: string, hint?: string): void => {
    showError(errorBox, message, hint);
  };

  /** The formats this browser can really record, WebM first. */
  function availableFormats(): RecordingFormat[] {
    const formats: RecordingFormat[] = [];
    if (supportsWebm(isTypeSupported)) formats.push('webm');
    if (supportsMp4(isTypeSupported)) formats.push('mp4');
    return formats;
  }

  function selectedFormat(): RecordingFormat {
    return formatSelect.value === 'mp4' ? 'mp4' : 'webm';
  }

  function selectedBitrate(): number {
    const value = Number(qualitySelect?.value);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 5_000_000;
  }

  /* ---------------------------------------------------------------------- */
  /*  Controls                                                               */
  /* ---------------------------------------------------------------------- */

  function updateControls(): void {
    const sharing = !!displayStream;
    const recording = !!recorder && recorder.state !== 'inactive';
    const canRecord = typeof MediaRecorder !== 'undefined';

    shareBtn.setAttribute('aria-pressed', sharing ? 'true' : 'false');
    if (shareLabel) shareLabel.textContent = sharing ? 'Stop sharing' : 'Share screen';
    shareBtn.disabled = recording;

    startBtn.disabled = !sharing || recording || !canRecord;
    stopBtn.hidden = !recording;
    if (recDot) recDot.hidden = !recording;
  }

  function populateFormats(): void {
    const formats = availableFormats();
    formatSelect.replaceChildren();
    for (const format of formats) {
      const option = document.createElement('option');
      option.value = format;
      option.textContent = labelForFormat(format);
      formatSelect.append(option);
    }
    if (!formats.length) {
      // Nothing can be recorded here — say so instead of offering a lie.
      const option = document.createElement('option');
      option.value = 'webm';
      option.textContent = 'WebM (not supported here)';
      formatSelect.append(option);
      formatSelect.disabled = true;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Timer                                                                  */
  /* ---------------------------------------------------------------------- */

  function stopTimer(): void {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function tick(): void {
    timerEl.textContent = formatElapsed(Date.now() - startedAt);
  }

  function startTimer(): void {
    stopTimer();
    tick();
    timerId = window.setInterval(tick, TIMER_MS);
  }

  /* ---------------------------------------------------------------------- */
  /*  Screen share                                                           */
  /* ---------------------------------------------------------------------- */

  function stopShare(): void {
    closingShare = true;
    displayStream?.getTracks().forEach((track) => track.stop());
    displayStream = null;
    closingShare = false;
    if (preview) preview.srcObject = null;
    if (previewWrap) previewWrap.hidden = true;
    updateControls();
  }

  async function share(): Promise<void> {
    if (displayStream) {
      stopShare();
      announce('Screen sharing stopped.');
      return;
    }
    clearError(errorBox);
    const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!devices || typeof devices.getDisplayMedia !== 'function') {
      fail(
        'This browser cannot share a screen.',
        'Screen recording needs a recent Chrome, Edge, Firefox or Safari 13+, on a secure (https) page.',
      );
      announce('Screen sharing is not available in this browser.');
      return;
    }

    announce('Waiting for the browser to ask what to share…');
    try {
      const stream = await devices.getDisplayMedia({ video: true, audio: true });
      displayStream = stream;
      shareEnded = false;
      const [videoTrack] = stream.getVideoTracks();
      videoTrack?.addEventListener('ended', () => {
        if (closingShare) return;
        void onShareEnded();
      });
      if (preview) {
        preview.srcObject = stream;
        playQuietly(preview);
      }
      if (previewWrap) previewWrap.hidden = false;
      announce('Screen shared. Press Start recording when you are ready.');
      updateControls();
    } catch (err) {
      const info = describeCaptureError(err, 'screen');
      fail(info.message, info.hint);
      announce('Nothing was shared.');
      updateControls();
    }
  }

  /** The user pressed the browser's own "Stop sharing" button. */
  async function onShareEnded(): Promise<void> {
    announce('The screen share ended.');
    shareEnded = true;
    if (recorder && recorder.state !== 'inactive') {
      // The recording is finalised first — tearing the stream down now could
      // cut off the last chunk.
      stopRecording();
      return;
    }
    stopShare();
  }

  /* ---------------------------------------------------------------------- */
  /*  Microphone                                                             */
  /* ---------------------------------------------------------------------- */

  function setMicState(on: boolean): void {
    micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (micState) micState.textContent = on ? 'on' : 'off';
  }

  async function toggleMic(): Promise<void> {
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
      setMicState(false);
      announce(
        recorder && recorder.state !== 'inactive'
          ? 'Microphone off — it stays in the recording that is running.'
          : 'Microphone off.',
      );
      return;
    }

    const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!devices || typeof devices.getUserMedia !== 'function') {
      fail('This browser cannot open a microphone.', 'The screen is still recorded without it.');
      announce('The microphone is not available in this browser.');
      return;
    }

    clearError(errorBox);
    announce('Waiting for microphone permission…');
    try {
      micStream = await devices.getUserMedia({ audio: true });
      setMicState(true);
      announce(
        recorder && recorder.state !== 'inactive'
          ? 'Microphone on — it will be included in the next recording.'
          : 'Microphone on — it will be included in the recording.',
      );
    } catch (err) {
      const info = describeCaptureError(err, 'microphone');
      fail(info.message, info.hint);
      announce('The microphone stays off.');
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Recording                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * The stream that is recorded: the shared screen plus one audio track. The
   * microphone wins over the system audio so the file never carries two
   * competing audio tracks.
   */
  function composeStream(): MediaStream | null {
    const videoTracks = displayStream?.getVideoTracks() ?? [];
    if (!videoTracks.length) {
      fail('The screen share ended.', 'Share your screen again, then start the recording.');
      return null;
    }
    const micTrack = micStream?.getAudioTracks()[0];
    const displayAudio = displayStream?.getAudioTracks()[0];
    const audio = micTrack ?? displayAudio;
    micIncluded = !!micTrack;

    const tracks: MediaStreamTrack[] = [...videoTracks];
    if (audio) tracks.push(audio);
    try {
      const Ctor = globalThis.MediaStream;
      if (typeof Ctor !== 'function') {
        fail(
          'This browser cannot build a capture stream.',
          'Try a recent Chrome, Edge, Firefox or Safari.',
        );
        return null;
      }
      return new Ctor(tracks);
    } catch {
      fail(
        'The capture stream could not be created.',
        'Try again, or pick another screen to share.',
      );
      return null;
    }
  }

  function startRecording(): void {
    if (!displayStream || (recorder && recorder.state !== 'inactive')) return;
    clearError(errorBox);

    if (typeof MediaRecorder === 'undefined') {
      fail(
        'This browser cannot record video.',
        'MediaRecorder is missing — try a recent Chrome, Edge, Firefox or Safari.',
      );
      announce('Recording is not available in this browser.');
      return;
    }

    const mimeType = pickMimeType(isTypeSupported, selectedFormat());
    if (!mimeType) {
      fail(
        'This browser cannot record video.',
        'No recording format is supported here — try a different browser.',
      );
      announce('Recording is not available in this browser.');
      return;
    }

    const stream = composeStream();
    if (!stream) return;

    let instance: MediaRecorder;
    try {
      instance = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: selectedBitrate(),
      });
    } catch {
      fail(
        'The recording could not be started.',
        'This browser refused the recording settings — try another format or quality.',
      );
      announce('The recording could not be started.');
      return;
    }

    recorder = instance;
    chunks = [];
    startedAt = Date.now();
    instance.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    instance.onstop = () => {
      void finishRecording(mimeType);
    };
    instance.onerror = () => {
      fail('The recording failed.', 'The browser stopped the recorder — start it again.');
      announce('The recording failed.');
    };

    try {
      instance.start(CHUNK_MS);
    } catch {
      recorder = null;
      fail('The recording could not be started.', 'Try again with another screen.');
      announce('The recording could not be started.');
      updateControls();
      return;
    }

    startTimer();
    announce('Recording started.');
    updateControls();
  }

  function stopRecording(): void {
    if (!recorder || recorder.state === 'inactive') return;
    announce('Stopping the recording…');
    try {
      recorder.stop();
    } catch {
      /* the recorder is already gone — the stop handler cleans up */
    }
  }

  async function finishRecording(mimeType: string): Promise<void> {
    stopTimer();
    const durationSeconds = Math.max(0, (Date.now() - startedAt) / 1000);
    const blob = new Blob(chunks, { type: mimeType });
    chunks = [];
    recorder = null;
    updateControls();

    if (!blob.size) {
      fail(
        'The recording came out empty.',
        'Nothing was captured — share a screen and record again.',
      );
      announce('Nothing was recorded.');
      if (shareEnded) stopShare();
      return;
    }

    const format = formatForMimeType(mimeType) ?? 'webm';
    const file = new File([blob], recordingFileName(new Date(startedAt), format), {
      type: mimeType,
    });
    announce(`Recording stopped — ${formatElapsed(durationSeconds * 1000)} recorded.`);
    showClip(blob);
    // The share is gone (the browser stopped it) — do not leave a dead stream
    // behind that would record nothing.
    if (shareEnded) stopShare();
    await handToTool(file, durationSeconds, format);
  }

  function showClip(blob: Blob): void {
    if (!clip) return;
    try {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
      clipUrl = URL.createObjectURL(blob);
      clip.src = clipUrl;
      if (clipWrap) clipWrap.hidden = false;
    } catch {
      /* the preview is a nicety — the download still works */
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Hand the recording to the tool                                          */
  /* ---------------------------------------------------------------------- */

  async function handToTool(
    file: File,
    durationSeconds: number,
    format: RecordingFormat,
  ): Promise<void> {
    controller?.abort();
    const generation = ++runGeneration;
    controller = new AbortController();
    clearError(errorBox);
    if (progressWrap) progressWrap.hidden = false;
    if (progressBar) progressBar.style.width = '0%';
    if (progressMsg) progressMsg.textContent = 'Working…';

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        {
          files: [file],
          options: {
            format,
            duration: Math.round(durationSeconds * 10) / 10,
            microphone: micIncluded,
            mimeType: file.type,
            videoBitsPerSecond: selectedBitrate(),
          },
        },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => {
            if (generation !== runGeneration) return;
            const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressMsg) progressMsg.textContent = message ? `${message} — ${pct}%` : `${pct}%`;
          },
        },
      );
      if (generation !== runGeneration) return;
      if (progressBar) progressBar.style.width = '100%';
      if (progressMsg) progressMsg.textContent = 'Done';
      renderResult(result);
    } catch (err) {
      if (generation !== runGeneration) return;
      const e = err as Error & { hint?: string };
      if (e.name !== 'AbortError') {
        fail(e.message || 'The recording could not be processed.', e.hint);
        announce('The recording could not be processed.');
      } else if (progressMsg) {
        progressMsg.textContent = 'Cancelled';
      }
    } finally {
      if (generation === runGeneration) controller = null;
    }
  }

  function renderResult(result: FileRunResult): void {
    if (resultWrap) resultWrap.hidden = false;
    if (reportEl) {
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
    }

    outputsEl.innerHTML = '';
    for (const output of result.outputs) {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2';
      const name = document.createElement('span');
      name.className = 'truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'btn btn-subtle btn-sm shrink-0';
      save.textContent = 'Save';
      save.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      li.append(name, save);
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

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                 */
  /* ---------------------------------------------------------------------- */

  shareBtn.addEventListener('click', () => void share());
  micBtn.addEventListener('click', () => void toggleMic());
  startBtn.addEventListener('click', () => startRecording());
  stopBtn.addEventListener('click', () => stopRecording());

  const cleanup = () => {
    controller?.abort();
    controller = null;
    stopTimer();
    stopShare();
    micStream?.getTracks().forEach((track) => track.stop());
    micStream = null;
    if (clipUrl) {
      try {
        URL.revokeObjectURL(clipUrl);
      } catch {
        /* ignore */
      }
      clipUrl = null;
    }
  };

  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup, { once: true });

  populateFormats();
  updateControls();
  if (typeof MediaRecorder === 'undefined') {
    fail(
      'This browser cannot record video.',
      'MediaRecorder is missing — try a recent Chrome, Edge, Firefox or Safari.',
    );
  }
}
