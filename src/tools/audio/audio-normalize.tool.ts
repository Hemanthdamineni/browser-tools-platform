import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-normalize.meta';
import { amplitudeToDb, dbToGain, decodeFile, toWavBlob } from './lib';

function rmsOf(channels: Float32Array[]): number {
  let sum = 0;
  let count = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i]!;
      sum += s * s;
      count++;
    }
  }
  return count ? Math.sqrt(sum / count) : 0;
}

function peakOf(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]!));
  return peak;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) throw new ToolError('Choose an audio file.');
  const mode = String(o.mode ?? 'peak');
  const targetDb = Math.min(0, Math.max(-60, Number(o.targetDb ?? -1)));
  if (!Number.isFinite(targetDb)) throw new ToolError('Enter a valid target level.');

  input.onProgress?.(0.1, 'Decoding');
  const audio = await decodeFile(input.files[0]!);
  input.signal?.throwIfAborted?.();
  const measured = mode === 'rms' ? rmsOf(audio.channels) : peakOf(audio.channels);
  if (measured === 0) throw new ToolError('Silence cannot be normalised.');

  const gain = dbToGain(targetDb - amplitudeToDb(measured));
  const channels = audio.channels.map((ch) => {
    const out = ch.slice(0);
    for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]! * gain));
    return out;
  });

  input.onProgress?.(1, 'Done');
  return {
    outputs: [{ filename: `${input.files[0]!.name.replace(/\.[^.]*$/, '') || 'audio'}-normalized.wav`, blob: toWavBlob(channels, audio.sampleRate) }],
    stats: {
      mode,
      'gainDb': Number((20 * Math.log10(gain)).toFixed(2)),
      'newPeakDb': Number(amplitudeToDb(peakOf(channels)).toFixed(2)),
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
