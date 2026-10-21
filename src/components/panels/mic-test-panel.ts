/**
 * The microphone test panel.
 *
 * This module owns every browser API the tool needs: `getUserMedia`, the Web
 * Audio graph (a `MediaStreamAudioSourceNode` → `AnalyserNode` chain), the
 * canvas the waveform is drawn on and `MediaRecorder`.
 *
 * The panel measures the live levels and hands the recording plus the raw
 * numbers to the tool's own `run()` through `runToolById`, so the report
 * logic stays in a module that can be unit-tested without a DOM.
 *
 * Nothing leaves the device: the recorded blob becomes an object URL for
 * playback and a download, and no request is ever made.
 */
import type { FileRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { formatBytes } from '@/lib/format';
import {
  clearError,
  readOptions,
  renderTextResult,
  showError,
} from '@/components/workbench/shared';
import {
  SILENCE_DB,
  checkMicEnvironment,
  chooseRecorderMimeType,
  computePeak,
  computeRms,
  dbToMeterScale,
  decayPeakHold,
  describeMediaError,
  formatDb,
  formatElapsed,
  isSilentSummary,
  linearToDb,
  recordingFilename,
  summariseLevels,
  type LevelFrame,
} from '@/tools/device/mic-test.core';

/** How many columns the rolling waveform keeps. */
const SCOPE_COLUMNS = 480;
/** How many new columns the waveform gains per animation frame. */
const SCOPE_COLUMNS_PER_FRAME = 8;
/** How many level readings are kept before the series is halved. */
const MAX_FRAMES = 3600;
/** How long the level has to stay at the floor before the track is called silent. */
const SILENCE_GRACE_MS = 1200;
/** How often the screen-reader level announcement is refreshed (ms). */
const ANNOUNCE_INTERVAL_MS = 700;

/** The `AudioContext` constructor, including the old WebKit prefix. */
function audioContextConstructor(): typeof AudioContext | undefined {
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext;
}

/** Read a theme colour (`--accent` is stored as `r g b`). */
function themeColor(name: string, fallback: string): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value ? `rgb(${value})` : fallback;
  } catch {
    return fallback;
  }
}

/** A plain word for a level, so the meter never relies on colour alone. */
function levelWord(db: number): string {
  if (db <= SILENCE_DB + 0.5) return 'No signal';
  if (db < -40) return 'Very quiet';
  if (db < -20) return 'Quiet';
  if (db < -8) return 'Good level';
  if (db < -2) return 'Hot';
  return 'Clipping';
}

/** Mount the microphone UI into a `[data-mic-panel]` element. */
export function mountMicPanel(panel: HTMLElement): void {
  const startBtn = panel.querySelector<HTMLButtonElement>('[data-mic-start]')!;
  const stopBtn = panel.querySelector<HTMLButtonElement>('[data-mic-stop]')!;
  const recordBtn = panel.querySelector<HTMLButtonElement>('[data-mic-record]')!;
  const recordStopBtn = panel.querySelector<HTMLButtonElement>('[data-mic-record-stop]')!;
  const againBtn = panel.querySelector<HTMLButtonElement>('[data-mic-record-again]')!;
  const statusEl = panel.querySelector<HTMLElement>('[data-mic-status]')!;
  const errorBox = panel.querySelector<HTMLElement>('[data-mic-error]')!;
  const stage = panel.querySelector<HTMLElement>('[data-mic-stage]')!;
  const meterEl = panel.querySelector<HTMLElement>('[data-mic-meter]')!;
  const fillEl = panel.querySelector<HTMLElement>('[data-mic-fill]')!;
  const peakEl = panel.querySelector<HTMLElement>('[data-mic-peak]')!;
  const readoutEl = panel.querySelector<HTMLElement>('[data-mic-readout]')!;
  const scaleEl = panel.querySelector<HTMLElement>('[data-mic-scale]')!;
  const stateEl = panel.querySelector<HTMLElement>('[data-mic-state]')!;
  const liveEl = panel.querySelector<HTMLElement>('[data-mic-live]')!;
  const canvas = panel.querySelector<HTMLCanvasElement>('[data-mic-canvas]')!;
  const scopeAltEl = panel.querySelector<HTMLElement>('[data-mic-scope-alt]')!;
  const recIndicator = panel.querySelector<HTMLElement>('[data-mic-recording-indicator]')!;
  const timerEl = panel.querySelector<HTMLElement>('[data-mic-timer]')!;
  const playback = panel.querySelector<HTMLElement>('[data-mic-playback]')!;
  const audioEl = panel.querySelector<HTMLAudioElement>('[data-mic-audio]')!;
  const downloadEl = panel.querySelector<HTMLAnchorElement>('[data-mic-download]')!;
  const clipMeta = panel.querySelector<HTMLElement>('[data-mic-clip-meta]')!;
  const resultWrap = panel.querySelector<HTMLElement>('[data-result-wrap]')!;
  const reportEl = panel.querySelector<HTMLElement>('[data-mic-report]')!;
  const outputsEl = panel.querySelector<HTMLElement>('[data-mic-outputs]')!;
  const notesEl = panel.querySelector<HTMLElement>('[data-mic-notes]')!;
  const optionsRoot = panel.querySelector<HTMLElement>('[data-mic-options]')! ?? panel;

  if (
    !startBtn ||
    !stopBtn ||
    !recordBtn ||
    !recordStopBtn ||
    !againBtn ||
    !statusEl ||
    !errorBox ||
    !stage ||
    !meterEl ||
    !fillEl ||
    !peakEl ||
    !readoutEl ||
    !scaleEl ||
    !stateEl ||
    !liveEl ||
    !canvas ||
    !scopeAltEl ||
    !recIndicator ||
    !timerEl ||
    !playback ||
    !audioEl ||
    !downloadEl ||
    !clipMeta ||
    !resultWrap ||
    !reportEl ||
    !outputsEl ||
    !notesEl
  ) {
    return;
  }

  const abort = new AbortController();
  const signal = abort.signal;

  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recordingType = 'audio/webm';
  let samples = new Float32Array(0);
  let rafId: number | null = null;
  let timerId: number | null = null;
  let objectUrl: string | null = null;
  let recording = false;
  let recordingStartedAt = 0;
  let destroyed = false;

  /** Every level window measured since the microphone was opened. */
  let liveFrames: LevelFrame[] = [];
  /** The level windows measured during the current recording. */
  let recordFrames: LevelFrame[] = [];
  /** How many frames are skipped between two kept readings. */
  let frameStride = 1;
  /** Counts the animation frames, so readings can be decimated. */
  let frameCounter = 0;
  /** The raw samples of the loudest window seen so far. */
  let peakWindow: number[] = [];
  let peakWindowValue = 0;

  let peakHoldDb = SILENCE_DB;
  let lastTick = 0;
  let lastAnnouncedAt = 0;
  let lastAnnouncedDb = Number.NaN;
  let silenceChecked = false;
  let monitorStartedAt = 0;
  /** What the browser told us about the capture device. */
  let deviceLabel = 'Microphone';
  let sampleRate = 0;
  let channels = 1;

  /* The rolling scope: a ring buffer of min/max columns. */
  const scopeMin = new Float32Array(SCOPE_COLUMNS);
  const scopeMax = new Float32Array(SCOPE_COLUMNS);
  let scopeHead = 0;
  let scopeCount = 0;
  let scopeWidth = 0;
  let scopeHeight = 0;
  let traceColor = 'rgb(157 61 42)';
  let gridColor = 'rgb(0 0 0)';

  /* ---------------------------------------------------------------------- */
  /*  Small helpers                                                          */
  /* ---------------------------------------------------------------------- */

  function announce(message: string): void {
    statusEl.textContent = message;
  }

  /** The options as the tool sees them, with the declared defaults applied. */
  function currentOptions(): Record<string, string | number | boolean> {
    const values = readOptions(optionsRoot);
    return {
      meterRange: String(values.meterRange ?? 60),
      frameSize: String(values.frameSize ?? 2048),
      clipName: typeof values.clipName === 'string' ? values.clipName : '',
    };
  }

  /** The meter's bottom edge, in dB below full scale. */
  function meterFloorDb(): number {
    const value = Number(currentOptions().meterRange);
    return Number.isFinite(value) && value > 0 ? value : 60;
  }

  /** How many samples each level reading covers. */
  function frameSize(): number {
    const value = Number(currentOptions().frameSize);
    return Number.isFinite(value) && value > 0 ? value : 2048;
  }

  function refreshColors(): void {
    traceColor = themeColor('--accent', traceColor);
    gridColor = themeColor('--border', gridColor);
  }

  /* ---------------------------------------------------------------------- */
  /*  The rolling waveform                                                   */
  /* ---------------------------------------------------------------------- */

  /** Match the canvas backing store to its CSS size and the device pixel ratio. */
  function sizeCanvas(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    scopeWidth = Math.max(1, Math.round(rect.width));
    scopeHeight = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(scopeWidth * dpr);
    canvas.height = Math.round(scopeHeight * dpr);
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Push the newest samples into the rolling scope buffer. */
  function pushScope(data: Float32Array): void {
    const per = Math.max(1, Math.floor(data.length / SCOPE_COLUMNS_PER_FRAME));
    for (let c = 0; c < SCOPE_COLUMNS_PER_FRAME; c++) {
      const from = c * per;
      const to =
        c === SCOPE_COLUMNS_PER_FRAME - 1 ? data.length : Math.min(data.length, from + per);
      let min = 0;
      let max = 0;
      for (let i = from; i < to; i++) {
        const v = data[i] ?? 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      scopeMin[scopeHead] = min;
      scopeMax[scopeHead] = max;
      scopeHead = (scopeHead + 1) % SCOPE_COLUMNS;
      if (scopeCount < SCOPE_COLUMNS) scopeCount++;
    }
  }

  /** Draw the rolling waveform. */
  function drawScope(): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || scopeWidth === 0) return;
    ctx.clearRect(0, 0, scopeWidth, scopeHeight);

    // The zero line.
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(scopeHeight / 2) + 0.5);
    ctx.lineTo(scopeWidth, Math.round(scopeHeight / 2) + 0.5);
    ctx.stroke();

    // The trace: one vertical line per column, from the column's minimum to
    // its maximum. A min/max envelope keeps short transients visible.
    ctx.strokeStyle = traceColor;
    ctx.beginPath();
    for (let i = 0; i < scopeCount; i++) {
      const index = (scopeHead - scopeCount + i + SCOPE_COLUMNS * 2) % SCOPE_COLUMNS;
      const x = (i / (SCOPE_COLUMNS - 1)) * scopeWidth;
      const high = scopeMax[index] ?? 0;
      const low = scopeMin[index] ?? 0;
      const y1 = scopeHeight / 2 - high * (scopeHeight / 2) * 0.92;
      const y2 = scopeHeight / 2 - low * (scopeHeight / 2) * 0.92;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }

  /* ---------------------------------------------------------------------- */
  /*  The meter                                                              */
  /* ---------------------------------------------------------------------- */

  function updateMeter(rmsDb: number, peakDb: number, deltaMs: number): void {
    const floor = meterFloorDb();
    fillEl.style.width = `${(dbToMeterScale(rmsDb, -floor, 0) * 100).toFixed(2)}%`;

    // The peak-hold marker jumps up to any louder reading and falls back slowly.
    const held = Math.max(peakDb, decayPeakHold(peakHoldDb, deltaMs));
    peakHoldDb = held;
    peakEl.style.left = `${(dbToMeterScale(held, -floor, 0) * 100).toFixed(2)}%`;

    meterEl.setAttribute('aria-valuemin', String(-floor));
    meterEl.setAttribute('aria-valuemax', '0');
    meterEl.setAttribute('aria-valuenow', rmsDb.toFixed(1));
    meterEl.setAttribute('aria-valuetext', formatDb(rmsDb));

    readoutEl.textContent = formatDb(rmsDb);
    scaleEl.textContent = `−${floor} dBFS`;
    stateEl.textContent = `${levelWord(peakDb)} · peak ${formatDb(peakDb)}`;
  }

  /** Announce the level politely — throttled, so a screen reader is not flooded. */
  function announceLevel(db: number, now: number): void {
    if (now - lastAnnouncedAt < ANNOUNCE_INTERVAL_MS) return;
    if (Number.isFinite(lastAnnouncedDb) && Math.abs(db - lastAnnouncedDb) < 2) return;
    lastAnnouncedAt = now;
    lastAnnouncedDb = db;
    liveEl.textContent = `Input level ${formatDb(db)}.`;
  }

  /** The text equivalent of the waveform. */
  function updateScopeAlt(rmsDb: number, peakDb: number): void {
    const text =
      peakDb <= SILENCE_DB + 0.5
        ? 'No signal on the waveform.'
        : `Signal present — average ${formatDb(rmsDb)}, peak ${formatDb(peakDb)}.`;
    scopeAltEl.textContent = text;
    canvas.setAttribute('aria-label', `Live microphone waveform. ${text}`);
  }

  /* ---------------------------------------------------------------------- */
  /*  The animation frame loop                                               */
  /* ---------------------------------------------------------------------- */

  function tick(now: number): void {
    if (destroyed) return;
    rafId = window.requestAnimationFrame(tick);
    if (!analyser || samples.length === 0) return;

    const delta = lastTick ? Math.min(500, now - lastTick) : 16;
    lastTick = now;

    // Real samples, so the RMS is a true RMS and not a byte-domain estimate.
    analyser.getFloatTimeDomainData(samples);

    const rms = computeRms(samples);
    const peak = computePeak(samples);
    const rmsDb = linearToDb(rms);
    const peakDb = linearToDb(peak);

    updateMeter(rmsDb, peakDb, delta);
    pushScope(samples);
    drawScope();
    announceLevel(rmsDb, now);
    updateScopeAlt(rmsDb, peakDb);

    frameCounter++;
    if (frameCounter % frameStride === 0) {
      const frame: LevelFrame = { rms, peak };
      liveFrames.push(frame);
      if (recording) recordFrames.push(frame);
      if (peak > peakWindowValue) {
        peakWindowValue = peak;
        peakWindow = Array.from(samples);
      }
      if (liveFrames.length >= MAX_FRAMES) {
        // Decimate instead of growing without bound: a long recording must
        // never exhaust memory.
        liveFrames = liveFrames.filter((_, index) => index % 2 === 0);
        recordFrames = recordFrames.filter((_, index) => index % 2 === 0);
        frameStride *= 2;
      }
    }

    // A browser can hand back a perfectly valid track that never carries a
    // single sample of signal. That is an error state, not a zero reading.
    if (!silenceChecked && now - monitorStartedAt > SILENCE_GRACE_MS) {
      silenceChecked = true;
      if (isSilentSummary(summariseLevels(liveFrames))) {
        showError(
          errorBox,
          'The browser gave us a silent track.',
          'Check that the right input is selected and that the microphone is not muted in your operating system’s sound settings.',
        );
      }
    }
  }

  function startLoop(): void {
    stopLoop();
    lastTick = 0;
    rafId = window.requestAnimationFrame(tick);
  }

  function stopLoop(): void {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Microphone lifecycle                                                   */
  /* ---------------------------------------------------------------------- */

  async function start(): Promise<void> {
    if (stream) return;
    clearError(errorBox);

    const blocker = checkMicEnvironment({
      secureContext: window.isSecureContext,
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
      hasMediaRecorder: typeof window.MediaRecorder !== 'undefined',
    });
    if (blocker) {
      showError(errorBox, blocker.message, blocker.hint);
      announce('The microphone is not available here.');
      return;
    }

    startBtn.disabled = true;
    announce('Requesting microphone permission…');

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const info = describeMediaError(error);
      showError(errorBox, info.message, info.hint);
      announce('The microphone could not be opened.');
      startBtn.disabled = false;
      return;
    }

    const AudioContextCtor = audioContextConstructor();
    if (!AudioContextCtor) {
      showError(
        errorBox,
        'This browser has no Web Audio support.',
        'The level meter needs the Web Audio API — try a recent version of Chrome, Edge, Firefox or Safari.',
      );
      stopMicrophone();
      return;
    }

    try {
      audioCtx = new AudioContextCtor();
      await audioCtx.resume().catch(() => undefined);
      sourceNode = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = Math.min(8192, frameSize());
      // A time-domain reading must not be smoothed, or the meter would lag.
      analyser.smoothingTimeConstant = 0;
      sourceNode.connect(analyser);
      // Keep the graph pulled by the audio thread — an analyser that does not
      // reach the destination is not guaranteed to be processed — but mute the
      // sink so the microphone never reaches the speakers.
      const sink = audioCtx.createGain();
      sink.gain.value = 0;
      analyser.connect(sink);
      sink.connect(audioCtx.destination);
      samples = new Float32Array(analyser.fftSize);
    } catch {
      showError(
        errorBox,
        'The audio engine could not be started.',
        'Reload the page and press “Start microphone” again.',
      );
      stopMicrophone();
      return;
    }

    liveFrames = [];
    recordFrames = [];
    frameCounter = 0;
    frameStride = 1;
    peakWindow = [];
    peakWindowValue = 0;
    peakHoldDb = SILENCE_DB;
    silenceChecked = false;
    monitorStartedAt = performance.now();
    lastAnnouncedDb = Number.NaN;
    refreshColors();

    // The device facts are read while the stream is alive: by the time the
    // recording finishes, the track may already be gone.
    const track = stream.getAudioTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    deviceLabel = track?.label || 'Microphone';
    sampleRate = Number(settings.sampleRate) || audioCtx?.sampleRate || 0;
    channels = Number(settings.channelCount) || 1;

    stage.hidden = false;
    startBtn.hidden = true;
    stopBtn.hidden = false;
    recordBtn.disabled = false;
    sizeCanvas();
    drawScope();

    announce('Microphone on — speak to see the level move.');
    startLoop();
  }

  function stopMicrophone(message = 'Microphone off.'): void {
    stopLoop();
    stopRecording();
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    sourceNode?.disconnect();
    sourceNode = null;
    analyser?.disconnect();
    analyser = null;
    void audioCtx?.close().catch(() => undefined);
    audioCtx = null;
    samples = new Float32Array(0);
    stage.hidden = true;
    startBtn.hidden = false;
    startBtn.disabled = false;
    stopBtn.hidden = true;
    recordBtn.disabled = true;
    announce(message);
  }

  /* ---------------------------------------------------------------------- */
  /*  Recording                                                              */
  /* ---------------------------------------------------------------------- */

  function startRecording(): void {
    if (!stream || recorder) return;

    const format = chooseRecorderMimeType((mimeType) => {
      try {
        return (
          typeof window.MediaRecorder !== 'undefined' &&
          window.MediaRecorder.isTypeSupported(mimeType)
        );
      } catch {
        return false;
      }
    });
    if (!format) {
      showError(
        errorBox,
        'This browser cannot record audio in a format Toolbench can save.',
        'The live level meter still works. Try a recent version of Chrome, Edge, Firefox or Safari.',
      );
      return;
    }

    let next: MediaRecorder;
    try {
      next = new MediaRecorder(stream, { mimeType: format.mimeType });
    } catch {
      showError(
        errorBox,
        'The browser refused to start the recorder.',
        'Try a different microphone, or restart the browser and press “Record” again.',
      );
      return;
    }

    recorder = next;
    recordingType = format.mimeType;
    chunks = [];
    recordFrames = [];
    peakWindow = [];
    peakWindowValue = 0;

    next.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    next.onstop = () => {
      void finishRecording();
    };
    next.onerror = () => {
      showError(
        errorBox,
        'The recording failed.',
        'Press “Record” again — the browser stopped the recorder.',
      );
    };

    try {
      next.start(250);
    } catch {
      recorder = null;
      showError(errorBox, 'The recording could not be started.', 'Press “Record” again.');
      return;
    }

    recording = true;
    recordingStartedAt = performance.now();
    recordBtn.hidden = true;
    recordStopBtn.hidden = false;
    recIndicator.hidden = false;
    timerEl.textContent = formatElapsed(0);
    timerId = window.setInterval(() => {
      timerEl.textContent = formatElapsed(performance.now() - recordingStartedAt);
    }, 100);
    announce('Recording — speak, then press “Stop recording”.');
  }

  function stopRecording(): void {
    if (!recorder) return;
    const current = recorder;
    recorder = null;
    recording = false;
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
    recordBtn.hidden = false;
    recordStopBtn.hidden = true;
    recIndicator.hidden = true;
    try {
      if (current.state !== 'inactive') current.stop();
    } catch {
      /* the recorder was already stopped */
    }
  }

  /** Turn the captured chunks into a clip, play it and hand it to the tool. */
  async function finishRecording(): Promise<void> {
    if (destroyed) return;
    const type = recordingType || 'audio/webm';
    const blob = new Blob(chunks, { type });
    chunks = [];
    if (!blob.size) {
      showError(
        errorBox,
        'The recording came out empty.',
        'Press “Record” and try again — nothing was captured.',
      );
      announce('Nothing was recorded.');
      return;
    }

    const durationMs = Math.round(performance.now() - recordingStartedAt);

    const options = currentOptions();
    const mimeType = blob.type || type;
    const filename = recordingFilename(
      String(options.clipName ?? '') || deviceLabel,
      mimeType,
      'mic-clip',
    );

    // Play it back straight away — the clip never leaves this tab.
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    audioEl.src = objectUrl;
    downloadEl.href = objectUrl;
    downloadEl.download = filename;
    downloadEl.textContent = `Download ${filename}`;
    clipMeta.textContent = `${filename} · ${formatBytes(blob.size)} · ${formatElapsed(durationMs)}`;
    playback.hidden = false;
    announce(`Recorded ${formatElapsed(durationMs)} — play it back or download the clip.`);

    // Hand the clip and the raw measurements to the tool's own run().
    const file = new File([blob], filename, { type: mimeType });
    const measurements = {
      deviceLabel,
      sampleRate,
      channels,
      durationMs,
      mimeType,
      rms: recordFrames.map((frame) => frame.rms),
      peak: recordFrames.map((frame) => frame.peak),
      peakWindow,
    };

    try {
      const result = await runToolById<FileRunResult>(
        'mic-test',
        { files: [file], options, text: JSON.stringify(measurements) },
      );
      renderResult(result);
    } catch (error) {
      const err = error as Error & { hint?: string };
      showError(
        errorBox,
        err.message || 'The recording could not be measured.',
        err.hint,
      );
    }
  }

  function renderResult(result: FileRunResult): void {
    resultWrap.hidden = false;
    if (result.report) {
      renderTextResult(reportEl, {
        output: result.report.output,
        render: result.report.render,
        language: result.report.language,
      });
    }
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
      save.addEventListener('click', () => {
        const url = URL.createObjectURL(output.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = output.filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      });
      li.append(name, save);
      outputsEl.appendChild(li);
    }
    notesEl.replaceChildren();
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

  /* ---------------------------------------------------------------------- */
  /*  Wiring and teardown                                                    */
  /* ---------------------------------------------------------------------- */

  startBtn.addEventListener('click', () => void start());
  stopBtn.addEventListener('click', () => stopMicrophone());
  recordBtn.addEventListener('click', () => startRecording());
  recordStopBtn.addEventListener('click', () => stopRecording());
  againBtn.addEventListener('click', () => {
    playback.hidden = true;
    resultWrap.hidden = true;
    reportEl.replaceChildren();
    outputsEl.replaceChildren();
    notesEl.replaceChildren();
    audioEl.removeAttribute('src');
    audioEl.load();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    recordFrames = [];
    peakWindow = [];
    peakWindowValue = 0;
    announce('Ready to record again.');
    recordBtn.focus();
  });

  const onOptionsChange = (): void => {
    const size = frameSize();
    if (analyser && analyser.fftSize !== size) {
      analyser.fftSize = size;
      samples = new Float32Array(analyser.fftSize);
    }
    scaleEl.textContent = `−${meterFloorDb()} dBFS`;
  };
  optionsRoot.addEventListener('change', onOptionsChange, { signal });

  const onResize = (): void => {
    sizeCanvas();
    drawScope();
  };
  window.addEventListener('resize', onResize, { signal });

  /** Release everything: the loop, the stream, the context and the URLs. */
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    recorder = null;
    recording = false;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    sourceNode?.disconnect();
    sourceNode = null;
    analyser?.disconnect();
    analyser = null;
    void audioCtx?.close().catch(() => undefined);
    audioCtx = null;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    abort.abort();
  }

  // Never leave a microphone — or a running animation frame — behind.
  window.addEventListener('pagehide', () => destroy(), { signal });
  window.addEventListener('beforeunload', () => destroy(), { signal });
  document.addEventListener('astro:before-swap', () => destroy(), { signal });

  // If the panel is removed from the document, tear everything down: a stray
  // rAF loop would keep the microphone open forever.
  const parent = panel.parentElement;
  if (parent && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (!panel.isConnected) {
        observer.disconnect();
        destroy();
      }
    });
    observer.observe(parent, { childList: true });
    signal.addEventListener('abort', () => observer.disconnect());
  }
}
