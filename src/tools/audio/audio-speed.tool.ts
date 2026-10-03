import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-speed.meta';
import { decodeFile, resampleChannel, toWavBlob } from './lib';

/**
 * WSOLA-lite, per-channel, with a fixed 50% overlap and cross-correlation
 * alignment over a small search radius. Rate > 1 shortens the output.
 */
export function stretchChannel(input: Float32Array, rate: number): Float32Array {
  if (!input.length || rate === 1) return input.slice(0);
  const windowSize = Math.min(1024, Math.max(64, Math.floor(input.length / 4)));
  const synthesisHop = Math.max(1, Math.floor(windowSize / 2));
  const analysisHop = Math.max(1, Math.round(synthesisHop * rate));
  const searchRadius = Math.min(128, synthesisHop >> 2);
  const outLength = Math.max(1, Math.round(input.length / rate));
  const out = new Float32Array(outLength + windowSize);
  const weights = new Float32Array(out.length);

  let outPos = 0;
  let inputPos = 0;
  while (outPos < outLength) {
    if (outPos > 0) {
      const predicted = inputPos;
      let best = Math.min(input.length - windowSize, Math.max(0, predicted));
      let bestScore = -Infinity;
      const refStart = Math.max(0, outPos - windowSize + synthesisHop);
      for (
        let candidate = Math.max(0, predicted - searchRadius);
        candidate <= Math.min(input.length - windowSize, predicted + searchRadius);
        candidate++
      ) {
        let corr = 0;
        let energy = 0;
        for (let j = 0; j < synthesisHop; j++) {
          const a = out[refStart + j]!;
          const b = input[candidate + j]!;
          corr += a * b;
          energy += b * b;
        }
        const score = energy > 0 ? corr / Math.sqrt(energy) : -Infinity;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      inputPos = best;
    }
    const frame = Math.max(0, Math.min(input.length - windowSize, inputPos));
    for (let j = 0; j < windowSize && outPos + j < out.length; j++) {
      // Hann window provides smooth overlap-add edges.
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / Math.max(1, windowSize - 1));
      out[outPos + j] = (out[outPos + j] ?? 0) + input[frame + j]! * w;
      weights[outPos + j] = (weights[outPos + j] ?? 0) + w;
    }
    outPos += synthesisHop;
    inputPos += analysisHop;
  }
  const result = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) result[i] = weights[i]! > 1e-6 ? out[i]! / weights[i]! : 0;
  return result;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) throw new ToolError('Choose an audio file.');
  const ratePercent = Number(o.rate ?? 100);
  if (!Number.isFinite(ratePercent) || ratePercent < 25 || ratePercent > 400) {
    throw new ToolError('Speed must be between 25% and 400%.');
  }
  const rate = ratePercent / 100;
  const preservePitch = o.preservePitch === true;

  input.onProgress?.(0.1, 'Decoding');
  const audio = await decodeFile(input.files[0]!);
  input.signal?.throwIfAborted?.();
  // Down-sample to fewer frames so playback at the original sample rate is
  // faster; up-sampling to more frames makes it slower.
  const channels = audio.channels.map((ch) =>
    preservePitch
      ? stretchChannel(ch, rate)
      : resampleChannel(ch, audio.sampleRate, audio.sampleRate / rate),
  );

  input.onProgress?.(1, 'Done');
  const duration = (channels[0]?.length ?? 0) / audio.sampleRate;
  const warnings = preservePitch
    ? ['Pitch preservation is approximate; time stretching may add artifacts.']
    : ['Resampling changes pitch as well as playback speed.'];
  return {
    outputs: [
      {
        filename: `${input.files[0]!.name.replace(/\.[^.]*$/, '') || 'audio'}-${ratePercent}pct.wav`,
        blob: toWavBlob(channels, audio.sampleRate),
      },
    ],
    warnings,
    stats: {
      ratePercent,
      duration: duration.toFixed(3),
      preservePitch: preservePitch ? 'yes (approximate)' : 'no',
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
