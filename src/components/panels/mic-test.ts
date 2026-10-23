/**
 * Microphone test panel: level meter, waveform, recorder and playback.
 *
 * Loaded on demand by `mic-test.astro` so no microphone code ships to pages
 * that don't test one. Everything here is local: the stream goes into an
 * AnalyserNode (never to the speakers) and, while recording, into a
 * MediaRecorder. Nothing is stored or transmitted; the take is handed to the
 * tool's own `run()` through `runToolById` for the summary.
 */
import type { FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { capabilities } from '@/lib/capabilities';
import { downloadBlob } from '@/lib/files';
import { formatBytes, formatDuration } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { clearError, renderTextResult, showError } from '../workbench/shared';
import {
  analyserBytesToFloat,
  dbToFraction,
  describeMicError,
  formatDb,
  levelVerdict,
  meterSettings,
  pickRecorderMime,
  readingFromLevels,
  readingOf,
  readingOfChannels,
  recorderFilename,
  type LevelTone,
  type MeterReading,
  type MicMetrics,
} from '@/tools/device/mic-test.core';

/** Codecs tried in order; empty means "let the browser choose its default". */
const PREFERRED_MIME = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
];

/** How often MediaRecorder flushes a chunk, so a take survives a crash. */
const CHUNK_MS = 250;

const TONE_COLOR: Record<LevelTone, string> = {
  unknown: 'rgb(var(--text-muted))',
  silent: 'rgb(var(--text-muted))',
  quiet: 'rgb(var(--warning))',
  good: 'rgb(var(--success))',
  loud: 'rgb(var(--warning))',
  clip: 'rgb(var(--danger))',
};

function createAudioContext(): AudioContext {
  // Safari still exposes the constructor under the webkit-prefixed name.
  const prefixed = window as unknown as { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? prefixed.webkitAudioContext;
  if (!Ctor) {
    throw new ToolError(
      'This browser has no Web Audio API.',
      'The level meter needs AudioContext — try a current version of Chrome, Edge, Firefox or Safari.',
    );
  }
  return new Ctor();
}

/** Message + hint from anything `runToolById` may reject with. */
function errorText(err: unknown, fallback: string): { message: string; hint?: string } {
  if (!(err instanceof Error)) return { message: fallback };
  if ('hint' in err && typeof err.hint === 'string')
    return { message: err.message, hint: err.hint };
  return { message: err.message || fallback };
}

/** Resolve a design token (`--accent`) to a concrete colour a canvas can use. */
function cssColor(name: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `rgb(${raw} / ${alpha})` : `rgb(120 120 120 / ${alpha})`;
}

/** Mount the microphone UI into a `[data-mic-test-panel]` element. */
export function mountMicPanel(panel: HTMLElement): void {
  // Astro always renders these; the guard keeps a markup change from crashing.
  const startBtn = panel.querySelector<HTMLButtonElement>('[data-mic-start]');
  const recordBtn = panel.querySelector<HTMLButtonElement>('[data-mic-record]');
  const stopBtn = panel.querySelector<HTMLButtonElement>('[data-mic-stop]');
  const resetBtn = panel.querySelector<HTMLButtonElement>('[data-mic-reset]');
  const status = panel.querySelector<HTMLElement>('[data-mic-status]');
  const errorBox = panel.querySelector<HTMLElement>('[data-mic-error]');
  const meterWrap = panel.querySelector<HTMLElement>('[data-mic-meter-wrap]');
  const results = panel.querySelector<HTMLElement>('[data-mic-results]');
  if (!startBtn || !recordBtn || !stopBtn || !resetBtn || !status || !errorBox || !results) return;

  const canvas = panel.querySelector<HTMLCanvasElement>('[data-mic-waveform]');
  const peakFill = panel.querySelector<HTMLElement>('[data-mic-peak-fill]');
  const rmsFill = panel.querySelector<HTMLElement>('[data-mic-rms-fill]');
  const peakDbEl = panel.querySelector<HTMLElement>('[data-mic-peak-db]');
  const rmsDbEl = panel.querySelector<HTMLElement>('[data-mic-rms-db]');
  const verdictEl = panel.querySelector<HTMLElement>('[data-mic-verdict]');
  const timerEl = panel.querySelector<HTMLElement>('[data-mic-timer]');
  const playbackWrap = panel.querySelector<HTMLElement>('[data-mic-playback]');
  const audio = panel.querySelector<HTMLAudioElement>('[data-mic-audio]');
  const deviceSelect = panel.querySelector<HTMLSelectElement>('[data-mic-device]');
  const deviceWrap = panel.querySelector<HTMLElement>('[data-mic-device-wrap]');
  const fftSelect = panel.querySelector<HTMLSelectElement>('[data-mic-fft]');
  const smoothingInput = panel.querySelector<HTMLInputElement>('[data-mic-smoothing]');
  const floorInput = panel.querySelector<HTMLInputElement>('[data-mic-floor]');
  const limitInput = panel.querySelector<HTMLInputElement>('[data-mic-limit]');
  const toolId = panel.dataset.toolId || 'mic-test';

  /* ---------------------------------------------------------------------- */
  /*  State                                                                 */
  /* ---------------------------------------------------------------------- */

  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let waveBuf = new Float32Array(2048);
  let byteBuf = new Uint8Array(2048);
  let frameHandle = 0;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recording = false;
  let startedAt = 0;
  let autoStop = 0;
  let objectUrl: string | null = null;
  let activeDeviceId = '';
  let busy = false;
  /**
   * Bumped by Reset. A take that finishes after a reset belongs to an older
   * generation and must not repaint the (now cleared) panel.
   */
  let generation = 0;
  let takeGeneration = 0;
  /** Peak / energy accumulated while recording, used if the take cannot be decoded. */
  let livePeak = 0;
  let liveEnergy = 0;
  let liveFrames = 0;

  const options = () => ({
    fftSize: fftSelect?.value ?? '2048',
    smoothing: Number(smoothingInput?.value ?? 0.6),
    floorDb: Number(floorInput?.value ?? -80),
    maxSeconds: Number(limitInput?.value ?? 60),
  });
  let settings = meterSettings(options());

  const announce = (message: string) => {
    status.textContent = message;
  };

  /* ---------------------------------------------------------------------- */
  /*  Meter                                                                 */
  /* ---------------------------------------------------------------------- */

  function applySettings(): void {
    settings = meterSettings(options());
    if (analyser) {
      analyser.fftSize = settings.fftSize;
      analyser.smoothingTimeConstant = settings.smoothing;
    }
    waveBuf = new Float32Array(settings.fftSize);
    byteBuf = new Uint8Array(settings.fftSize);
  }

  function timeDomainData(node: AnalyserNode): Float32Array {
    if (typeof node.getFloatTimeDomainData === 'function' && waveBuf.length === node.fftSize) {
      node.getFloatTimeDomainData(waveBuf);
      return waveBuf;
    }
    if (byteBuf.length !== node.fftSize) byteBuf = new Uint8Array(node.fftSize);
    node.getByteTimeDomainData(byteBuf);
    return analyserBytesToFloat(byteBuf);
  }

  function paintMeter(reading: MeterReading): void {
    const width = (db: number) => `${(dbToFraction(db, settings.floorDb) * 100).toFixed(1)}%`;
    if (peakFill) peakFill.style.width = width(reading.peakDb);
    if (rmsFill) rmsFill.style.width = width(reading.rmsDb);
    if (peakDbEl) peakDbEl.textContent = formatDb(reading.peakDb);
    if (rmsDbEl) rmsDbEl.textContent = formatDb(reading.rmsDb);
    if (verdictEl) {
      const verdict = levelVerdict(reading);
      verdictEl.textContent = verdict.label;
      verdictEl.style.color = TONE_COLOR[verdict.tone];
      verdictEl.title = verdict.advice;
    }
  }

  function resetMeter(): void {
    paintMeter({ peak: 0, rms: 0, peakDb: -Infinity, rmsDb: -Infinity });
    if (verdictEl && !analyser) {
      verdictEl.textContent = 'Waiting for the microphone…';
      verdictEl.style.color = '';
      verdictEl.removeAttribute('title');
    }
    if (timerEl) timerEl.textContent = '';
    const c2d = canvas?.getContext('2d');
    if (canvas && c2d) c2d.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawWaveform(samples: Float32Array): void {
    if (!canvas) return;
    const c2d = canvas.getContext('2d');
    if (!c2d) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (width < 2 || height < 2) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    c2d.clearRect(0, 0, width, height);
    const mid = height / 2;

    c2d.lineWidth = Math.max(1, height / 64);
    c2d.strokeStyle = cssColor('--border', 0.9);
    c2d.beginPath();
    c2d.moveTo(0, mid);
    c2d.lineTo(width, mid);
    c2d.stroke();

    c2d.strokeStyle = cssColor('--accent');
    c2d.beginPath();
    const perPixel = samples.length / width;
    for (let x = 0; x < width; x++) {
      const value = samples[Math.min(samples.length - 1, Math.floor(x * perPixel))] ?? 0;
      const clamped = Math.max(-1, Math.min(1, value));
      const y = mid - clamped * mid * 0.92;
      if (x === 0) c2d.moveTo(x, y);
      else c2d.lineTo(x, y);
    }
    c2d.stroke();
  }

  function tick(): void {
    frameHandle = window.requestAnimationFrame(tick);
    if (!analyser) return;
    const samples = timeDomainData(analyser);
    const reading = readingOf(samples);
    if (reading.peak > livePeak) livePeak = reading.peak;
    if (recording) {
      liveEnergy += reading.rms * reading.rms;
      liveFrames++;
      if (timerEl) timerEl.textContent = formatDuration(performance.now() - startedAt);
    }
    paintMeter(reading);
    drawWaveform(samples);
  }

  function startLoop(): void {
    if (!frameHandle) frameHandle = window.requestAnimationFrame(tick);
  }

  function stopLoop(): void {
    if (frameHandle) window.cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }

  /* ---------------------------------------------------------------------- */
  /*  Microphone                                                            */
  /* ---------------------------------------------------------------------- */

  function releaseStream(): void {
    sourceNode?.disconnect();
    sourceNode = null;
    analyser?.disconnect();
    analyser = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  function revokeObjectUrl(): void {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  async function populateDevices(): Promise<void> {
    if (!deviceSelect || !deviceWrap || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === 'audioinput');
      if (inputs.length < 2) {
        deviceWrap.hidden = true;
        return;
      }
      deviceSelect.replaceChildren();
      inputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${index + 1}`;
        option.selected = device.deviceId === activeDeviceId;
        deviceSelect.appendChild(option);
      });
      deviceWrap.hidden = false;
    } catch {
      /* device labels are optional */
    }
  }

  async function start(deviceId = ''): Promise<void> {
    if (busy) return;
    busy = true;
    clearError(errorBox!);
    startBtn!.disabled = true;
    announce('Requesting microphone permission…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('getUserMedia is unavailable'), { name: 'TypeError' });
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          // A mic test should hear what the microphone actually hears, so the
          // browser's speech processing is switched off.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      stream = media;
      const track = media.getAudioTracks()[0];
      const trackId = track?.getSettings?.().deviceId;
      activeDeviceId = trackId ?? deviceId;

      context = context ?? createAudioContext();
      if (context.state === 'suspended') await context.resume().catch(() => undefined);
      sourceNode?.disconnect();
      analyser?.disconnect();
      analyser = context.createAnalyser();
      applySettings();
      sourceNode = context.createMediaStreamSource(media);
      sourceNode.connect(analyser);
      // Deliberately not connected to context.destination — monitoring on the
      // speakers would feed back into the microphone.

      releaseLive();
      meterWrap!.hidden = false;
      startBtn!.hidden = true;
      recordBtn!.hidden = false;
      resetBtn!.hidden = false;
      announce(
        `Microphone live at ${Math.round(context.sampleRate / 1000)} kHz — speak and watch the meter.`,
      );
      startLoop();
      void populateDevices();
    } catch (err) {
      const described = err instanceof ToolError ? err : describeMicError(err);
      showError(errorBox!, described.message, described.hint);
      announce('The microphone could not be started.');
      startBtn!.disabled = false;
      releaseStream();
    } finally {
      busy = false;
    }
  }

  function releaseLive(): void {
    livePeak = 0;
    liveEnergy = 0;
    liveFrames = 0;
  }

  /* ---------------------------------------------------------------------- */
  /*  Recording                                                             */
  /* ---------------------------------------------------------------------- */

  function startRecording(): void {
    if (recording || !stream) return;
    if (!capabilities.mediaRecorder || typeof MediaRecorder === 'undefined') {
      showError(
        errorBox!,
        'This browser cannot record audio.',
        'MediaRecorder is unavailable here — the level meter and waveform still work.',
      );
      return;
    }
    clearError(errorBox!);
    const mime = pickRecorderMime(PREFERRED_MIME, (type) => MediaRecorder.isTypeSupported(type));
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128_000 })
        : new MediaRecorder(stream);
    } catch (err) {
      const described = describeMicError(err);
      showError(errorBox!, described.message, described.hint);
      recorder = null;
      return;
    }

    chunks = [];
    releaseLive();
    startedAt = performance.now();
    recording = true;
    takeGeneration = generation;
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener('error', () => {
      showError(errorBox!, 'The recorder stopped unexpectedly.', 'Try recording again.');
      stopRecording();
    });
    recorder.addEventListener('stop', () => void finishRecording());
    recorder.start(CHUNK_MS);

    recordBtn!.hidden = true;
    stopBtn!.hidden = false;
    stopBtn!.disabled = false;
    announce('Recording…');
    if (timerEl) timerEl.textContent = formatDuration(0);
    autoStop = window.setTimeout(() => {
      if (!recording) return;
      announce(`Reached the ${settings.maxSeconds} s limit — recording stopped.`);
      stopRecording();
    }, settings.maxSeconds * 1000);
  }

  function stopRecording(): void {
    if (!recording) return;
    recording = false;
    window.clearTimeout(autoStop);
    autoStop = 0;
    stopBtn!.hidden = true;
    recordBtn!.hidden = false;
    recordBtn!.disabled = true;
    announce('Finishing the recording…');
    try {
      recorder?.stop();
    } catch {
      /* already stopped */
    }
  }

  function liveReading(): MeterReading {
    const rms = liveFrames > 0 ? Math.sqrt(liveEnergy / liveFrames) : 0;
    return readingFromLevels(livePeak, rms);
  }

  /** Decode the take so the summary reports real peak/RMS rather than the meter's. */
  async function measure(blob: Blob, durationMs: number): Promise<MicMetrics> {
    const metrics: MicMetrics = {
      durationMs,
      format: blob.type || 'audio/webm',
      channels: 1,
    };
    const label =
      deviceSelect && !deviceWrap?.hidden ? deviceSelect.selectedOptions[0]?.textContent : '';
    if (label) metrics.deviceLabel = label.trim();
    const decoded = await decodeLevels(blob);
    if (decoded) {
      metrics.peak = decoded.reading.peak;
      metrics.rms = decoded.reading.rms;
      metrics.channels = decoded.channels;
      metrics.sampleRate = decoded.sampleRate;
      metrics.durationMs = decoded.durationMs;
      return metrics;
    }
    const live = liveReading();
    metrics.peak = live.peak;
    metrics.rms = live.rms;
    if (context) metrics.sampleRate = context.sampleRate;
    return metrics;
  }

  async function decodeLevels(blob: Blob): Promise<
    | {
        reading: MeterReading;
        channels: number;
        sampleRate: number;
        durationMs: number;
      }
    | undefined
  > {
    if (!context) return undefined;
    try {
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      const channels: Float32Array[] = [];
      for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
      return {
        reading: readingOfChannels(channels),
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        durationMs: Math.round(buffer.duration * 1000),
      };
    } catch {
      // Some codecs cannot be decoded back (rare, but possible right after
      // recording); the live meter measurements stand in.
      return undefined;
    }
  }

  async function finishRecording(): Promise<void> {
    const mimeType = recorder?.mimeType || chunks[0]?.type || 'audio/webm';
    const blob = new Blob(chunks, { type: mimeType });
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    chunks = [];
    recorder = null;

    if (takeGeneration !== generation) {
      // Reset while the recorder was stopping — the panel is already cleared.
      recordBtn!.disabled = false;
      return;
    }

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(blob);
    if (audio) audio.src = objectUrl;
    if (playbackWrap) playbackWrap.hidden = false;
    recordBtn!.disabled = false;

    const filename = recorderFilename(mimeType);
    const metrics = await measure(blob, durationMs);
    if (takeGeneration !== generation) return;
    const verdict = levelVerdict(readingFromLevels(metrics.peak ?? 0, metrics.rms ?? 0));
    announce(
      `Recorded ${formatDuration(metrics.durationMs ?? durationMs)} (${formatBytes(blob.size)}) — ${verdict.label}.`,
    );
    await summarise(blob, filename, metrics);
  }

  /* ---------------------------------------------------------------------- */
  /*  Summary                                                               */
  /* ---------------------------------------------------------------------- */

  async function summarise(blob: Blob, filename: string, metrics: MicMetrics): Promise<void> {
    results!.replaceChildren(placeholder('Analysing the recording…'));
    const file = new File([blob], filename, { type: blob.type || 'audio/webm' });
    try {
      const result = await runToolById<FileRunResult>(toolId, {
        files: [file],
        options: options(),
        metrics,
      });
      if (takeGeneration !== generation) return;
      renderResult(result);
    } catch (err) {
      results!.replaceChildren();
      const described = errorText(err, 'The recording could not be summarised');
      showError(errorBox!, described.message, described.hint);
    }
  }

  function placeholder(text: string): HTMLElement {
    const p = document.createElement('p');
    p.className = 'text-sm text-[rgb(var(--text-muted))]';
    p.textContent = text;
    return p;
  }

  function renderResult(result: FileRunResult): void {
    results!.replaceChildren();
    if (result.report) {
      const host = document.createElement('div');
      results!.appendChild(host);
      renderTextResult(host, {
        output: result.report.output,
        render: result.report.render,
        language: result.report.language,
      });
    }
    for (const warning of result.warnings ?? []) {
      const p = document.createElement('p');
      p.className = 'rounded-lg border px-3 py-2 text-sm';
      p.setAttribute('role', 'alert');
      p.style.backgroundColor = 'rgb(var(--warning-soft))';
      p.style.borderColor = 'rgb(var(--warning))';
      p.style.color = 'rgb(var(--warning))';
      p.textContent = warning;
      results!.appendChild(p);
    }
    for (const note of result.notes ?? []) results!.appendChild(placeholder(note));
    for (const output of result.outputs) {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2';
      const name = document.createElement('span');
      name.className = 'truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'btn btn-subtle btn-sm shrink-0';
      save.textContent = 'Save recording';
      save.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      row.append(name, save);
      results!.appendChild(row);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                */
  /* ---------------------------------------------------------------------- */

  startBtn.addEventListener('click', () => void start());
  recordBtn.addEventListener('click', () => startRecording());
  stopBtn.addEventListener('click', () => stopRecording());
  resetBtn.addEventListener('click', () => {
    generation += 1;
    stopRecording();
    stopLoop();
    releaseStream();
    revokeObjectUrl();
    void context?.close().catch(() => undefined);
    context = null;
    if (audio) {
      audio.removeAttribute('src');
      audio.load();
    }
    if (playbackWrap) playbackWrap.hidden = true;
    if (meterWrap) meterWrap.hidden = true;
    if (deviceWrap) deviceWrap.hidden = true;
    results.replaceChildren();
    resetMeter();
    clearError(errorBox!);
    startBtn.hidden = false;
    startBtn.disabled = false;
    recordBtn.hidden = true;
    recordBtn.disabled = false;
    stopBtn.hidden = true;
    resetBtn.hidden = true;
    announce('Microphone released.');
  });

  for (const control of [fftSelect, smoothingInput, floorInput, limitInput]) {
    control?.addEventListener('input', () => {
      applySettings();
      resetMeter();
    });
  }

  deviceSelect?.addEventListener('change', () => {
    activeDeviceId = deviceSelect.value;
    stopRecording();
    stopLoop();
    releaseStream();
    announce('Switching microphone…');
    void start(activeDeviceId);
  });

  const shutdown = () => {
    generation += 1;
    stopRecording();
    stopLoop();
    releaseStream();
    revokeObjectUrl();
  };
  window.addEventListener('pagehide', shutdown);
  window.addEventListener('beforeunload', shutdown);
}
