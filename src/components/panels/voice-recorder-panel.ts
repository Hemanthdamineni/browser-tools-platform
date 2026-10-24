/**
 * The voice recorder panel.
 *
 * Capturing a voice memo cannot live in the generic file workbench (nor in
 * the tool worker): it needs `getUserMedia`, a Web Audio graph for the level
 * meter, `ScriptProcessorNode` to capture raw PCM for WAV, and `MediaRecorder`
 * for WebM — all main-thread browser APIs. This module owns them.
 *
 * Everything that does *not* need a browser is kept here too, as pure,
 * exported functions so it can be unit-tested without a DOM:
 *
 *   - the elapsed-time format,
 *   - the level-meter smoothing (from an analyser's byte data),
 *   - the chunk accumulator (with crash checkpoints, and a stop that never
 *     drops the last chunk),
 *   - the filename / MIME-type selection,
 *   - the 44-byte RIFF/WAVE header writer.
 *
 * Privacy: nothing is uploaded. The only traffic is the browser fetching this
 * app's own lazily-loaded chunk.
 */
import type { FileRunResult } from '@/lib/types';
import { downloadBlob } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import { runToolById } from '@/lib/worker/client';
import { clearError, showError } from '@/components/workbench/shared';

/* ======================================================================== */
/*  Pure logic — no DOM, unit-tested directly                                 */
/* ======================================================================== */

/** The container a recording is written in. */
export type RecordingFormat = 'wav' | 'webm';

/** The MIME type WAV takes when it is the chosen output. */
export const WAV_MIME = 'audio/wav';

/** MIME types tried for a WebM recording, best first. */
export const WEBM_MIME_CANDIDATES: readonly string[] = ['audio/webm;codecs=opus', 'audio/webm'];

/** The file extension used for a container. */
export function extensionForFormat(format: RecordingFormat): 'wav' | 'webm' {
  return format === 'wav' ? 'wav' : 'webm';
}

/**
 * Pick the WebM MIME type to record with, or `null` when the browser cannot
 * record WebM at all.
 *
 * WAV is not chosen here: it is built from raw PCM with the Web Audio API, so
 * it never goes through `MediaRecorder`. Use `WAV_MIME` for it.
 */
export function pickMimeType(supported: (type: string) => boolean): string | null {
  for (const candidate of WEBM_MIME_CANDIDATES) {
    let ok = false;
    try {
      ok = supported(candidate);
    } catch {
      ok = false;
    }
    if (ok) return candidate;
  }
  return null;
}

/** Whether this browser can record a WebM container at all. */
export function supportsWebm(supported: (type: string) => boolean): boolean {
  return pickMimeType(supported)?.startsWith('audio/webm') === true;
}

/** The container a MIME type belongs to, or `null` when it is not audio we know. */
export function formatForMimeType(mime: string): RecordingFormat | null {
  const value = String(mime ?? '')
    .toLowerCase()
    .trim();
  if (!value) return null;
  const type = value.split(';')[0]!.trim();
  if (type === 'audio/wav' || type === 'audio/x-wav' || type === 'audio/wave') return 'wav';
  if (type === 'audio/webm') return 'webm';
  return null;
}

/** A timestamped name for a fresh take, e.g. `voice-recording-2026-10-24-09-05-03.wav`. */
export function recordingFileName(format: RecordingFormat, when: Date = new Date()): string {
  const d = when instanceof Date && !Number.isNaN(when.getTime()) ? when : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
  return `voice-recording-${stamp}.${extensionForFormat(format)}`;
}

/**
 * The running timer: `m:ss`, or `h:mm:ss` from an hour on. Negative or broken
 * values read as `0:00` rather than `NaN`.
 */
export function formatElapsed(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** `3.42` → `3.42 s` — a friendly duration for a finished take. */
export function formatDuration(seconds: number): string {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return 'Unknown';
  if (n < 60) return `${n.toFixed(1)} s`;
  const total = Math.round(n);
  const pad = (x: number) => String(x).padStart(2, '0');
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  if (h > 0) return `${h} h ${pad(m)} m ${pad(s)} s`;
  return `${m} m ${pad(s)} s`;
}

/* ------------------------------------------------------------------------ */
/*  Level meter — from an analyser's byte data                               */
/* ------------------------------------------------------------------------ */

/** A smoothed level reading for the meter. All values are 0..1. */
export interface LevelMeter {
  /** Smoothed RMS amplitude (0..1), the bar you see. */
  rms: number;
  /** Smoothed peak amplitude (0..1), held for a moment. */
  peak: number;
  /** The raw RMS of the latest window, unsmoothed. */
  raw: number;
  /** How many windows have fed this meter. */
  samples: number;
}

/**
 * The RMS of a time-domain byte window (0..1).
 *
 * `getByteTimeDomainData` fills a Uint8Array where 128 is zero and the edges
 * are +/- full scale, so a sample is `(byte - 128) / 128`. The RMS is the
 * root-mean-square of those normalised samples.
 */
export function rmsFromByteData(bytes: ArrayLike<number>): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    const x = ((bytes[i] ?? 128) - 128) / 128;
    sum += x * x;
    n++;
  }
  return n === 0 ? 0 : Math.sqrt(sum / n);
}

/** The peak amplitude (0..1) of a time-domain byte window. */
export function peakFromByteData(bytes: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < bytes.length; i++) {
    const a = Math.abs(((bytes[i] ?? 128) - 128) / 128);
    if (a > peak) peak = a;
  }
  return peak;
}

/** Exponential smoothing: move `prev` a fraction `k` of the way to `target`. */
export function smoothLevel(prev: number, target: number, k: number): number {
  const safe = Number.isFinite(prev) ? prev : 0;
  const t = Number.isFinite(target) ? Math.min(1, Math.max(0, target)) : 0;
  const f = Number.isFinite(k) ? Math.min(1, Math.max(0, k)) : 0.3;
  return safe + f * (t - safe);
}

/**
 * Advance the meter by one analyser window.
 *
 * The raw window is read, then the running values are smoothed — the RMS
 * decays smoothly and the peak attacks fast and falls back slowly, so the bar
 * feels alive without flickering.
 */
export function updateLevelMeter(
  prev: LevelMeter | null,
  bytes: ArrayLike<number>,
  smoothing = 0.3,
): LevelMeter {
  const raw = rmsFromByteData(bytes);
  const peakRaw = peakFromByteData(bytes);
  const samples = (prev?.samples ?? 0) + 1;
  if (!prev) return { rms: raw, peak: peakRaw, raw, samples };
  const rms = smoothLevel(prev.rms, raw, smoothing);
  const peak = smoothLevel(prev.peak, Math.max(peakRaw, prev.peak), 0.2);
  return { rms, peak, raw, samples };
}

/* ------------------------------------------------------------------------ */
/*  Chunk accumulation                                                       */
/* ------------------------------------------------------------------------ */

/**
 * Accumulates the parts of a recording.
 *
 * The panel adds a chunk every second and always appends the final chunk when
 * the take stops, so the last moment of audio is never lost. The same
 * accumulator rebuilds a take recovered from the IndexedDB checkpoint.
 */
export class ChunkAccumulator {
  private parts: Uint8Array[] = [];

  /** The number of chunks held so far. */
  get count(): number {
    return this.parts.length;
  }

  /** The total bytes held so far. */
  get size(): number {
    let total = 0;
    for (const part of this.parts) total += part.byteLength;
    return total;
  }

  /** Append one chunk of the recording. Order is preserved. */
  add(part: Uint8Array | ArrayBufferLike): void {
    if (!part || part.byteLength === 0) return;
    this.parts.push(part instanceof Uint8Array ? part : new Uint8Array(part));
  }

  /** The full take as one byte array — the WAV header is still to be written. */
  bytes(): Uint8Array<ArrayBuffer> {
    const total = this.size;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.byteLength;
    }
    return out;
  }

  /** Drop everything — used when a take is discarded. */
  reset(): void {
    this.parts = [];
  }
}

/* ------------------------------------------------------------------------ */
/*  WAV writer — a real 44-byte RIFF header                                   */
/* ------------------------------------------------------------------------ */

/** The parameters needed to write a canonical PCM WAV file. */
export interface WavParams {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  /** The number of PCM bytes that follow the header. */
  dataBytes: number;
}

/**
 * The canonical 44-byte RIFF/WAVE header, little-endian.
 *
 * Layout (see the test for a byte-for-byte check):
 *
 *   offset  0  "RIFF"
 *   offset  4  uint32 LE = fileSize - 8   (36 + dataBytes)
 *   offset  8  "WAVE"
 *   offset 12  "fmt "
 *   offset 16  uint32 LE = 16             (fmt chunk size)
 *   offset 20  uint16 LE = 1              (PCM)
 *   offset 22  uint16 LE = numChannels
 *   offset 24  uint32 LE = sampleRate
 *   offset 28  uint32 LE = byteRate       (sampleRate x blockAlign)
 *   offset 32  uint16 LE = blockAlign     (numChannels x bytesPerSample)
 *   offset 34  uint16 LE = bitsPerSample
 *   offset 36  "data"
 *   offset 40  uint32 LE = dataBytes
 */
export function buildWavHeader(params: WavParams): Uint8Array {
  const { sampleRate, numChannels, bitsPerSample, dataBytes } = params;
  const bytesPerSample = Math.max(1, Math.round(bitsPerSample / 8));
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  header[0] = 0x52; // 'R'
  header[1] = 0x49; // 'I'
  header[2] = 0x46; // 'F'
  header[3] = 0x46; // 'F'
  view.setUint32(4, 36 + dataBytes, true);

  header[8] = 0x57; // 'W'
  header[9] = 0x41; // 'A'
  header[10] = 0x56; // 'V'
  header[11] = 0x45; // 'E'

  header[12] = 0x66; // 'f'
  header[13] = 0x6d; // 'm'
  header[14] = 0x74; // 't'
  header[15] = 0x20; // ' '

  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  header[36] = 0x64; // 'd'
  header[37] = 0x61; // 'a'
  header[38] = 0x74; // 't'
  header[39] = 0x61; // 'a'

  view.setUint32(40, dataBytes, true);
  return header;
}

/** Interleave float samples (-1..1) into 16-bit little-endian PCM bytes. */
export function floatToPcm16(channels: Float32Array[], frames: number): Uint8Array {
  const numChannels = Math.max(1, channels.length);
  const out = new Uint8Array(frames * numChannels * 2);
  const view = new DataView(out.buffer);
  let off = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = channels[c]?.[i] ?? 0;
      const clamped = s < -1 ? -1 : s > 1 ? 1 : s;
      // Asymmetric scaling keeps 0 dBFS at +/- full scale (-32768 ... +32767).
      const v = Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      view.setInt16(off, v, true);
      off += 2;
    }
  }
  return out;
}

/**
 * Build a complete WAV blob: a 44-byte header followed by the PCM bytes.
 */
export function buildWavBlob(pcmBytes: Uint8Array, params: Omit<WavParams, 'dataBytes'>): Blob {
  const header = buildWavHeader({ ...params, dataBytes: pcmBytes.byteLength });
  const combined = new Uint8Array(header.byteLength + pcmBytes.byteLength);
  combined.set(header, 0);
  combined.set(pcmBytes, header.byteLength);
  return new Blob([combined], { type: WAV_MIME });
}

/* ======================================================================== */
/*  The panel — browser APIs only from here down                               */
/* ======================================================================== */

/** How often WebM hands over a chunk (ms) — each chunk is also checkpointed. */
const CHECKPOINT_MS = 1000;
/** How often the elapsed timer is refreshed (ms). */
const TIMER_MS = 200;
/** The analyser window used for the level meter. */
const ANALYSER_FFT = 2048;

/** A plain word for a level, so the meter never relies on colour alone. */
function levelWord(level: number): string {
  if (level < 0.01) return 'No signal';
  if (level < 0.15) return 'Quiet';
  if (level < 0.4) return 'Good level';
  if (level < 0.8) return 'Hot';
  return 'Clipping';
}

/** `MediaRecorder.isTypeSupported`, guarded for browsers without the API. */
function isTypeSupported(type: string): boolean {
  try {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type);
  } catch {
    return false;
  }
}

/** The `AudioContext` constructor, including the old WebKit prefix. */
function audioContextConstructor(): typeof AudioContext | undefined {
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext;
}

/** Turn a failed `getUserMedia` call into a message a person can act on. */
function describeMicError(err: unknown): { message: string; hint?: string } {
  const e = err as { name?: string; message?: string } | undefined;
  switch (e?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        message: 'Microphone permission was denied.',
        hint: 'Allow microphone access for this site (the padlock in the address bar), then press Microphone again.',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        message: 'No microphone was found on this device.',
        hint: 'Check that a microphone is connected and enabled in your system settings.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        message: 'The microphone could not be opened.',
        hint: 'Another app may be using the microphone — close it and try again.',
      };
    default:
      return {
        message: e?.message || 'The microphone could not be opened.',
        hint: 'Press Microphone again to retry.',
      };
  }
}

/* ------------------------------------------------------------------------ */
/*  Crash checkpoints — the take is kept in IndexedDB between seconds        */
/* ------------------------------------------------------------------------ */

/** The IndexedDB database that holds a take while it is being recorded. */
const CHECKPOINT_DB = 'browser-tools-voice-recorder';
/** The object store inside it. */
const CHECKPOINT_STORE = 'takes';

/** The small record kept beside the chunks so a crash can restore the take. */
interface TakeMeta {
  format: RecordingFormat;
  mimeType: string;
  recordedMs: number;
}

/** Wrap an IndexedDB request in a promise. */
function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  return promise;
}

/**
 * Open the checkpoint database, or resolve `null` when IndexedDB is missing
 * (a hardened browser, or a jsdom test). Checkpointing is a safety net, never
 * a requirement, so every failure resolves instead of throwing.
 */
function openCheckpointDb(): Promise<IDBDatabase | null> {
  const { promise, resolve } = Promise.withResolvers<IDBDatabase | null>();
  let factory: IDBFactory | undefined;
  try {
    factory = globalThis.indexedDB;
  } catch {
    factory = undefined;
  }
  if (!factory) {
    resolve(null);
    return promise;
  }
  let request: IDBOpenDBRequest;
  try {
    request = factory.open(CHECKPOINT_DB, 1);
  } catch {
    resolve(null);
    return promise;
  }
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(CHECKPOINT_STORE)) {
      database.createObjectStore(CHECKPOINT_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
  request.onblocked = () => resolve(null);
  return promise;
}

/** The scope of one tool's take. */
function checkpointKeys(scope: string): { chunkPrefix: string; metaKey: string } {
  return { chunkPrefix: `${scope}#`, metaKey: `${scope}.meta` };
}

/** Read the small metadata record, or `null` when there is none. */
function readTakeMeta(metaKey: string): TakeMeta | null {
  try {
    const raw = globalThis.localStorage?.getItem(metaKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TakeMeta;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      format: parsed.format === 'webm' ? 'webm' : 'wav',
      mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : '',
      recordedMs: Number.isFinite(parsed.recordedMs) ? Math.max(0, parsed.recordedMs) : 0,
    };
  } catch {
    return null;
  }
}

/** Mount the recorder panel into a `[data-voice-recorder]` element. */
export function mountVoiceRecorderPanel(root: HTMLElement): void {
  const toolId = root.dataset.toolId || 'voice-recorder';
  const micBtn = root.querySelector<HTMLButtonElement>('[data-vr-mic]')!;
  const recordBtn = root.querySelector<HTMLButtonElement>('[data-vr-record]')!;
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-vr-pause]')!;
  const resumeBtn = root.querySelector<HTMLButtonElement>('[data-vr-resume]')!;
  const stopBtn = root.querySelector<HTMLButtonElement>('[data-vr-stop]')!;
  const discardBtn = root.querySelector<HTMLButtonElement>('[data-vr-discard]')!;
  const formatSelect = root.querySelector<HTMLSelectElement>('[data-vr-format]')!;
  const timerEl = root.querySelector<HTMLElement>('[data-vr-timer]')!;
  const recBadge = root.querySelector<HTMLElement>('[data-vr-rec-badge]')!;
  const meterFill = root.querySelector<HTMLElement>('[data-vr-meter-fill]')!;
  const meterPeak = root.querySelector<HTMLElement>('[data-vr-meter-peak]')!;
  const levelReadout = root.querySelector<HTMLElement>('[data-vr-level-readout]')!;
  const levelWordEl = root.querySelector<HTMLElement>('[data-vr-level-word]')!;
  const liveEl = root.querySelector<HTMLElement>('[data-vr-live]')!;
  const statusEl = root.querySelector<HTMLElement>('[data-vr-status]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-vr-error]')!;
  const clipWrap = root.querySelector<HTMLElement>('[data-vr-clip-wrap]')!;
  const audioEl = root.querySelector<HTMLAudioElement>('[data-vr-audio]')!;
  const downloadEl = root.querySelector<HTMLAnchorElement>('[data-vr-download]')!;
  const clipMeta = root.querySelector<HTMLElement>('[data-vr-clip-meta]')!;
  const resultWrap = root.querySelector<HTMLElement>('[data-vr-result-wrap]')!;
  const reportEl = root.querySelector<HTMLElement>('[data-vr-report]')!;
  const outputsEl = root.querySelector<HTMLUListElement>('[data-vr-outputs]')!;
  const notesEl = root.querySelector<HTMLUListElement>('[data-vr-notes]')!;

  // Astro always renders these; the guard keeps a markup change from crashing.
  if (
    !micBtn ||
    !recordBtn ||
    !pauseBtn ||
    !resumeBtn ||
    !stopBtn ||
    !discardBtn ||
    !formatSelect ||
    !timerEl ||
    !recBadge ||
    !meterFill ||
    !meterPeak ||
    !levelReadout ||
    !levelWordEl ||
    !liveEl ||
    !statusEl ||
    !errorBox ||
    !clipWrap ||
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

  const AudioCtor = audioContextConstructor();
  const hasRecorder = typeof MediaRecorder !== 'undefined';
  /** Whether at least one output format can actually be produced here. */
  const formatsUsable = !!AudioCtor || (hasRecorder && supportsWebm(isTypeSupported));

  let micStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  /** The analyser window the meter reads. */
  let meterBytes = new Uint8Array(ANALYSER_FFT);
  let meter: LevelMeter | null = null;
  let meterRaf: number | null = null;
  /** The WebM recorder, when the WebM path is live. */
  let recorder: MediaRecorder | null = null;
  /** The PCM capture node, when the WAV path is live. */
  let pcmNode: ScriptProcessorNode | null = null;
  /** Float frames not yet flushed to the accumulator (the final chunk). */
  let pcmPending: Float32Array[] = [];
  /** WebM chunks still being read, so the last one is never missed. */
  let pendingChunks: Promise<void>[] = [];
  let accumulator = new ChunkAccumulator();
  /** Cumulative recorded milliseconds (pause-aware). */
  let recordedMs = 0;
  /** When the current run began (reset on resume). */
  let startedAt = 0;
  let paused = false;
  let takeFormat: RecordingFormat = 'wav';
  let takeMime: string = WAV_MIME;
  let timerId: number | null = null;
  let clipUrl: string | null = null;
  let controller: AbortController | null = null;
  let runGeneration = 0;
  /** True while a take is being discarded, so its stop handler stays quiet. */
  let discarding = false;

  const { chunkPrefix, metaKey } = checkpointKeys(`voice-recorder.${toolId}`);
  /** The memoised connection to IndexedDB, or null when unavailable. */
  let dbPromise: Promise<IDBDatabase | null> | null = null;
  /** The next chunk sequence number written, so a crash resumes cleanly. */
  let chunkSequence = 0;
  /** Serialises every IndexedDB write, so a clear can never race a late chunk. */
  let idbChain: Promise<void> = Promise.resolve();

  const getDb = (): Promise<IDBDatabase | null> => (dbPromise ??= openCheckpointDb());

  /** Queue an IndexedDB task behind the ones already running. */
  const enqueue = (task: () => Promise<void>): Promise<void> => {
    idbChain = idbChain.then(task, task).catch(() => {});
    return idbChain;
  };

  /** Write the take metadata where a reload can find it. */
  const saveMeta = (): void => {
    try {
      globalThis.localStorage?.setItem(
        metaKey,
        JSON.stringify({ format: takeFormat, mimeType: takeMime, recordedMs }),
      );
    } catch {
      /* storage unavailable — checkpointing is a nicety */
    }
  };

  /** Append one chunk to IndexedDB so a crash cannot lose more than a second. */
  const saveChunk = (bytes: Uint8Array): Promise<void> =>
    enqueue(async () => {
      const database = await getDb();
      if (!database) return;
      const tx = database.transaction(CHECKPOINT_STORE, 'readwrite');
      tx.objectStore(CHECKPOINT_STORE).put(bytes, `${chunkPrefix}${chunkSequence++}`);
    });

  /** Persist a checkpoint: the metadata plus the latest full chunk. */
  const saveCheckpoint = (bytes?: Uint8Array): Promise<void> => {
    const write = bytes && bytes.byteLength > 0 ? saveChunk(bytes) : Promise.resolve();
    saveMeta();
    return write;
  };

  /** Remove every chunk and the metadata for this tool's take. */
  const clearCheckpoint = (): Promise<void> =>
    enqueue(async () => {
      try {
        globalThis.localStorage?.removeItem(metaKey);
      } catch {
        /* ignore */
      }
      const database = await getDb();
      if (!database) return;
      const tx = database.transaction(CHECKPOINT_STORE, 'readwrite');
      tx.objectStore(CHECKPOINT_STORE).delete(
        IDBKeyRange.bound(chunkPrefix, `${chunkPrefix}\uffff`),
      );
    });

  /** Read back a take a previous session checkpointed, or `null` for none. */
  const readCheckpoint = async (): Promise<ChunkAccumulator | null> => {
    const database = await getDb();
    if (!database) return null;
    try {
      const store = database
        .transaction(CHECKPOINT_STORE, 'readonly')
        .objectStore(CHECKPOINT_STORE);
      const [keys, values] = await Promise.all([
        idbRequest(store.getAllKeys()),
        idbRequest(store.getAll()),
      ]);
      const acc = new ChunkAccumulator();
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (typeof key === 'string' && key.startsWith(chunkPrefix)) {
          const value = values[i];
          if (value instanceof Uint8Array) acc.add(value);
          else if (value instanceof ArrayBuffer) acc.add(new Uint8Array(value));
        }
      }
      return acc.size > 0 ? acc : null;
    } catch {
      return null;
    }
  };

  const announce = (message: string): void => {
    statusEl.textContent = message;
  };

  const fail = (message: string, hint?: string): void => {
    showError(errorBox, message, hint);
  };

  /** True while a take is being captured (recording or paused). */
  const isActive = (): boolean => recorder !== null || pcmNode !== null;

  /* ---------------------------------------------------------------------- */
  /*  Controls                                                               */
  /* ---------------------------------------------------------------------- */

  function updateControls(): void {
    const micOpen = !!micStream;
    const active = isActive();

    micBtn.disabled = active;
    recordBtn.disabled = !micOpen || active || !formatsUsable;
    // The container cannot change mid-take, so lock the choice while recording.
    formatSelect.disabled = active || !formatsUsable;
    pauseBtn.hidden = !(active && !paused);
    resumeBtn.hidden = !(active && paused);
    stopBtn.hidden = !active;
    discardBtn.hidden = !active;
    recBadge.hidden = !(active && !paused);
    micBtn.setAttribute('aria-pressed', micOpen ? 'true' : 'false');
  }

  /* ---------------------------------------------------------------------- */
  /*  Timer and meter                                                        */
  /* ---------------------------------------------------------------------- */

  function stopTimer(): void {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function tick(): void {
    timerEl.textContent = formatElapsed(recordedMs + (paused ? 0 : Date.now() - startedAt));
  }

  function startTimer(): void {
    stopTimer();
    tick();
    timerId = window.setInterval(tick, TIMER_MS);
  }

  let lastLiveAt = 0;
  let lastLiveDb = -1;

  /** Read the analyser and paint the meter. Runs while the microphone is open. */
  function meterFrame(): void {
    meterRaf = window.requestAnimationFrame(meterFrame);
    if (!analyser) return;
    if (meterBytes.length !== analyser.fftSize) meterBytes = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(meterBytes);
    meter = updateLevelMeter(meter, meterBytes, 0.3);
    meterFill.style.width = `${(meter.rms * 100).toFixed(1)}%`;
    meterPeak.style.left = `${(meter.peak * 100).toFixed(1)}%`;
    levelReadout.textContent = `${Math.round(meter.rms * 100)}%`;
    levelWordEl.textContent = levelWord(meter.rms);

    const now = Date.now();
    const db = Math.round(20 * Math.log10(Math.max(1e-5, meter.rms)));
    if (now - lastLiveAt >= 400 && Math.abs(db - lastLiveDb) >= 3) {
      lastLiveAt = now;
      lastLiveDb = db;
      liveEl.textContent = `Input level ${db} dB.`;
    }
  }

  function startMeter(): void {
    if (meterRaf !== null) return;
    meterRaf = window.requestAnimationFrame(meterFrame);
  }

  function stopMeter(): void {
    if (meterRaf !== null) {
      window.cancelAnimationFrame(meterRaf);
      meterRaf = null;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Microphone                                                             */
  /* ---------------------------------------------------------------------- */

  function closeMic(): void {
    stopMeter();
    micStream?.getTracks().forEach((track) => track.stop());
    micStream = null;
    analyser?.disconnect();
    analyser = null;
    if (audioCtx && audioCtx.state !== 'closed') void audioCtx.close();
    audioCtx = null;
    meter = null;
    meterFill.style.width = '0%';
    meterPeak.style.left = '0%';
    levelReadout.textContent = '—';
    levelWordEl.textContent = 'No signal';
  }

  async function toggleMic(): Promise<void> {
    if (micStream) {
      closeMic();
      announce('Microphone off.');
      updateControls();
      return;
    }
    clearError(errorBox);
    const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!devices || typeof devices.getUserMedia !== 'function') {
      fail(
        'This browser cannot open a microphone.',
        'The microphone needs a recent Chrome, Edge, Firefox or Safari, on a secure (https) page.',
      );
      announce('The microphone is not available in this browser.');
      return;
    }

    announce('Waiting for microphone permission…');
    try {
      micStream = await devices.getUserMedia({ audio: true });
      if (AudioCtor) {
        audioCtx = new AudioCtor();
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = ANALYSER_FFT;
        // A time-domain reading must not be smoothed — the meter smooths itself.
        analyser.smoothingTimeConstant = 0;
        source.connect(analyser);
        // Keep the graph pulled by the audio thread — an analyser that connects
        // nowhere is collected and reports silence. A muted gain keeps the
        // microphone off the speakers so nothing feeds back.
        const sink = audioCtx.createGain();
        sink.gain.value = 0;
        analyser.connect(sink);
        sink.connect(audioCtx.destination);
        startMeter();
      }
      announce('Microphone on — press Record when you are ready.');
      updateControls();
    } catch (err) {
      const info = describeMicError(err);
      fail(info.message, info.hint);
      announce('The microphone stays off.');
      updateControls();
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Recording — session management                                         */
  /* ---------------------------------------------------------------------- */

  /** Freeze the clock into `recordedMs`. Called on pause and on stop. */
  function accumulateElapsed(): void {
    if (!paused) recordedMs += Math.max(0, Date.now() - startedAt);
  }

  function startRecording(): void {
    if (!micStream || isActive()) return;
    clearError(errorBox);
    chunkSequence = 0;
    void clearCheckpoint();
    accumulator = new ChunkAccumulator();
    pcmPending = [];
    pendingChunks = [];
    recordedMs = 0;
    paused = false;
    startedAt = Date.now();
    takeFormat = formatSelect.value === 'webm' ? 'webm' : 'wav';
    takeMime = takeFormat === 'wav' ? WAV_MIME : (pickMimeType(isTypeSupported) ?? 'audio/webm');

    if (takeFormat === 'wav') startPcmCapture();
    else startWebmCapture();

    if (isActive()) {
      startTimer();
      announce('Recording started.');
      updateControls();
    }
  }

  /** The WAV path: a `ScriptProcessorNode` captures raw PCM in 16-bit blocks. */
  function startPcmCapture(): void {
    if (!audioCtx || !micStream) {
      fail(
        'This browser cannot build the WAV recorder.',
        'Try a recent Chrome, Edge or Firefox, or pick WebM output.',
      );
      announce('WAV recording is not available here.');
      return;
    }
    try {
      const source = audioCtx.createMediaStreamSource(micStream);
      const node = audioCtx.createScriptProcessor(4096, 1, 1);
      const sampleRate = audioCtx.sampleRate;
      const framesPerFlush = sampleRate; // ~1 second
      let pendingFrames = 0;

      node.onaudioprocess = (event) => {
        if (paused || pcmNode !== node) return;
        const input = event.inputBuffer.getChannelData(0);
        const frame = new Float32Array(input);
        pcmPending.push(frame);
        pendingFrames += frame.length;
        if (pendingFrames >= framesPerFlush) {
          // Flush the completed second as PCM into the accumulator, then
          // checkpoint it so a crash cannot lose more than a second.
          const block = drainPendingFrames();
          pendingFrames = 0;
          const pcm = floatToPcm16([block], block.length);
          accumulator.add(pcm);
          void saveCheckpoint(pcm);
        }
      };
      // A script processor is only pulled when it reaches a destination. Route
      // it through a muted gain so nothing is echoed to the speakers.
      const sink = audioCtx.createGain();
      sink.gain.value = 0;
      source.connect(node);
      node.connect(sink);
      sink.connect(audioCtx.destination);
      pcmNode = node;
    } catch {
      fail(
        'The WAV recorder could not be started.',
        'This browser refused the audio settings — try again, or pick WebM output.',
      );
      announce('The recording could not be started.');
      updateControls();
    }
  }

  /** Concatenate and clear the pending float frames (the final partial second). */
  function drainPendingFrames(): Float32Array {
    let total = 0;
    for (const f of pcmPending) total += f.length;
    const merged = new Float32Array(total);
    let offset = 0;
    for (const f of pcmPending) {
      merged.set(f, offset);
      offset += f.length;
    }
    pcmPending = [];
    return merged;
  }

  /** The WebM path: the browser's own `MediaRecorder`, one chunk per second. */
  function startWebmCapture(): void {
    if (typeof MediaRecorder === 'undefined') {
      fail(
        'This browser cannot record WebM.',
        'MediaRecorder is missing — try a recent Chrome, Edge or Firefox, or pick WAV output.',
      );
      announce('WebM recording is not available here.');
      return;
    }
    let instance: MediaRecorder;
    try {
      instance = new MediaRecorder(micStream!, { mimeType: takeMime });
    } catch {
      fail(
        'The recording could not be started.',
        'This browser refused the recording settings — try WAV output instead.',
      );
      announce('The recording could not be started.');
      updateControls();
      return;
    }
    recorder = instance;
    instance.ondataavailable = (event) => {
      // Ignore a straggler that arrives after the take was stopped or discarded.
      if (discarding || recorder !== instance) return;
      if (!event.data || event.data.size === 0) return;
      const read = event.data.arrayBuffer().then(async (buffer) => {
        const bytes = new Uint8Array(buffer);
        accumulator.add(bytes);
        await saveCheckpoint(bytes);
      });
      pendingChunks.push(read);
    };
    instance.onstop = () => {
      void finishRecording();
    };
    instance.onerror = () => {
      fail('The recording failed.', 'The browser stopped the recorder — start it again.');
      announce('The recording failed.');
    };
    try {
      instance.start(CHECKPOINT_MS);
    } catch {
      recorder = null;
      fail('The recording could not be started.', 'Try again with another microphone.');
      announce('The recording could not be started.');
      updateControls();
    }
  }

  function pauseRecording(): void {
    if (!isActive() || paused) return;
    accumulateElapsed();
    paused = true;
    recorder?.pause();
    void saveCheckpoint();
    stopTimer();
    timerEl.textContent = formatElapsed(recordedMs);
    announce('Recording paused.');
    updateControls();
  }

  function resumeRecording(): void {
    if (!isActive() || !paused) return;
    recorder?.resume();
    startedAt = Date.now();
    paused = false;
    startTimer();
    announce('Recording resumed.');
    updateControls();
  }

  function stopRecording(): void {
    if (!isActive()) return;
    accumulateElapsed();
    paused = false;
    stopTimer();
    announce('Stopping the recording…');

    if (pcmNode) {
      // Flush the final partial second before tearing the graph down, so the
      // last moment of the take is never lost.
      const leftover = drainPendingFrames();
      if (leftover.length) accumulator.add(floatToPcm16([leftover], leftover.length));
      pcmNode.disconnect();
      pcmNode = null;
      void finishRecording();
      return;
    }

    if (recorder && recorder.state !== 'inactive') {
      try {
        // Ask for the buffered data first, so nothing is left behind.
        recorder.requestData();
      } catch {
        /* some browsers refuse this while paused — the stop still flushes */
      }
      try {
        recorder.stop();
      } catch {
        /* the stop handler cleans up */
      }
      return;
    }
    void finishRecording();
  }

  async function finishRecording(): Promise<void> {
    stopTimer();
    if (discarding) return;
    // Wait for any chunk still being read so the last one is never missed.
    await Promise.all(pendingChunks);
    pendingChunks = [];
    recorder = null;
    pcmNode = null;
    updateControls();

    const blob = buildTakeBlob();
    if (blob.size === 0) {
      void clearCheckpoint();
      fail(
        'The recording came out empty.',
        'Nothing was captured — record again and speak near the microphone.',
      );
      announce('Nothing was recorded.');
      return;
    }

    const name = recordingFileName(takeFormat);
    announce(`Recording stopped — ${formatElapsed(recordedMs)} recorded.`);
    showClip(blob, name);
    const file = new File([blob], name, { type: blob.type });
    await handToTool(file);
    void clearCheckpoint();
  }

  /** The final take as a blob: a WAV with a real header, or the WebM bytes. */
  function buildTakeBlob(): Blob {
    const bytes = accumulator.bytes();
    if (takeFormat === 'wav') {
      return buildWavBlob(bytes, {
        sampleRate: audioCtx?.sampleRate ?? 44100,
        numChannels: 1,
        bitsPerSample: 16,
      });
    }
    return new Blob([bytes], { type: takeMime });
  }

  function showClip(blob: Blob, filename: string): void {
    try {
      if (clipUrl) URL.revokeObjectURL(clipUrl);
      clipUrl = URL.createObjectURL(blob);
      audioEl.src = clipUrl;
      downloadEl.href = clipUrl;
      downloadEl.download = filename;
      clipMeta.textContent = `${formatDuration(recordedMs / 1000)} · ${formatBytes(blob.size)} · ${
        takeFormat === 'wav' ? 'WAV (PCM)' : 'WebM (Opus)'
      }`;
      clipWrap.hidden = false;
    } catch {
      /* the preview is a nicety — the download still works */
    }
  }

  function discardRecording(): void {
    discarding = true;
    stopTimer();
    void clearCheckpoint();
    try {
      recorder?.stop();
    } catch {
      /* ignore */
    }
    recorder = null;
    if (pcmNode) {
      pcmNode.disconnect();
      pcmNode = null;
    }
    accumulator = new ChunkAccumulator();
    pcmPending = [];
    pendingChunks = [];
    recordedMs = 0;
    paused = false;
    discarding = false;
    timerEl.textContent = formatElapsed(0);
    clipWrap.hidden = true;
    resultWrap.hidden = true;
    if (clipUrl) {
      try {
        URL.revokeObjectURL(clipUrl);
      } catch {
        /* ignore */
      }
      clipUrl = null;
    }
    announce('Recording discarded.');
    updateControls();
  }

  /* ---------------------------------------------------------------------- */
  /*  Hand the take to the tool                                              */
  /* ---------------------------------------------------------------------- */

  async function handToTool(file: File): Promise<void> {
    controller?.abort();
    const generation = ++runGeneration;
    controller = new AbortController();
    clearError(errorBox);
    resultWrap.hidden = false;
    reportEl.hidden = true;
    outputsEl.innerHTML = '';
    notesEl.innerHTML = '';

    try {
      const result = await runToolById<FileRunResult>(
        toolId,
        {
          files: [file],
          options: {
            format: takeFormat,
            duration: Math.round((recordedMs / 1000) * 10) / 10,
            mimeType: file.type,
          },
        },
        { signal: controller.signal },
      );
      if (generation !== runGeneration) return;
      renderResult(result);
    } catch (err) {
      if (generation !== runGeneration) return;
      const e = err as Error & { hint?: string };
      if (e.name !== 'AbortError') {
        fail(e.message || 'The recording could not be processed.', e.hint);
        announce('The recording could not be processed.');
      }
    } finally {
      if (generation === runGeneration) controller = null;
    }
  }

  function renderResult(result: FileRunResult): void {
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
  /*  Recover a take that survived a page reload                             */
  /* ---------------------------------------------------------------------- */

  async function recoverCheckpoint(): Promise<void> {
    const recovered = await readCheckpoint();
    if (!recovered) return;
    accumulator = recovered;
    const meta = readTakeMeta(metaKey);
    takeFormat =
      formatForMimeType(meta?.mimeType ?? '') ?? (meta?.format === 'webm' ? 'webm' : 'wav');
    takeMime = meta?.mimeType || (takeFormat === 'wav' ? WAV_MIME : 'audio/webm');
    recordedMs = meta?.recordedMs ?? 0;
    formatSelect.value = takeFormat;
    timerEl.textContent = formatElapsed(recordedMs);
    const blob = buildTakeBlob();
    if (blob.size === 0) {
      void clearCheckpoint();
      return;
    }
    showClip(blob, recordingFileName(takeFormat));
    announce(
      `A take from earlier (${formatElapsed(recordedMs)}) was recovered — play or download it, or Discard to clear it.`,
    );
    updateControls();
  }

  /* ---------------------------------------------------------------------- */
  /*  Wiring                                                                 */
  /* ---------------------------------------------------------------------- */

  micBtn.addEventListener('click', () => void toggleMic());
  recordBtn.addEventListener('click', () => startRecording());
  pauseBtn.addEventListener('click', () => pauseRecording());
  resumeBtn.addEventListener('click', () => resumeRecording());
  stopBtn.addEventListener('click', () => stopRecording());
  discardBtn.addEventListener('click', () => discardRecording());
  formatSelect.addEventListener('change', () => {
    takeFormat = formatSelect.value === 'webm' ? 'webm' : 'wav';
  });

  // Offer only the formats this browser can really produce.
  if (!AudioCtor) {
    const wavOption = formatSelect.querySelector<HTMLOptionElement>('option[value="wav"]')!;
    if (wavOption) wavOption.disabled = true;
    if (formatSelect.value === 'wav') formatSelect.value = 'webm';
  }
  if (!hasRecorder || !supportsWebm(isTypeSupported)) {
    const webmOption = formatSelect.querySelector<HTMLOptionElement>('option[value="webm"]')!;
    if (webmOption) webmOption.disabled = true;
    if (formatSelect.value === 'webm' && AudioCtor) formatSelect.value = 'wav';
  }
  takeFormat = formatSelect.value === 'webm' ? 'webm' : 'wav';

  const cleanup = (): void => {
    controller?.abort();
    controller = null;
    stopTimer();
    closeMic();
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

  updateControls();
  void recoverCheckpoint();

  if (!formatsUsable) {
    fail(
      'This browser cannot record audio.',
      'It has neither MediaRecorder nor the Web Audio API — try a recent Chrome, Edge or Firefox.',
    );
  }
}
