/**
 * The mic-test panel.
 *
 * Handles microphone permission, live level meter, waveform visualization,
 * recording, playback, and download.
 */
import { ToolError } from '@/lib/types';
import type { FileRunResult } from '@/lib/types';
import { downloadBlob } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import {
  type AnalyserLike,
  buildRecordingFilename,
  containerForMimeType,
  cleanupRecording,
  drawWaveform,
  formatDuration,
  formatLevel,
  getAudioLevel,
  pickRecordingMimeType,
  type RecorderFactory,
  type RecordingSession,
  startRecording as startMicRecording,
  stopRecording as stopMicRecording,
} from '@/tools/device/mic-test.core';
import { clearError, showError } from '../workbench/shared';

const TICK_MS = 100;
const FFT_SIZE = 2048;

export function mountMicTestWorkbench(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'mic-test';

  // Elements
  const recordBtn = root.querySelector<HTMLButtonElement>('[data-mic-record]')!;
  const recordLabel = root.querySelector<HTMLElement>('[data-mic-record-label]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-mic-stop]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-mic-status]')!;
  const durationInput = root.querySelector<HTMLInputElement>('[data-mic-duration]')!;
  const waveformCanvas = root.querySelector<HTMLCanvasElement>('[data-mic-waveform]')!;
  const levelEl = root.querySelector<HTMLElement>('[data-mic-level]')!;
  const meterEl = root.querySelector<HTMLElement>('[data-mic-meter]')!;
  const playbackWrap = root.querySelector<HTMLElement>('[data-mic-playback-wrap]')!;
  const audioEl = root.querySelector<HTMLAudioElement>('[data-mic-audio]')!;
  const downloadBtn = root.querySelector<HTMLButtonElement>('[data-mic-download]')!;

  if (!recordBtn || !recordLabel || !stopBtn || !statusEl || !durationInput ||
      !waveformCanvas || !levelEl || !meterEl || !playbackWrap || !audioEl || !downloadBtn) {
    return;
  }

  let stream: MediaStream | null = null;
  let analyser: AnalyserLike | null = null;
  let session: RecordingSession | null = null;
  let ticker: number | null = null;
  let levelTicker: number | null = null;
  let autoStop: number | null = null;
  let playbackUrl: string | null = null;
  let busy = false;

  const dataArray = new Uint8Array(FFT_SIZE);

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  function stopTickers(): void {
    if (ticker !== null) {
      window.clearInterval(ticker);
      ticker = null;
    }
    if (levelTicker !== null) {
      window.clearInterval(levelTicker);
      levelTicker = null;
    }
    if (autoStop !== null) {
      window.clearTimeout(autoStop);
      autoStop = null;
    }
  }

  function stopStream(): void {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (analyser) {
      // AnalyserNode doesn't have a stop method, but we can disconnect
      (analyser as unknown as AudioNode)?.disconnect?.();
      analyser = null;
    }
  }

  function resetToIdle(message = 'Waiting for permission…'): void {
    if (session) {
      cleanupRecording(session);
      session = null;
    }
    stopTickers();
    stopStream();
    recordBtn.setAttribute('aria-pressed', 'false');
    recordBtn.disabled = true;
    recordLabel.textContent = 'Record';
    stopBtn.disabled = true;
    playbackWrap.hidden = true;
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      playbackUrl = null;
    }
    audioEl.src = '';
    levelEl.textContent = '– dB';
    meterEl.style.width = '0%';
    const ctx = waveformCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    announce(message);
  }

  async function startMic(): Promise<void> {
    if (busy) return;

    clearError(root);
    busy = true;
    recordBtn.disabled = true;
    announce('Waiting for microphone permission…');

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // Create audio context and analyser for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = FFT_SIZE;
      source.connect(analyserNode);
      analyser = analyserNode;

      // Enable controls
      recordBtn.disabled = false;
      recordBtn.setAttribute('aria-pressed', 'false');
      stopBtn.disabled = true;
      playbackWrap.hidden = true;

      // Start level meter and waveform animation
      levelTicker = window.setInterval(() => {
        if (!analyser) return;
        const level = getAudioLevel(analyser, dataArray);
        levelEl.textContent = formatLevel(level);
        // Convert dB to 0-100% for meter (roughly -60dB to 0dB)
        const meterPercent = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));
        meterEl.style.width = `${meterPercent}%`;

        // Draw waveform
        drawWaveform(analyser, dataArray, waveformCanvas, waveformCanvas.width, waveformCanvas.height);
      }, 50);

      announce('Microphone ready — press Record to start.');
    } catch (err) {
      const e = err as Error & { name?: string };
      let message = 'Could not access microphone.';
      let hint = 'Check that no other app is using the microphone and try again.';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        message = 'Microphone permission denied.';
        hint = 'Allow microphone access in the browser prompt and reload.';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        message = 'No microphone found.';
        hint = 'Connect a microphone and reload the page.';
      } else if (e.name === 'NotReadableError') {
        message = 'Microphone is in use by another application.';
        hint = 'Close other apps using the microphone and try again.';
      }
      showError(root, message, hint);
      announce('Failed to access microphone.');
      recordBtn.disabled = true;
    } finally {
      busy = false;
    }
  }

  function recorderFactory(): RecorderFactory {
    return {
      isTypeSupported:
        typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
          ? (type: string) => MediaRecorder.isTypeSupported(type)
          : () => false,
      create: (stream2, options) => new MediaRecorder(stream2, options),
    };
  }

  function startRecording(): void {
    if (!stream || !analyser) {
      showError(root, 'Start the microphone first.', 'Wait for the permission prompt and allow access.');
      return;
    }

    const supportError = (() => {
      if (typeof MediaRecorder === 'undefined') {
        return new ToolError('MediaRecorder not supported.', 'Your browser does not support audio recording.');
      }
      return null;
    })();
    if (supportError) {
      showError(root, supportError.message, supportError.hint);
      return;
    }

    clearError(root);

    try {
      session = startMicRecording(stream, recorderFactory(), analyser, {
        defaultDuration: Number(durationInput.value) || 5,
      });
    } catch (err) {
      const toolError = err instanceof ToolError ? err : new ToolError('Recording error', String(err));
      showError(root, toolError.message, toolError.hint);
      announce('The recording could not be started.');
      return;
    }

    recordBtn.setAttribute('aria-pressed', 'true');
    recordLabel.textContent = 'Recording…';
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    playbackWrap.hidden = true;

    // Update elapsed time
    ticker = window.setInterval(() => {
      if (session) {
        const elapsed = Date.now() - session.startTime;
        announce(`Recording — ${formatDuration(elapsed)}`);
      }
    }, TICK_MS);

    // Auto-stop if duration is set
    const duration = Number(durationInput.value) || 5;
    if (duration > 0) {
      autoStop = window.setTimeout(() => {
        void stopRecording();
      }, duration * 1000);
    }

    announce('Recording — press Stop to finish.');
  }

  async function stopRecording(): Promise<void> {
    const current = session;
    if (!current) return;
    session = null;
    stopTickers();

    recordBtn.setAttribute('aria-pressed', 'false');
    recordLabel.textContent = 'Record';
    recordBtn.disabled = true;
    stopBtn.disabled = true;

    try {
      stopMicRecording(current);
      const blob = new Blob(current.chunks, { type: current.recorder.mimeType });
      const container = containerForMimeType(current.recorder.mimeType);
      const filename = buildRecordingFilename(container, new Date(current.startTime), 'mic-recording');

      const duration = current.duration ?? (current.stopTime! - current.startTime);
      announce(`Recorded ${formatDuration(duration)} — preparing download…`);

      // Pass to tool for packaging
      const file = new File([blob], filename, { type: current.recorder.mimeType });

      const result = await runToolById<FileRunResult>(toolId, {
        files: [file],
        options: {
          defaultDuration: Number(durationInput.value) || 5,
          filename: 'mic-recording',
        },
      });

      // Show playback
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      playbackUrl = URL.createObjectURL(blob);
      audioEl.src = playbackUrl;
      playbackWrap.hidden = false;

      downloadBtn.onclick = () => {
        if (result.outputs[0]) {
          downloadBlob(result.outputs[0].blob, result.outputs[0].filename);
        }
      };

      announce(`Recorded ${formatDuration(duration)} — ready to play and download.`);
    } catch (err) {
      const toolError = err instanceof ToolError ? err : new ToolError('Recording error', String(err));
      showError(root, toolError.message, toolError.hint);
      resetToIdle('The recording could not be saved.');
    }
  }

  // Event listeners
  recordBtn.addEventListener('click', () => {
    if (!stream) {
      void startMic();
    } else if (!session) {
      startRecording();
    }
  });

  stopBtn.addEventListener('click', () => {
    if (session) void stopRecording();
  });

  // Cleanup
  const cleanup = (): void => {
    if (session) {
      cleanupRecording(session);
      session = null;
    }
    stopTickers();
    stopStream();
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      playbackUrl = null;
    }
  };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);

  // Initialize
  void startMic();
}