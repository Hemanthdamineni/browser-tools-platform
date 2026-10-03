import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-trim.meta';
import { decodeFile, parseTime, toWavBlob } from './lib';

function applyEdgeFade(channels: Float32Array[], fadeIn: number, fadeOut: number): void {
  const length = channels[0]?.length ?? 0;
  for (let i = 0; i < length; i++) {
    let gain = 1;
    if (fadeIn > 0 && i < fadeIn) gain = Math.min(gain, i / fadeIn);
    if (fadeOut > 0 && i >= length - fadeOut) gain = Math.min(gain, (length - 1 - i) / fadeOut);
    for (const channel of channels) channel[i] = channel[i]! * Math.max(0, gain);
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files.length) throw new ToolError('Choose an audio file.');
  const file = input.files[0]!;
  input.onProgress?.(0.1, 'Decoding');
  const audio = await decodeFile(file);
  input.signal?.throwIfAborted?.();

  const startSec = parseTime(String(o.start ?? '0'));
  const endSec = String(o.end ?? '').trim() === ''
    ? (audio.channels[0]?.length ?? 0) / audio.sampleRate
    : parseTime(String(o.end));
  const duration = (audio.channels[0]?.length ?? 0) / audio.sampleRate;
  if (startSec < 0 || startSec >= duration || endSec <= startSec || endSec > duration) {
    throw new ToolError('The selected trim range is outside the audio file.', `Choose a range between 0 and ${duration.toFixed(3)} seconds.`);
  }

  const startFrame = Math.floor(startSec * audio.sampleRate);
  const endFrame = Math.min(audio.channels[0]!.length, Math.floor(endSec * audio.sampleRate));
  const channels = audio.channels.map((ch) => ch.slice(startFrame, endFrame));
  const frameCount = channels[0]?.length ?? 0;
  const fadeInFrames = Math.min(frameCount, Math.max(0, Math.round(Number(o.fadeIn ?? 0) * audio.sampleRate / 1000)));
  const fadeOutFrames = Math.min(frameCount, Math.max(0, Math.round(Number(o.fadeOut ?? 0) * audio.sampleRate / 1000)));
  applyEdgeFade(channels, fadeInFrames, fadeOutFrames);

  input.onProgress?.(1, 'Done');
  return {
    outputs: [{ filename: `${file.name.replace(/\.[^.]*$/, '') || 'audio'}-trimmed.wav`, blob: toWavBlob(channels, audio.sampleRate) }],
    stats: { duration: (frameCount / audio.sampleRate).toFixed(3), sampleRate: audio.sampleRate },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
