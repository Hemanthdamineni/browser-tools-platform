import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-gain.meta';
import { dbToGain, decodeFile, toWavBlob } from './lib';

/** Apply a linear gain to a channel; hard limit or tanh-soft-clip the result. */
export function applyGain(
  channel: Float32Array,
  gain: number,
  hardClip: boolean,
): { data: Float32Array; clipped: boolean } {
  const out = channel.slice(0);
  let clipped = false;
  for (let i = 0; i < out.length; i++) {
    const v = out[i]! * gain;
    if (hardClip) {
      if (v > 1 || v < -1) clipped = true;
      out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    } else {
      out[i] = Math.tanh(v); // smooth saturation, never exceeds ±1
    }
  }
  return { data: out, clipped };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) throw new ToolError('Choose an audio file.');
  const gainDb = Number(o.gainDb ?? 0);
  if (!Number.isFinite(gainDb)) throw new ToolError('Enter a valid gain in dB.');
  const hardClip = o.hardClip !== false;
  const gain = dbToGain(gainDb);

  input.onProgress?.(0.1, 'Decoding');
  const audio = await decodeFile(input.files[0]!);
  input.signal?.throwIfAborted?.();
  let clipped = false;
  const channels = audio.channels.map((ch) => {
    const r = applyGain(ch, gain, hardClip);
    clipped ||= r.clipped;
    return r.data;
  });

  input.onProgress?.(1, 'Done');
  const warnings =
    clipped && hardClip
      ? ['Clipping detected: raise headroom or use soft clipping to avoid distortion.']
      : undefined;
  return {
    outputs: [
      {
        filename: `${input.files[0]!.name.replace(/\.[^.]*$/, '') || 'audio'}-gain.wav`,
        blob: toWavBlob(channels, audio.sampleRate),
      },
    ],
    warnings,
    stats: { gainDb, clipped: clipped && hardClip ? 'yes' : 'no' },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
