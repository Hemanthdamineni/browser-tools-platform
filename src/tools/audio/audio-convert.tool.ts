import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-convert.meta';
import { decodeFile, remixChannels, resampleChannel, formatDuration } from './lib';
import { loadVideoEngine } from '@/lib/video';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose at least one audio file.');

  const outputs: Array<{ filename: string; blob: Blob }> = [];
  const engine = await loadVideoEngine();
  if (!engine) throw new ToolError('WebCodecs not supported in this browser.');

  const preferred = o.format === 'mp3' ? ['mp3'] : ['aac'];
  const encoder = await engine.chooseAudioEncoder(preferred, {
    sampleRate: o.sampleRate,
    numberOfChannels: o.channels,
    bitrate: o.bitrate ? parseInt(String(o.bitrate)) * 1000 : undefined,
  });

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onProgress?.(i / files.length, `Decoding ${files[i]!.name}`);

    const audio = await decodeFile(files[i]!);
    let channels = audio.channels;
    const channelMode = String(o.channels ?? 'original');
    if (channelMode === 'mono') channels = remixChannels(channels, 1);
    else if (channelMode === 'stereo') channels = remixChannels(channels, 2);

    const targetRate =
      String(o.sampleRate ?? 'original') === 'original' ? audio.sampleRate : Number(o.sampleRate);
    if (!Number.isFinite(targetRate) || targetRate < 1)
      throw new ToolError('Choose a valid sample rate.');

    const resampled = channels.map((ch) => resampleChannel(ch, audio.sampleRate, targetRate));

    // Encode to target format
    const blob = await encodeToFormat(encoder, resampled, targetRate, o.bitrate);
    outputs.push({
      filename: buildFilename(files[i]!.name, o.format),
      blob,
    });
  }

  onProgress?.(1, 'Done');
  return { outputs, stats: { files: outputs.length } };
}

function buildFilename(original: string, format: string): string {
  const name = original.replace(/\.[^.]*$/, '');
  return `${name}.${format}`;
}

async function encodeToFormat(
  encoder: any,
  channels: Float32Array[],
  sampleRate: number,
  bitrate: string,
): Promise<Blob> {
  const ctx = { signal: null as AbortSignal | undefined };
  const encoderInstance = encoder.create(channels, sampleRate, Number(bitrate) * 1000);
  await encoderInstance.encode();
  const blob = new Blob([encoderInstance.data], { type: encoder.mime });
  return blob;
}

const tool: FileToolModule = { meta, run };
export default tool;
