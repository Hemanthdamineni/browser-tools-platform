/**
 * The screen-recorder panel.
 *
 * Handles screen sharing, recording via MediaRecorder, and hands the finished
 * clip to the tool module for download. Reuses the shared recording machinery
 * from webcam-recorder-core.
 */
import { ToolError } from '@/lib/types';
import type { FileRunResult } from '@/lib/types';
import { downloadBlob } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  bitrateForQuality,
  describeCaptureError,
  describeRecorderError,
  formatElapsed,
  listCameras,
  recorderSupportError,
  requestCamera,
  startRecording as startMediaRecording,
  type MediaDevicesLike,
  type RecordedClip,
  type RecorderFactory,
  type RecordingSession,
} from '@/tools/video/webcam-recorder-core';
import {
  displayMediaOptionsForSurface,
  requestScreen,
  addMicrophoneTrack,
  screenCaptureError,
  describeScreenCaptureError,
} from '@/tools/video/screen-recorder.core';
import { clearError, showError } from '../workbench/shared';

const TICK_MS = 200;
const TIMESLICE_MS = 1000;

export function mountScreenRecorderWorkbench(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'screen-recorder';

  // Elements
  const video = root.querySelector<HTMLVideoElement>('[data-screen-preview]')!;
  const sourceSelect = root.querySelector<HTMLSelectElement>('[data-screen-source]')!;
  const audioSelect = root.querySelector<HTMLSelectElement>('[data-screen-audio]')!;
  const mimeSelect = root.querySelector<HTMLSelectElement>('[data-screen-mime]')!;
  const recordBtn = root.querySelector<HTMLButtonElement>('[data-screen-record]')!;
  const recordLabel = root.querySelector<HTMLElement>('[data-screen-record-label]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-screen-stop]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-screen-status]')!;
  const downloadWrap = root.querySelector<HTMLElement>('[data-screen-download-wrap]')!;
  const downloadBtn = root.querySelector<HTMLButtonElement>('[data-screen-download]')!;

  if (!video || !sourceSelect || !audioSelect || !mimeSelect || !recordBtn || !recordLabel || !stopBtn || !statusEl || !downloadWrap || !downloadBtn) {
    return;
  }

  let displayStream: MediaStream | null = null;
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

  function stopStreams(): void {
    displayStream?.getTracks().forEach((track) => track.stop());
    displayStream = null;
    video.srcObject = null;
  }

  function resetToIdle(message = 'Waiting for permission…'): void {
    if (session) {
      session.stop();
      session = null;
    }
    stopTicker();
    stopStreams();
    recordBtn.setAttribute('aria-pressed', 'false');
    recordBtn.disabled = true;
    recordLabel.textContent = 'Start Recording';
    stopBtn.disabled = true;
    downloadWrap.hidden = true;
    video.hidden = true;
    video.src = '';
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      playbackUrl = null;
    }
    announce(message);
  }

  async function checkScreenCaptureSupport(): Promise<boolean> {
    const error = screenCaptureError(navigator.mediaDevices);
    if (error) {
      showError(root, error.message, error.hint);
      return false;
    }
    return true;
  }

  async function startDisplayCapture(): Promise<void> {
    if (busy) return;

    const accessError = screenCaptureError(navigator.mediaDevices);
    if (accessError) {
      showError(root, accessError.message, accessError.hint);
      announce('Screen capture is not available on this page.');
      return;
    }

    busy = true;
    recordBtn.disabled = true;
    announce('Waiting for screen sharing permission…');

    try {
      const surface = sourceSelect.value === 'tab' ? '' : sourceSelect.value;
      displayStream = await requestScreen(navigator.mediaDevices as unknown as ScreenCaptureDevicesLike, { surface });

      // Handle audio selection
      if (audioSelect.value === 'mic') {
        displayStream = await addMicrophoneTrack(displayStream, navigator.mediaDevices, { mic: true });
      } else if (audioSelect.value === 'system') {
        // System audio is included in the display stream if the user checked it in the share picker
        // The share picker handles this; we don't need to do anything extra here
      }

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        video.srcObject = displayStream;
        await video.play().catch(() => undefined);
        video.hidden = false;
      }

      recordBtn.disabled = false;
      stopBtn.disabled = true;
      announce('Screen sharing started — press Record to begin recording.');

      // Notify user about stopping screen share
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (session) {
          void stopRecording();
        } else {
          resetToIdle('Screen sharing ended.');
        }
      });
    } catch (err) {
      const toolError = describeScreenCaptureError(err);
      showError(root, toolError.message, toolError.hint);
      announce('Screen sharing was cancelled or failed.');
      recordBtn.disabled = false;
    } finally {
      busy = false;
    }
  }

  function recorderFactory(): RecorderFactory {
    return {
      isTypeSupported:
        typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
          ? (type: string) => MediaRecorder.isTypeSupported(type)
          : null,
      create: (stream, options) => new MediaRecorder(stream, options),
    };
  }

  function startRecording(): void {
    if (!displayStream) {
      showError(
        root,
        'Start screen sharing first.',
        'Press “Share screen”, pick a screen or window, then press Record.',
      );
      return;
    }

    const supportError = recorderSupportError(
      typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
    );
    if (supportError) {
      showError(root, supportError.message, supportError.hint);
      return;
    }
    clearError(root);

    const quality = 'balanced'; // could add quality selector later

    try {
      session = startMediaRecording(displayStream, recorderFactory(), {
        videoBitsPerSecond: bitrateForQuality(quality),
        timesliceMs: TIMESLICE_MS,
      });
    } catch (err) {
      const toolError = err instanceof ToolError ? err : describeRecorderError(err);
      showError(root, toolError.message, toolError.hint);
      announce('The recording could not be started.');
      return;
    }

    startedAt = Date.now();
    recordBtn.setAttribute('aria-pressed', 'true');
    recordLabel.textContent = 'Recording…';
    recordBtn.disabled = true;
    stopBtn.disabled = false;

    ticker = window.setInterval(() => {
      announce(`Recording — ${formatElapsed(Date.now() - startedAt)}`);
    }, TICK_MS);

    announce('Recording — press Stop to finish.');
  }

  async function stopRecording(): Promise<void> {
    const current = session;
    if (!current) return;
    session = null;
    stopTicker();

    recordBtn.setAttribute('aria-pressed', 'false');
    recordLabel.textContent = 'Start Recording';
    recordBtn.disabled = true;
    stopBtn.disabled = true;

    try {
      current.stop();
      const clip = await current.result();

      // Stop the display stream tracks (this turns off the browser's recording indicator)
      stopStreams();

      announce(`Recorded ${formatElapsed(clip.durationMs)} — preparing download…`);

      // Pass to tool for packaging
      const file = new File([clip.blob], `recording.${clip.container}`, { type: clip.mimeType });

      const result = await runToolById<FileRunResult>(toolId, {
        files: [file],
        options: {
          surface: sourceSelect.value,
          mic: audioSelect.value,
          quality: 'balanced',
          filename: 'screen-recording',
        },
      });

      // Show playback
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      playbackUrl = URL.createObjectURL(clip.blob);
      video.src = playbackUrl;
      video.hidden = false;

      downloadWrap.hidden = false;
      downloadBtn.onclick = () => {
        if (result.outputs[0]) {
          downloadBlob(result.outputs[0].blob, result.outputs[0].filename);
        }
      };

      announce(`Recorded ${formatElapsed(clip.durationMs)} — ready to download.`);
    } catch (err) {
      const toolError = err instanceof ToolError ? err : describeRecorderError(err);
      showError(root, toolError.message, toolError.hint);
      resetToIdle('The recording could not be saved.');
    }
  }

  // Initialize
  sourceSelect.addEventListener('change', () => {
    if (displayStream) {
      // Re-start screen sharing with new source
      if (session) void stopRecording();
      resetToIdle('Source changed — click Share screen again.');
    }
  });

  audioSelect.addEventListener('change', () => {
    if (displayStream && audioSelect.value === 'mic') {
      // We'll add mic when recording starts
    }
  });

  recordBtn.addEventListener('click', () => {
    if (!displayStream) {
      void startDisplayCapture();
    } else if (!session) {
      startRecording();
    }
  });

  stopBtn.addEventListener('click', () => {
    if (session) void stopRecording();
  });

  const cleanup = (): void => {
    if (session) {
      session.stop();
      session = null;
    }
    stopTicker();
    stopStreams();
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      playbackUrl = null;
    }
  };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);

  // Initial support check
  void checkScreenCaptureSupport();
}

// Type for screen capture devices
interface ScreenCaptureDevicesLike {
  getDisplayMedia?: (options?: DisplayMediaStreamOptions | undefined) => Promise<MediaStream>;
}