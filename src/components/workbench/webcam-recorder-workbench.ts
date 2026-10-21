/**
 * The webcam recorder panel.
 *
 * Owns the camera: the permission prompt, the live preview, the record/stop
 * control and the playback preview. The clip is captured with the browser's
 * `MediaRecorder` (there is no such API inside a worker), then handed to the
 * tool itself — `webcam-recorder.tool.ts` — which packages it as the
 * downloadable file.
 *
 * The reusable parts live in `@/tools/video/webcam-recorder-core`: the
 * container choice, the chunk collection, the elapsed-time formatting and the
 * friendly error messages. Nothing here talks to the network.
 */
import { ToolError } from '@/lib/types';
import type { FileRunResult } from '@/lib/types';
import { downloadBlob } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  bitrateForQuality,
  cameraAccessError,
  describeCaptureError,
  describeRecorderError,
  formatElapsed,
  recorderSupportError,
  // Aliased: this module has its own `startRecording()` control below, and the
  // two must not shadow each other.
  startRecording as startMediaRecording,
  type RecordedClip,
  type RecorderFactory,
  type RecordingSession,
} from '@/tools/video/webcam-recorder-core';
import { clearError, showError } from './shared';

/** How often the elapsed time is refreshed, in milliseconds. */
const TICK_MS = 200;

/** How often the browser hands over a chunk of the recording, in milliseconds. */
const TIMESLICE_MS = 1000;

/** Mount the recorder panel into a `[data-webcam-recorder-workbench]` element. */
export function mountWebcamRecorderWorkbench(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'webcam-recorder';
  const video = root.querySelector<HTMLVideoElement>('[data-preview]')!;
  const placeholder = root.querySelector<HTMLElement>('[data-preview-placeholder]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const timerEl = root.querySelector<HTMLElement>('[data-timer]')!;
  const recBadge = root.querySelector<HTMLElement>('[data-rec-badge]')!;
  const startBtn = root.querySelector<HTMLButtonElement>('[data-start]')!;
  const recordBtn = root.querySelector<HTMLButtonElement>('[data-record]')!;
  const cameraOffBtn = root.querySelector<HTMLButtonElement>('[data-camera-off]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-error]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;
  const playback = root.querySelector<HTMLVideoElement>('[data-playback]')!;
  const outputsEl = root.querySelector<HTMLUListElement>('[data-outputs]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-notes]')!;
  const qualitySelect = root.querySelector<HTMLSelectElement>('[data-quality]')!;
  const maxSecondsInput = root.querySelector<HTMLInputElement>('[data-max-seconds]')!;
  const filenameInput = root.querySelector<HTMLInputElement>('[data-filename]')!;

  if (
    !video ||
    !placeholder ||
    !statusEl ||
    !timerEl ||
    !recBadge ||
    !startBtn ||
    !recordBtn ||
    !cameraOffBtn ||
    !errorBox ||
    !resultWrap ||
    !playback ||
    !outputsEl ||
    !notesEl ||
    !qualitySelect ||
    !maxSecondsInput ||
    !filenameInput
  ) {
    return;
  }

  let stream: MediaStream | null = null;
  let session: RecordingSession | null = null;
  let ticker: number | null = null;
  let autoStop: number | null = null;
  let startedAt = 0;
  let playbackUrl: string | null = null;
  let busy = false;

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  function stopTicker(): void {
    if (ticker !== null) {
      window.clearInterval(ticker);
      ticker = null;
    }
    if (autoStop !== null) {
      window.clearTimeout(autoStop);
      autoStop = null;
    }
  }

  function stopStream(): void {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    placeholder.hidden = false;
  }

  /** Turn the camera off and reset the controls to their idle state. */
  function turnCameraOff(message = 'The camera is off.', keepTimer = false): void {
    if (session) {
      session.stop();
      session = null;
    }
    stopTicker();
    recordBtn.setAttribute('aria-pressed', 'false');
    recordBtn.disabled = true;
    recBadge.hidden = true;
    if (!keepTimer) timerEl.textContent = '00:00';
    stopStream();
    startBtn.hidden = false;
    startBtn.disabled = false;
    cameraOffBtn.hidden = true;
    announce(message);
  }

  /* ---------------------------------------------------------------------- */
  /*  Camera                                                                 */
  /* ---------------------------------------------------------------------- */

  async function startCamera(): Promise<void> {
    if (busy) return;
    clearError(errorBox);

    const accessError = cameraAccessError(navigator.mediaDevices);
    if (accessError) {
      showError(errorBox, accessError.message, accessError.hint);
      announce('The camera is not available on this page.');
      return;
    }

    busy = true;
    startBtn.disabled = true;
    announce('Waiting for camera permission…');
    try {
      // Video only — a webcam recorder does not need the microphone.
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream = media;
      video.srcObject = media;
      await video.play().catch(() => undefined);
      placeholder.hidden = true;
      startBtn.hidden = true;
      cameraOffBtn.hidden = false;
      recordBtn.disabled = false;
      announce('Camera on — press Record when you are ready.');
    } catch (err) {
      const toolError = describeCaptureError(err);
      showError(errorBox, toolError.message, toolError.hint);
      announce('The camera could not be started.');
      startBtn.disabled = false;
    } finally {
      busy = false;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Recording                                                              */
  /* ---------------------------------------------------------------------- */

  function recorderFactory(): RecorderFactory {
    return {
      isTypeSupported:
        typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
          ? (type: string) => MediaRecorder.isTypeSupported(type)
          : null,
      create: (stream2, options) => new MediaRecorder(stream2, options),
    };
  }

  function startRecording(): void {
    if (!stream) {
      showError(
        errorBox,
        'Start the camera first.',
        'Press “Start camera”, allow the permission prompt, then press Record.',
      );
      return;
    }
    const supportError = recorderSupportError(
      typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
    );
    if (supportError) {
      showError(errorBox, supportError.message, supportError.hint);
      return;
    }
    clearError(errorBox);

    try {
      session = startMediaRecording(stream, recorderFactory(), {
        videoBitsPerSecond: bitrateForQuality(qualitySelect.value),
        timesliceMs: TIMESLICE_MS,
      });
    } catch (err) {
      const toolError = err instanceof ToolError ? err : describeRecorderError(err);
      showError(errorBox, toolError.message, toolError.hint);
      announce('The recording could not be started.');
      return;
    }

    startedAt = Date.now();
    timerEl.textContent = '00:00';
    recBadge.hidden = false;
    recordBtn.setAttribute('aria-pressed', 'true');
    ticker = window.setInterval(() => {
      timerEl.textContent = formatElapsed(Date.now() - startedAt);
    }, TICK_MS);

    const maxSeconds = Math.max(0, Number(maxSecondsInput.value) || 0);
    if (maxSeconds > 0) {
      autoStop = window.setTimeout(() => {
        void stopRecording();
      }, maxSeconds * 1000);
    }
    announce('Recording — press Record again to stop.');
  }

  async function stopRecording(): Promise<void> {
    const current = session;
    if (!current) return;
    session = null;
    stopTicker();
    recordBtn.setAttribute('aria-pressed', 'false');
    recBadge.hidden = true;

    try {
      current.stop();
      const clip = await current.result();
      timerEl.textContent = formatElapsed(clip.durationMs);
      // The camera is released the moment the recording stops: the tracks are
      // stopped, so the browser's recording indicator goes out.
      turnCameraOff(
        `Recorded ${formatElapsed(clip.durationMs)} in ${clip.container.toUpperCase()} — the clip is ready to play back and save.`,
        true,
      );
      await publish(clip);
    } catch (err) {
      const toolError = err instanceof ToolError ? err : describeRecorderError(err);
      showError(errorBox, toolError.message, toolError.hint);
      turnCameraOff('The camera is off.');
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Publishing the clip                                                    */
  /* ---------------------------------------------------------------------- */

  async function publish(clip: RecordedClip): Promise<void> {
    const file = new File([clip.blob], `recording.${clip.container}`, { type: clip.mimeType });
    let result: FileRunResult;
    try {
      result = await runToolById<FileRunResult>(toolId, {
        files: [file],
        options: {
          quality: qualitySelect.value,
          maxSeconds: Math.max(0, Number(maxSecondsInput.value) || 0),
          filename: filenameInput.value,
        },
      });
    } catch (err) {
      const e = err as Error & { hint?: string };
      showError(errorBox, e.message || 'The recording could not be prepared.', e.hint);
      return;
    }

    resultWrap.hidden = false;
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = URL.createObjectURL(clip.blob);
    playback.src = playbackUrl;
    revealClipDuration(playback);
    renderOutputs(result);
  }

  /**
   * MediaRecorder writes WebM without a duration in the header, so a player
   * shows an endless timeline. Seeking past the end makes the browser work the
   * real duration out; the clip is put back at the start right after.
   */
  function revealClipDuration(el: HTMLVideoElement): void {
    let timer: number | null = null;
    const restore = (): void => {
      el.removeEventListener('seeked', restore);
      if (timer !== null) window.clearTimeout(timer);
      el.currentTime = 0;
    };
    el.addEventListener('seeked', restore, { once: true });
    timer = window.setTimeout(restore, 1000);
    el.currentTime = Number.MAX_SAFE_INTEGER;
  }

  function renderOutputs(result: FileRunResult): void {
    outputsEl.replaceChildren();
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
    notesEl.replaceChildren();
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

  startBtn.addEventListener('click', () => void startCamera());
  cameraOffBtn.addEventListener('click', () => turnCameraOff());
  recordBtn.addEventListener('click', () => {
    if (session) void stopRecording();
    else startRecording();
  });

  const cleanup = (): void => {
    if (session) {
      session.stop();
      session = null;
    }
    stopTicker();
    stopStream();
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      playbackUrl = null;
    }
  };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);
}
