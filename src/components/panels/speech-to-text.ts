/**
 * The speech-to-text panel.
 *
 * Handles microphone recording, file upload, Whisper transcription,
 * and export as TXT/SRT/VTT.
 */
import { ToolError } from '@/lib/types';
import type { FileRunResult } from '@/lib/types';
import { downloadBlob } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { transcribeAudio, generateTXT, generateSRT, generateVTT, type WhisperResult } from '@/tools/audio/speech-to-text.core';
import { clearError, showError } from '../workbench/shared';

const TIMESLICE_MS = 1000;

export function mountSpeechToTextWorkbench(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'speech-to-text';

  // Elements
  const modelSelect = root.querySelector<HTMLSelectElement>('[data-stt-model]')!;
  const languageInput = root.querySelector<HTMLInputElement>('[data-stt-language]')!;
  const timestampsCheckbox = root.querySelector<HTMLInputElement>('[data-stt-timestamps]')!;
  const recordBtn = root.querySelector<HTMLButtonElement>('[data-stt-record]')!;
  const recordLabel = root.querySelector<HTMLElement>('[data-stt-record-label]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-stt-stop]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-stt-status]')!;
  const fileInput = root.querySelector<HTMLInputElement>('[data-stt-file]')!;
  const fileWrap = root.querySelector<HTMLElement>('[data-stt-file-wrap]')!;
  const transcriptWrap = root.querySelector<HTMLElement>('[data-stt-transcript-wrap]')!;
  const exportFormatSelect = root.querySelector<HTMLSelectElement>('[data-stt-export-format]')!;
  const exportBtn = root.querySelector<HTMLButtonElement>('[data-stt-export]')!;
  const transcriptEl = root.querySelector<HTMLElement>('[data-stt-transcript]')!;

  if (!modelSelect || !languageInput || !timestampsCheckbox || !recordBtn || !recordLabel ||
      !stopBtn || !statusEl || !fileInput || !fileWrap || !transcriptWrap ||
      !exportFormatSelect || !exportBtn || !transcriptEl) {
    return;
  }

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recordingStartTime = 0;
  let ticker: number | null = null;
  let lastResult: WhisperResult | null = null;
  let busy = false;

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  function stopTicker(): void {
    if (ticker !== null) {
      window.clearInterval(ticker);
      ticker = null;
    }
  }

  function stopStream(): void {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }

  function resetToIdle(message = 'Waiting for permission…'): void {
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
    recorder = null;
    chunks = [];
    stopTicker();
    stopStream();
    recordBtn.setAttribute('aria-pressed', 'false');
    recordBtn.disabled = true;
    recordLabel.textContent = 'Start Recording';
    stopBtn.disabled = true;
    fileInput.value = '';
    transcriptWrap.hidden = true;
    transcriptEl.textContent = '';
    lastResult = null;
    announce(message);
  }

  async function startRecording(): Promise<void> {
    if (busy) return;

    clearError(root);
    busy = true;
    recordBtn.disabled = true;
    announce('Waiting for microphone permission…');

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, { mimeType });
      chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onerror = (e) => {
        console.error('Recorder error:', e);
        announce('Recording error occurred.');
      };

      recorder.start(TIMESLICE_MS);
      recordingStartTime = Date.now();

      recordBtn.setAttribute('aria-pressed', 'true');
      recordLabel.textContent = 'Recording…';
      recordBtn.disabled = true;
      stopBtn.disabled = false;
      fileWrap.hidden = true;

      ticker = window.setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        announce(`Recording — ${formatElapsed(elapsed)}`);
      }, 200);

      announce('Recording — press Stop to finish and transcribe.');
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

  function pickMimeType(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/wav'];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
  }

  async function stopRecording(): Promise<void> {
    if (!recorder || recorder.state !== 'recording') return;

    recorder.stop();
    stopTicker();

    recordBtn.setAttribute('aria-pressed', 'false');
    recordLabel.textContent = 'Start Recording';
    recordBtn.disabled = true;
    stopBtn.disabled = true;

    // Wait for final chunk
    await new Promise<void>((resolve) => {
      if (!recorder) return resolve();
      const handler = () => {
        recorder!.removeEventListener('stop', handler);
        resolve();
      };
      recorder.addEventListener('stop', handler);
      // Fallback timeout
      setTimeout(resolve, 1000);
    });

    const blob = new Blob(chunks, { type: recorder.mimeType });
    const duration = Date.now() - recordingStartTime;

    announce(`Recorded ${formatElapsed(duration)} — transcribing…`);

    await transcribeAndShow(blob);
  }

  async function transcribeAndShow(audioBlob: Blob): Promise<void> {
    try {
      const options = {
        model: modelSelect.value as 'tiny' | 'base',
        timestamps: timestampsCheckbox.checked,
        language: languageInput.value.trim() || '',
      };

      const result = await transcribeAudio(audioBlob, options);
      lastResult = result;

      transcriptEl.textContent = generateTXT(result);
      transcriptWrap.hidden = false;

      announce(`Transcription complete — ${result.text.length} characters.`);
    } catch (err) {
      console.error('Transcription error:', err);
      if (err instanceof ToolError) {
        showError(root, err.message, err.hint);
      } else {
        showError(root, 'Transcription failed', 'The audio may be too short, silent, or in an unsupported format.');
      }
      announce('Transcription failed.');
    }
  }

  async function handleFileUpload(file: File): Promise<void> {
    if (!file.size) {
      showError(root, 'Empty file', 'The selected audio file is empty.');
      return;
    }

    announce('Transcribing uploaded file…');
    fileWrap.hidden = true;

    try {
      const options = {
        model: modelSelect.value as 'tiny' | 'base',
        timestamps: timestampsCheckbox.checked,
        language: languageInput.value.trim() || '',
      };

      const result = await transcribeAudio(file, options);
      lastResult = result;

      transcriptEl.textContent = generateTXT(result);
      transcriptWrap.hidden = false;

      announce(`Transcription complete — ${result.text.length} characters.`);
    } catch (err) {
      console.error('Transcription error:', err);
      if (err instanceof ToolError) {
        showError(root, err.message, err.hint);
      } else {
        showError(root, 'Transcription failed', 'The audio may be too short, silent, or in an unsupported format.');
      }
      announce('Transcription failed.');
      fileWrap.hidden = false;
    }
  }

  function exportTranscript(): void {
    if (!lastResult) return;

    const format = exportFormatSelect.value;
    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'srt':
        content = generateSRT(lastResult);
        mimeType = 'text/plain';
        extension = 'srt';
        break;
      case 'vtt':
        content = generateVTT(lastResult);
        mimeType = 'text/vtt';
        extension = 'vtt';
        break;
      case 'txt':
      default:
        content = generateTXT(lastResult);
        mimeType = 'text/plain';
        extension = 'txt';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const filename = `transcript-${Date.now()}.${extension}`;
    downloadBlob(blob, filename);
    announce(`Exported as ${extension.toUpperCase()}.`);
  }

  // Event listeners
  recordBtn.addEventListener('click', () => {
    if (!stream) {
      void startRecording();
    }
  });

  stopBtn.addEventListener('click', () => {
    if (recorder && recorder.state === 'recording') {
      void stopRecording();
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  });

  exportBtn.addEventListener('click', exportTranscript);

  // Cleanup
  const cleanup = (): void => {
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
    stopTicker();
    stopStream();
  };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('beforeunload', cleanup);

  // Initialize
  void checkMicrophoneSupport();

  async function checkMicrophoneSupport(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some((d) => d.kind === 'audioinput');
      if (!hasMic) {
        announce('No microphone found — you can still upload an audio file.');
        recordBtn.disabled = true;
        recordBtn.hidden = true;
        recordLabel.hidden = true;
      } else {
        recordBtn.disabled = false;
      }
    } catch {
      announce('Microphone access not available — you can still upload an audio file.');
      recordBtn.disabled = true;
      recordBtn.hidden = true;
      recordLabel.hidden = true;
    }
  }
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s % 60).padStart(2, '0')}`;
  return `${s}s`;
}