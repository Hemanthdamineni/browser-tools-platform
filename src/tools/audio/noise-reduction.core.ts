import { ToolError } from '@/lib/types';
import { decodeFile, toWavBlob } from './lib';

export interface NoiseReductionOptions {
  mix: number; // 0-100
  vadThreshold: number; // 0-1
}

interface RnnoiseModule {
  Rnnoise: {
    new (): RnnoiseInstance;
    init?: () => Promise<void>;
  };
}

interface RnnoiseInstance {
  process_frame(input: Float32Array, output: Float32Array): number; // returns VAD probability
  free(): void;
  frame_size: number;
}

let rnnoisePromise: Promise<RnnoiseModule> | undefined;

/** Load RNNoise WASM module
 * Dynamic import is required: the WASM module (~50 KB) must be loaded lazily
 * to avoid bundling it into the main chunk. Only loaded when the tool runs.
 */
export async function loadRnnoise(): Promise<RnnoiseModule> {
  if (!rnnoisePromise) {
    rnnoisePromise = (async () => {
      const { default: init } = await import('@shiguredo/rnnoise-wasm');
      const module = await init();
      return module as RnnoiseModule;
    })().catch((error: unknown) => {
      rnnoisePromise = undefined;
      throw error;
    });
  }
  return rnnoisePromise;
}

/** Process audio through RNNoise */
export async function reduceNoise(
  channels: Float32Array[],
  sampleRate: number,
  options: NoiseReductionOptions
): Promise<Float32Array[]> {
  // RNNoise only works at 48kHz
  const TARGET_RATE = 48000;

  // Mix to mono for processing (RNNoise is mono)
  const len = Math.max(...channels.map(c => c.length));
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    mono[i] = sum / channels.length;
  }

  // Resample to 48kHz if needed
  let processAudio = mono;
  if (sampleRate !== TARGET_RATE) {
    processAudio = resampleChannel(mono, sampleRate, TARGET_RATE);
  }

  const module = await loadRnnoise();
  const denoiser = new module.Rnnoise();
  if (module.Rnnoise.init) await module.Rnnoise.init();

  const frameSize = denoiser.frame_size; // 480 samples at 48kHz = 10ms
  const numFrames = Math.ceil(processAudio.length / frameSize);

  // Pad input to frame boundary
  const paddedLength = numFrames * frameSize;
  const inputPadded = new Float32Array(paddedLength);
  inputPadded.set(processAudio);

  const outputPadded = new Float32Array(paddedLength);
  const outputFrame = new Float32Array(frameSize);
  const inputFrame = new Float32Array(frameSize);

  const mix = Math.max(0, Math.min(1, options.mix / 100));
  const vadThreshold = options.vadThreshold;

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * frameSize;
    inputFrame.set(inputPadded.subarray(offset, offset + frameSize));

    // Process frame
    const vadProb = denoiser.process_frame(inputFrame, outputFrame);

    // Apply VAD gating and mix
    const gate = vadProb >= vadThreshold ? 1 : 0.1; // Keep some ambience
    for (let i = 0; i < frameSize; i++) {
      const processed = outputFrame[i] * gate;
      const original = inputFrame[i];
      outputPadded[offset + i] = original * (1 - mix) + processed * mix;
    }
  }

  denoiser.free();

  // Resample back to original rate if needed
  let resultMono = outputPadded.subarray(0, processAudio.length);
  if (sampleRate !== TARGET_RATE) {
    resultMono = resampleChannel(resultMono, TARGET_RATE, sampleRate);
    // Trim to original length
    resultMono = resultMono.subarray(0, len);
  }

  // Return as multi-channel (duplicate mono to all channels)
  const result: Float32Array[] = [];
  for (let c = 0; c < channels.length; c++) {
    result.push(resultMono.slice(0));
  }

  return result;
}

/** Resample a single channel (copied from lib.ts to avoid circular deps) */
function resampleChannel(
  input: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return input.slice(0);
  const ratio = toRate / fromRate;
  const outLength = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i / ratio;
    const i0 = Math.floor(pos);
    if (i0 >= input.length - 1) {
      out[i] = input[input.length - 1] ?? 0;
      continue;
    }
    const frac = pos - i0;
    out[i] = input[i0]! * (1 - frac) + input[i0 + 1]! * frac;
  }
  return out;
}

/** Apply noise reduction to a file and return WAV blob */
export async function reduceNoiseFile(
  file: File,
  options: NoiseReductionOptions
): Promise<Blob> {
  const audio = await decodeFile(file);
  const processed = await reduceNoise(audio.channels, audio.sampleRate, options);
  return toWavBlob(processed, audio.sampleRate);
}