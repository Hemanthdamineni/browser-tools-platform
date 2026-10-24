/**
 * The speech-to-text panel.
 *
 * Pure logic (shared with the tool): timestamp formatting, the SRT/VTT/TXT
 * serialisers, overlapping-segment merging and the length-cap maths — all in
 * this module so they can be unit-tested without a model or a DOM. The model
 * call lives in `speech-to-text.tool.ts` behind an injectable seam.
 *
 * The browser-facing part owns the microphone (`getUserMedia` + `MediaRecorder`)
 * and the file drop zone, then hands the chosen audio to the tool's `run()`
 * through `runToolById`, surfacing the loader's download-size + progress events
 * on the workbench bar.
 */
import type { FileRunResult, OptionValues } from '@/lib/types';
import { createDropZone, downloadBlob } from '@/lib/files';
import { formatBytes, formatDuration } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { applyShowWhen, clearError, readOptions, showError } from '../workbench/shared';
import {
  checkMicEnvironment,
  chooseRecorderMimeType,
  describeMediaError,
  recordingFilename,
} from '@/tools/device/mic-test.core';

/* -------------------------------------------------------------------------- */
/*  Pure logic — testable without a DOM or a model                            */
/* -------------------------------------------------------------------------- */

/** One recognised span of speech, timestamps in seconds. */
export interface TranscriptSegment {
  /** Start of the segment, in seconds. */
  start: number;
  /** End of the segment, in seconds. */
  end: number;
  /** The recognised text, trimmed. */
  text: string;
}

/** The whisper models this tool offers. Both are on the reviewed allow-list. */
export const MODEL_CHOICES = {
  'tiny.en': {
    modelId: 'Xenova/whisper-tiny.en',
    englishOnly: true,
  },
  base: {
    modelId: 'Xenova/whisper-base',
    englishOnly: false,
  },
} as const;

export type ModelChoice = keyof typeof MODEL_CHOICES;

/**
 * Approximate first-run download sizes on the CPU (q8) path, so the UI can warn
 * before it downloads. WebGPU uses fp16 and downloads roughly twice as much;
 * the exact figure is always shown live from the loader's progress events.
 */
export const MODEL_DOWNLOAD_BYTES: Record<ModelChoice, number> = {
  'tiny.en': 40 * 1024 * 1024,
  base: 80 * 1024 * 1024,
};

/** The largest file the tool will decode, in bytes. */
export const MAX_INPUT_BYTES = 64 * 1024 * 1024; // 64 MB
/** The longest recording the tool will transcribe, in seconds. */
export const MAX_INPUT_SECONDS = 600; // 10 minutes

/** Resolve a model choice to its Hub id + language capability. */
export function resolveModel(choice: string): { modelId: string; englishOnly: boolean } {
  return MODEL_CHOICES[choice as ModelChoice] ?? MODEL_CHOICES['tiny.en'];
}

/** Whether the chosen model exposes a language picker. */
export function modelSupportsLanguage(choice: string): boolean {
  return !resolveModel(choice).englishOnly;
}

/** Normalise a whisper chunk into a clean segment. */
export function cleanSegmentText(text: string): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/** Break a timestamp into h/m/s/ms parts, rounding to the nearest millisecond. */
export function timestampParts(seconds: number): { h: number; m: number; s: number; ms: number } {
  const totalMs = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  return {
    h: Math.floor(totalSec / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
    ms,
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const pad3 = (n: number) => String(n).padStart(3, '0');

/**
 * Format a seconds value as `HH:MM:SS,mmm` (SRT) or `HH:MM:SS.mmm` (VTT).
 * Milliseconds round to the nearest integer and carry into the seconds column,
 * so `59.9996` becomes `01:00:00,000` rather than an out-of-range `,1000`.
 */
export function formatTimestamp(seconds: number, sep: ',' | '.'): string {
  const { h, m, s, ms } = timestampParts(seconds);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}${sep}${pad3(ms)}`;
}

/** SRT timestamp: `HH:MM:SS,mmm`. */
export function srtTimestamp(seconds: number): string {
  return formatTimestamp(seconds, ',');
}

/** VTT timestamp: `HH:MM:SS.mmm`. */
export function vttTimestamp(seconds: number): string {
  return formatTimestamp(seconds, '.');
}

/**
 * Serialise segments to SubRip (.srt): a numeric index and `start --> end`
 * line per block, separated from the text by a blank line.
 */
export function segmentsToSrt(segments: readonly TranscriptSegment[]): string {
  return segments
    .map(
      (segment, i) =>
        `${i + 1}\n${srtTimestamp(segment.start)} --> ${srtTimestamp(segment.end)}\n${cleanSegmentText(segment.text)}\n\n`,
    )
    .join('');
}

/** Serialise segments to WebVTT (.vtt): `WEBVTT` header, no numeric indices. */
export function segmentsToVtt(segments: readonly TranscriptSegment[]): string {
  const body = segments
    .map(
      (segment) =>
        `${vttTimestamp(segment.start)} --> ${vttTimestamp(segment.end)}\n${cleanSegmentText(segment.text)}\n\n`,
    )
    .join('');
  return `WEBVTT\n\n${body}`;
}

/** Serialise segments to plain text (.txt): one recognised line per segment. */
export function segmentsToTxt(segments: readonly TranscriptSegment[]): string {
  return segments.map((segment) => cleanSegmentText(segment.text)).join('\n');
}

/**
 * Merge overlapping (or near-overlapping) segments into one, concatenating
 * their text. Whisper's chunked decoding produces chunks that can overlap at
 * the seams, so this folds them back into contiguous lines.
 */
export function mergeOverlappingSegments(
  segments: readonly TranscriptSegment[],
  overlapGraceMs = 50,
): TranscriptSegment[] {
  const grace = overlapGraceMs / 1000;
  const sorted = segments
    .map((s) => ({ start: s.start, end: s.end, text: cleanSegmentText(s.text) }))
    .filter((s) => s.end > s.start && s.text.length > 0)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (sorted.length === 0) return [];

  const out: TranscriptSegment[] = [];
  let current: TranscriptSegment = { ...sorted[0]! };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    if (next.start <= current.end + grace) {
      if (next.end > current.end) current.end = next.end;
      current.text = `${current.text} ${next.text}`.trim();
    } else {
      out.push(current);
      current = { ...next };
    }
  }
  out.push(current);
  return out;
}

/** Cap check on the raw file size, before any decode or download happens. */
export function checkByteCap(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes < 0) return 'That file has no readable size.';
  if (bytes > MAX_INPUT_BYTES) {
    return `That file is larger than the ${formatBytes(MAX_INPUT_BYTES)} cap.`;
  }
  return null;
}

/** Cap check on the decoded recording length, after decode. */
export function checkDurationCap(
  seconds: number,
  maxSeconds: number = MAX_INPUT_SECONDS,
): string | null {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Could not read the recording length.';
  if (seconds > maxSeconds) {
    return `That recording is ${formatDuration(Math.round(seconds * 1000))} long — the cap is ${formatDuration(maxSeconds * 1000)}.`;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                       */
/* -------------------------------------------------------------------------- */

/** The three export files the tool always returns, in display order. */
const OUTPUT_ORDER = ['txt', 'srt', 'vtt'] as const;

/** Mount the speech-to-text panel into a `[data-file-workbench]` element. */
export function mountSpeechToTextPanel(panel: HTMLElement): void {
  const toolId = panel.dataset.toolId || 'speech-to-text';
  const dropEl = panel.querySelector<HTMLElement>('[data-drop]')!;
  const listEl = panel.querySelector<HTMLUListElement>('[data-file-list]')!;
  const micRecordBtn = panel.querySelector<HTMLButtonElement>('[data-mic-record]')!;
  const micStopBtn = panel.querySelector<HTMLButtonElement>('[data-mic-stop]')!;
  const micIndicator = panel.querySelector<HTMLElement>('[data-mic-indicator]')!;
  const micTimerEl = panel.querySelector<HTMLElement>('[data-mic-timer]')!;
  const englishNote = panel.querySelector<HTMLElement>('[data-english-note]');
  const runBtn = panel.querySelector<HTMLButtonElement>('[data-run]')!;
  const cancelBtn = panel.querySelector<HTMLButtonElement>('[data-cancel]')!;
  const errorBox = panel.querySelector<HTMLElement>('[data-error]')!;
  const progressWrap = panel.querySelector<HTMLElement>('[data-progress-wrap]')!;
  const progressBar = panel.querySelector<HTMLElement>('[data-progress-bar]')!;
  const progressMsg = panel.querySelector<HTMLElement>('[data-progress-msg]')!;
  const resultWrap = panel.querySelector<HTMLElement>('[data-result-wrap]')!;
  const transcriptEl = panel.querySelector<HTMLElement>('[data-transcript]')!;
  const outputsEl = panel.querySelector<HTMLElement>('[data-outputs]')!;
  const notesEl = panel.querySelector<HTMLUListElement>('[data-notes]')!;

  if (
    !dropEl ||
    !listEl ||
    !micRecordBtn ||
    !micStopBtn ||
    !micIndicator ||
    !micTimerEl ||
    !runBtn ||
    !cancelBtn ||
    !errorBox ||
    !progressWrap ||
    !progressBar ||
    !progressMsg ||
    !resultWrap ||
    !transcriptEl ||
    !outputsEl ||
    !notesEl
  ) {
    return;
  }

  let file: File | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let micChunks: Blob[] = [];
  let recordingType = 'audio/webm';
  let timerId: number | null = null;
  let recordingStartedAt = 0;

  /* ------------------------------------------------------------------------ */
  /*  Source selection                                                        */
  /* ------------------------------------------------------------------------ */

  function renderFileList(): void {
    listEl.innerHTML = '';
    if (!file) return;
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between gap-3 text-sm';
    const label = document.createElement('span');
    label.className = 'min-w-0 truncate';
    label.textContent = `${file.name} (${formatBytes(file.size)})`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-ghost btn-sm';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', () => {
      file = null;
      renderFileList();
      updateRunState();
    });
    li.append(label, remove);
    listEl.append(li);
  }

  function chooseFile(next: File | null): void {
    if (!next) return;
    const capError = checkByteCap(next.size);
    if (capError) {
      showError(errorBox, capError, `Choose a file under ${formatBytes(MAX_INPUT_BYTES)}.`);
      return;
    }
    file = next;
    micChunks = [];
    clearError(errorBox);
    renderFileList();
    updateRunState();
  }

  function updateRunState(): void {
    runBtn.disabled = !file;
  }

  /* ------------------------------------------------------------------------ */
  /*  Model options: download-size hint + the English-only notice              */
  /* ------------------------------------------------------------------------ */

  const modelSelect = panel.querySelector<HTMLSelectElement>('[data-opt-key="model"]');
  const downloadHint = panel.querySelector<HTMLElement>('[data-download-hint]');

  function refreshModelHints(): void {
    const choice = (modelSelect?.value ?? 'tiny.en') as ModelChoice;
    if (englishNote) englishNote.hidden = modelSupportsLanguage(choice);
    if (downloadHint) {
      downloadHint.textContent = `First run downloads the model (about ${formatBytes(MODEL_DOWNLOAD_BYTES[choice])}, or more on WebGPU). The exact size is shown while it loads, and it is cached afterwards.`;
    }
  }

  panel.addEventListener('change', () => {
    applyShowWhen(panel);
    refreshModelHints();
  });
  refreshModelHints();
  applyShowWhen(panel);

  /** Fill the option controls from an example's option bag. */
  function applyValues(values: OptionValues): void {
    for (const [key, value] of Object.entries(values)) {
      const field = panel.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(`[data-opt-key="${key}"]`);
      if (!field) continue;
      if (field.dataset.optType === 'boolean') {
        (field as HTMLInputElement).checked = value === true || value === 'true';
      } else {
        field.value = String(value);
      }
    }
    applyShowWhen(panel);
    refreshModelHints();
  }

  for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-example]')) {
    button.addEventListener('click', () => {
      const parsed: unknown = JSON.parse(button.dataset.exampleOptions ?? '{}');
      if (!parsed || typeof parsed !== 'object') return;
      applyValues(parsed as OptionValues);
    });
  }

  createDropZone(dropEl, {
    accept: 'audio/*',
    multiple: false,
    onFiles: (files) => chooseFile(files[0] ?? null),
  });

  /* ------------------------------------------------------------------------ */
  /*  Microphone                                                              */
  /* ------------------------------------------------------------------------ */

  function stopMicStream(): void {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  function setMicUi(recording: boolean): void {
    micRecordBtn.hidden = recording;
    micStopBtn.hidden = !recording;
    micIndicator.hidden = !recording;
    if (recording) micTimerEl.textContent = '0:00';
  }

  function finishMicRecording(): void {
    const blob = new Blob(micChunks, { type: recordingType });
    micChunks = [];
    chooseFile(new File([blob], recordingFilename('recording', recordingType), { type: recordingType }));
  }

  micRecordBtn.addEventListener('click', async () => {
    const blocker = checkMicEnvironment({
      secureContext: window.isSecureContext,
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
      hasMediaRecorder: typeof window.MediaRecorder !== 'undefined',
    });
    if (blocker) {
      showError(errorBox, blocker.message, blocker.hint);
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const info = describeMediaError(error);
      showError(errorBox, info.message, info.hint);
      return;
    }
    const format = chooseRecorderMimeType((mimeType) => {
      try {
        return typeof window.MediaRecorder !== 'undefined' && window.MediaRecorder.isTypeSupported(mimeType);
      } catch {
        return false;
      }
    });
    if (!format) {
      stopMicStream();
      showError(errorBox, 'This browser cannot record audio in a format the tool can transcribe.', 'Try a recent Chrome, Edge, Firefox or Safari.');
      return;
    }
    let next: MediaRecorder;
    try {
      next = new MediaRecorder(stream, { mimeType: format.mimeType });
    } catch {
      stopMicStream();
      showError(errorBox, 'The browser refused to start the recorder.', 'Try again, or restart the browser.');
      return;
    }
    recorder = next;
    recordingType = format.mimeType;
    micChunks = [];
    next.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) micChunks.push(event.data);
    };
    next.onstop = () => finishMicRecording();
    next.onerror = () => showError(errorBox, 'The recording failed.', 'Press “Record” again.');
    next.start(250);

    clearError(errorBox);
    setMicUi(true);
    recordingStartedAt = performance.now();
    timerId = window.setInterval(() => {
      const totalSec = Math.floor(Math.max(0, performance.now() - recordingStartedAt) / 1000);
      micTimerEl.textContent = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
    }, 100);
  });

  micStopBtn.addEventListener('click', () => {
    const current = recorder;
    recorder = null;
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
    setMicUi(false);
    current?.stop();
    stopMicStream();
  });

  /* ------------------------------------------------------------------------ */
  /*  Run                                                                      */
  /* ------------------------------------------------------------------------ */

  function setRunning(running: boolean): void {
    runBtn.disabled = running || !file;
    cancelBtn.hidden = !running;
    micRecordBtn.disabled = running;
  }

  function renderOutputs(result: FileRunResult): void {
    resultWrap.hidden = false;
    transcriptEl.textContent = result.report?.output ?? '';
    outputsEl.innerHTML = '';
    for (const format of OUTPUT_ORDER) {
      const output = result.outputs.find((o) => o.filename.toLowerCase().endsWith(`.${format}`));
      if (!output) continue;
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      const name = document.createElement('span');
      name.className = 'min-w-0 flex-1 truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'btn btn-subtle btn-sm';
      download.textContent = 'Save';
      download.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      row.append(name, download);
      outputsEl.append(row);
    }
    notesEl.innerHTML = '';
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      li.textContent = note;
      notesEl.append(li);
    }
  }

  runBtn.addEventListener('click', () => {
    if (!file) return;
    const options = readOptions(panel);
    controller?.abort();
    controller = new AbortController();
    const generation = ++runGeneration;
    clearError(errorBox);
    resultWrap.hidden = true;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    progressMsg.textContent = 'Decoding the audio…';
    setRunning(true);

    runToolById<FileRunResult>(
      toolId,
      { files: [file], options },
      {
        signal: controller.signal,
        onProgress: (fraction, message) => {
          if (generation !== runGeneration) return;
          const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
          progressBar.style.width = `${pct}%`;
          if (message) progressMsg.textContent = message;
        },
      },
    )
      .then((result) => {
        if (generation !== runGeneration) return;
        progressWrap.hidden = true;
        setRunning(false);
        renderOutputs(result);
      })
      .catch((error: Error & { hint?: string }) => {
        if (generation !== runGeneration) return;
        progressWrap.hidden = true;
        setRunning(false);
        if (error.name === 'AbortError') return;
        showError(errorBox, error.message || 'Transcription failed.', error.hint);
      });
  });

  cancelBtn.addEventListener('click', () => {
    controller?.abort();
    controller = null;
    progressWrap.hidden = true;
    setRunning(false);
  });

  updateRunState();
}