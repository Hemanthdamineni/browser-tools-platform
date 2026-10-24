/**
 * The noise-reduction panel: RNNoise denoising for a 16 kHz mono PCM track.
 *
 * Everything that is worth unit-testing lives here, pure and free of the DOM
 * and of WebAssembly:
 *
 *   - `framePcm16k` / `unframePcm16k` — split a 16 kHz track into the 480-sample
 *     frames RNNoise works on (zero-padding a short final frame) and put them
 *     back together.
 *   - `processFrames` — push the frames through one seam `DenoiseState` per
 *     `passes` round, then blend the result with the original at `strength`.
 *   - `blendPcm` — the strength maths.
 *   - `writeNoiseReductionWav` — the WAV writer (reuses the shared 16-bit PCM
 *     encoder).
 *   - `computePeaks` / `waveformComparisonSvg` — the before/after waveform.
 *
 * The RNNoise DSP call itself is the `loadRNNoiseDenoiser` seam, which stays
 * here too but is deliberately not unit-tested: it fetches the `.wasm` from
 * this origin and drives the Emscripten heap, so the tests inject a fake
 * denoiser factory instead.
 *
 * Nothing leaves the device: audio is decoded, denoised and encoded in this
 * tab, and no request is ever made.
 */
import { encodeWavPCM16 } from '@/lib/audio';
import { createDropZone, downloadBlob } from '@/lib/files';
import { formatBytes } from '@/lib/format';
import type { FileRunResult } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import {
  clearError,
  readOptions,
  renderTextResult,
  showError,
} from '@/components/workbench/shared';

/** RNNoise processes exactly 480 samples per frame at 16 kHz (30 ms). */
export const DENOISE_FRAME_SIZE = 480;
/** The only sample rate RNNoise understands. The tool always outputs this. */
export const DENOISE_SAMPLE_RATE = 16000;

/**
 * One denoiser instance. RNNoise carries state between frames (its noise
 * estimate and voice-activity history), so a pass pushes the frames through a
 * single `DenoiseState` in order — that continuity is where the temporal
 * smoothing comes from.
 */
export interface DenoiseState {
  /** Denoise one 480-sample frame; returns the denoised frame. */
  process(frame: Float32Array): Float32Array;
  /** Release the underlying resources (the wasm state and its buffers). */
  close(): void;
}

/** The seam the DSP lives behind: one `DenoiseState` per pass. */
export type DenoiseFactory = () => DenoiseState;

/* ------------------------------------------------------------------------ */
/*  Pure pipeline                                                            */
/* ------------------------------------------------------------------------ */

/**
 * Split a 16 kHz mono track into 480-sample frames. A short final frame is
 * zero-padded to a full 480 samples so RNNoise can consume it; the padded
 * length is recovered by `unframePcm16k` with the original sample count.
 */
export function framePcm16k(pcm: Float32Array): Float32Array[] {
  const frames: Float32Array[] = [];
  const full = Math.floor(pcm.length / DENOISE_FRAME_SIZE);
  for (let f = 0; f < full; f++) {
    frames.push(pcm.slice(f * DENOISE_FRAME_SIZE, (f + 1) * DENOISE_FRAME_SIZE));
  }
  const remainder = pcm.length - full * DENOISE_FRAME_SIZE;
  if (remainder > 0) {
    const tail = new Float32Array(DENOISE_FRAME_SIZE);
    tail.set(pcm.subarray(full * DENOISE_FRAME_SIZE));
    frames.push(tail);
  }
  return frames;
}

/** Reassemble processed frames into one track, keeping the first `sampleCount`. */
export function unframePcm16k(frames: Float32Array[], sampleCount: number): Float32Array {
  const out = new Float32Array(sampleCount);
  let o = 0;
  for (const frame of frames) {
    for (let i = 0; i < frame.length && o < sampleCount; i++) out[o++] = frame[i]!;
  }
  return out;
}

/**
 * The strength maths: `strength` is how much of the denoised signal to keep.
 * 0 keeps the original untouched, 1 is the fully denoised track, and anything
 * between is a linear crossfade.
 */
export function blendPcm(
  original: Float32Array,
  denoised: Float32Array,
  strength: number,
): Float32Array {
  const len = Math.min(original.length, denoised.length);
  const s = Math.max(0, Math.min(1, strength));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = denoised[i]! * s + original[i]! * (1 - s);
  return out;
}

/**
 * The frame batching pipeline: frame the input, push every frame through one
 * denoiser state per pass, reassemble and blend with the original.
 */
export function processFrames(
  original: Float32Array,
  createState: DenoiseFactory,
  passes: number,
  strength: number,
): Float32Array {
  const rounds = Math.max(1, Math.floor(passes));
  const frames = framePcm16k(original);
  let current = frames.map((frame) => frame.slice(0));
  for (let p = 0; p < rounds; p++) {
    const state = createState();
    try {
      current = current.map((frame) => state.process(frame));
    } finally {
      state.close();
    }
  }
  const denoised = unframePcm16k(current, original.length);
  return blendPcm(original, denoised, strength);
}

/**
 * WAV writer consistent with the other audio tools: a 16 kHz, mono, 16-bit PCM
 * file produced by the shared `encodeWavPCM16` encoder.
 */
export function writeNoiseReductionWav(pcm: Float32Array): Blob {
  const bytes = encodeWavPCM16([pcm], DENOISE_SAMPLE_RATE);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Peak amplitude (max abs) in each of `columns` equal time slices. */
export function computePeaks(pcm: Float32Array, columns: number): number[] {
  const cols = Math.max(1, Math.floor(columns));
  const peaks = new Array<number>(cols).fill(0);
  if (pcm.length === 0) return peaks;
  const perColumn = Math.max(1, Math.ceil(pcm.length / cols));
  for (let i = 0; i < pcm.length; i++) {
    const col = Math.min(cols - 1, Math.floor(i / perColumn));
    const a = Math.abs(pcm[i]!);
    if (a > peaks[col]!) peaks[col] = a;
  }
  return peaks;
}

/** A waveform comparison as an SVG data URL: original behind, denoised in front. */
export function waveformComparisonSvg(
  original: Float32Array,
  denoised: Float32Array,
  columns = 480,
  height = 140,
): string {
  const w = Math.max(1, Math.floor(columns));
  const h = Math.max(1, Math.floor(height));
  const orig = computePeaks(original, w);
  const den = computePeaks(denoised, w);
  const mid = h / 2;
  const path = (peaks: number[]): string =>
    peaks
      .map((p, i) => {
        const x = (i + 0.5) / w;
        const top = (mid - p * mid).toFixed(2);
        const bottom = (mid + p * mid).toFixed(2);
        return `M${x.toFixed(3)},${top} L${x.toFixed(3)},${bottom}`;
      })
      .join(' ');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `role="img" aria-label="Before and after waveform comparison" ` +
    `shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#000"/>` +
    `<path d="${path(orig)}" stroke="#666" stroke-width="1" opacity="0.6" fill="none"/>` +
    `<path d="${path(den)}" stroke="#e0402a" stroke-width="1" fill="none"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/* ------------------------------------------------------------------------ */
/*  RNNoise seam (not unit-tested)                                           */
/* ------------------------------------------------------------------------ */

let denoiserPromise: Promise<DenoiseFactory> | undefined;

/**
 * The real seam: RNNoise compiled to WebAssembly. The module factory is a
 * dynamic import so the glue chunk (and the ~110 KB wasm behind it) is only
 * downloaded the first time a run actually starts. The wasm binary is emitted
 * as a site asset via `?url` and served by `locateFile`, so it is never fetched
 * from a third party.
 */
function loadRNNoiseFromWasm(): Promise<DenoiseFactory> {
  // A failed load must not be cached: a transient fetch failure would otherwise
  // break the tool for the rest of the page's life.
  denoiserPromise ??= (async () => {
    const wasmUrl = (await import('@jitsi/rnnoise-wasm/dist/rnnoise.wasm?url')).default;
    const { default: createRNNWasmModule } = await import(
      '@jitsi/rnnoise-wasm/dist/rnnoise.js'
    );
    const module = await createRNNWasmModule({
      locateFile: (file) => (file === 'rnnoise.wasm' ? wasmUrl : file),
    });
    // One state per pass, with its heap buffers allocated once and reused for
    // every frame of that pass.
    return (): DenoiseState => {
      const state = module._rnnoise_create(0);
      if (!state) throw new Error('RNNoise could not allocate a denoiser state.');
      const input = module._malloc(DENOISE_FRAME_SIZE * 4);
      const output = module._malloc(DENOISE_FRAME_SIZE * 4);
      return {
        process(frame) {
          module.HEAPF32.set(frame, input >> 2);
          module._rnnoise_process_frame(state, output, input);
          return module.HEAPF32.slice(output >> 2, (output >> 2) + DENOISE_FRAME_SIZE);
        },
        close() {
          module._rnnoise_destroy(state);
          module._free(input);
          module._free(output);
        },
      };
    };
  })().catch((error: unknown) => {
    denoiserPromise = undefined;
    throw error;
  });
  return denoiserPromise;
}

/** The active seam. Only a test ever replaces it. */
let denoiserFactory: () => Promise<DenoiseFactory> = loadRNNoiseFromWasm;

/**
 * Swap the denoiser seam. Unit tests inject a deterministic fake here; passing
 * nothing restores the real RNNoise loader. The shipped app never calls it.
 */
export function setDenoiserFactory(factory?: () => Promise<DenoiseFactory>): void {
  denoiserFactory = factory ?? loadRNNoiseFromWasm;
}

/** Resolve the seam denoiser factory the pipeline should use. */
export function loadRNNoiseDenoiser(): Promise<DenoiseFactory> {
  return denoiserFactory();
}

/* ------------------------------------------------------------------------ */
/*  DOM mount                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Mount the noise-reduction UI into a `[data-noise-reduction-panel]` element.
 *
 * The panel owns only the browser-side flow the generic file workbench cannot
 * express: a drag-and-drop picker, a file summary and an inline player for the
 * result. The work itself — decoding, resampling to 16 kHz mono, denoising and
 * encoding — is handed to the tool's own `run()` through `runToolById`, so the
 * pipeline has exactly one implementation.
 */
export function mountNoiseReductionPanel(panel: HTMLElement): void {
  const drop = panel.querySelector<HTMLElement>('[data-nr-drop]');
  const summary = panel.querySelector<HTMLElement>('[data-nr-file-summary]');
  const runBtn = panel.querySelector<HTMLButtonElement>('[data-nr-run]');
  const cancelBtn = panel.querySelector<HTMLButtonElement>('[data-nr-cancel]');
  const resetBtn = panel.querySelector<HTMLButtonElement>('[data-nr-reset]');
  const optionsRoot = panel.querySelector<HTMLElement>('[data-nr-options]') ?? panel;
  const errorBox = panel.querySelector<HTMLElement>('[data-nr-error]');
  const progressWrap = panel.querySelector<HTMLElement>('[data-nr-progress-wrap]');
  const progressBar = panel.querySelector<HTMLElement>('[data-nr-progress-bar]');
  const progressMsg = panel.querySelector<HTMLElement>('[data-nr-progress-msg]');
  const resultWrap = panel.querySelector<HTMLElement>('[data-nr-result]');
  const reportEl = panel.querySelector<HTMLElement>('[data-nr-report]');
  const outputsEl = panel.querySelector<HTMLElement>('[data-nr-outputs]');
  const notesEl = panel.querySelector<HTMLElement>('[data-nr-notes]');

  if (
    !drop ||
    !summary ||
    !runBtn ||
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

  let file: File | undefined;
  let controller: AbortController | undefined;
  let previewUrl: string | undefined;

  /** Show a fraction (0..1) with a message, or hide the bar with `null`. */
  const setProgress = (fraction: number | null, message = ''): void => {
    if (fraction === null) {
      progressWrap.hidden = true;
      progressMsg.textContent = '';
      return;
    }
    progressWrap.hidden = false;
    progressBar.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
    progressMsg.textContent = message;
  };

  /** Release the object URL backing the result player, if any. */
  const clearPreview = (): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
  };

  /** Take the first picked clip (the comparison shows a single track). */
  const accept = (picked: File[]): void => {
    clearError(errorBox);
    clearPreview();
    file = picked[0];
    summary.textContent = file ? `${file.name} — ${formatBytes(file.size)}` : '';
    summary.hidden = !file;
    runBtn.disabled = !file;
    if (resetBtn) resetBtn.hidden = !file;
    resultWrap.hidden = true;
    setProgress(null);
  };

  const renderResult = (result: FileRunResult): void => {
    clearPreview();
    resultWrap.hidden = false;

    reportEl.replaceChildren();
    if (result.report) {
      renderTextResult(reportEl, {
        output: result.report.output,
        render: result.report.render,
        language: result.report.language,
      });
      reportEl.hidden = false;
    } else {
      reportEl.hidden = true;
    }

    outputsEl.replaceChildren();
    for (const output of result.outputs) {
      const li = document.createElement('li');
      li.className = 'rounded-lg border px-3 py-2.5';

      if (output.blob.type.startsWith('audio/')) {
        previewUrl = URL.createObjectURL(output.blob);
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'metadata';
        audio.src = previewUrl;
        audio.className = 'w-full';
        audio.setAttribute('aria-label', `Denoised audio: ${output.filename}`);
        li.appendChild(audio);
      }

      const row = document.createElement('div');
      row.className = 'mt-2 flex items-center justify-between gap-3';
      const name = document.createElement('span');
      name.className = 'truncate text-sm';
      name.textContent = `${output.filename} · ${formatBytes(output.blob.size)}`;
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'btn btn-subtle btn-sm shrink-0';
      save.textContent = 'Save';
      save.addEventListener('click', () => downloadBlob(output.blob, output.filename));
      row.append(name, save);
      li.appendChild(row);
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
  };

  const run = async (): Promise<void> => {
    if (!file || controller) return;
    clearError(errorBox);
    runBtn.disabled = true;
    if (cancelBtn) cancelBtn.hidden = false;
    setProgress(0, 'Starting');
    controller = new AbortController();
    try {
      const result = await runToolById<FileRunResult>(
        'noise-reduction',
        { files: [file], options: readOptions(optionsRoot) },
        {
          signal: controller.signal,
          onProgress: (fraction, message) => setProgress(fraction, message ?? 'Working'),
        },
      );
      renderResult(result);
      setProgress(1, 'Done');
      window.setTimeout(() => setProgress(null), 900);
    } catch (error) {
      const err = error as Error & { hint?: string };
      setProgress(null);
      if (err.name === 'AbortError') {
        showError(errorBox, 'Processing was cancelled.');
      } else {
        showError(errorBox, err.message || 'The audio could not be denoised.', err.hint);
      }
    } finally {
      controller = undefined;
      runBtn.disabled = !file;
      if (cancelBtn) cancelBtn.hidden = true;
    }
  };

  const dropZone = createDropZone(drop, {
    accept: drop.dataset.nrAccept || 'audio/*',
    onFiles: accept,
  });

  runBtn.addEventListener('click', () => void run());
  cancelBtn?.addEventListener('click', () => controller?.abort());
  resetBtn?.addEventListener('click', () => {
    accept([]);
    runBtn.disabled = true;
    if (resetBtn) resetBtn.hidden = true;
  });
  window.addEventListener('pagehide', () => {
    clearPreview();
    dropZone.destroy();
  });
}
