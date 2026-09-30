import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-merge.meta';
import { clampChannels, dbToGain, decodeFile, remixChannels, resampleChannel, toWavBlob } from './lib';

function rms(channels: Float32Array[]): number {
  let sum = 0;
  let count = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) { sum += ch[i]! ** 2; count++; }
  return count ? Math.sqrt(sum / count) : 0;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (files.length < 2) throw new ToolError('Choose at least two audio files to merge.');

  const decoded = [];
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onProgress?.(i / files.length * 0.4, `Decoding ${files[i]!.name}`);
    decoded.push(await decodeFile(files[i]!));
  }
  const sampleRate = Math.max(...decoded.map((a) => a.sampleRate));
  const channelCount: 1 | 2 = decoded.some((a) => a.channels.length > 1) ? 2 : 1;
  let tracks = decoded.map((a) => {
    let channels = remixChannels(a.channels, channelCount);
    if (a.sampleRate !== sampleRate) channels = channels.map((c) => resampleChannel(c, a.sampleRate, sampleRate));
    return channels;
  });

  if (o.matchLoudness === true) {
    const target = tracks.map(rms).filter((v) => v > 0).sort((a, b) => a - b)[Math.floor(tracks.length / 2)] ?? 0;
    if (target > 0) tracks = tracks.map((t) => {
      const level = rms(t);
      const gain = level > 0 ? target / level : 1;
      return t.map((ch) => {
        const copy = ch.slice(0);
        for (let i = 0; i < copy.length; i++) copy[i] = copy[i]! * gain;
        return copy;
      });
    });
  }

  const mode = String(o.mode ?? 'concat');
  let channels: Float32Array[];
  if (mode === 'mix') {
    const length = Math.max(...tracks.map((t) => t[0]!.length));
    channels = Array.from({ length: channelCount }, (_, c) => {
      const output = new Float32Array(length);
      for (const track of tracks) for (let i = 0; i < track[c]!.length; i++) output[i] = output[i]! + track[c]![i]!;
      return output;
    });
    const peak = Math.max(...channels.map((ch) => {
      let p = 0;
      for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i]!));
      return p;
    }));
    if (peak > 1) {
      const gain = dbToGain(-20 * Math.log10(peak));
      channels = channels.map((ch) => {
        const out = ch.slice(0);
        for (let i = 0; i < out.length; i++) out[i] = out[i]! * gain;
        return out;
      });
    }
  } else {
    const gapFrames = Math.max(0, Math.round(Number(o.gapMs ?? 0) * sampleRate / 1000));
    if (!Number.isFinite(gapFrames)) throw new ToolError('Enter a valid gap duration.');
    const totalLength = tracks.reduce((sum, t) => sum + t[0]!.length, 0) + gapFrames * (tracks.length - 1);
    channels = Array.from({ length: channelCount }, () => new Float32Array(totalLength));
    let offset = 0;
    tracks.forEach((track, trackIndex) => {
      for (let c = 0; c < channelCount; c++) channels[c]!.set(track[c]!, offset);
      offset += track[0]!.length + (trackIndex < tracks.length - 1 ? gapFrames : 0);
    });
  }
  clampChannels(channels);

  onProgress?.(1, 'Done');
  return {
    outputs: [{ filename: 'merged.wav', blob: toWavBlob(channels, sampleRate) }],
    stats: { files: files.length, mode, sampleRate, duration: (channels[0]!.length / sampleRate).toFixed(3) },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
