import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './audio-to-wav.meta';
import { decodeFile, remixChannels, resampleChannel, toWavBlob } from './lib';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose at least one audio file.');

  const outputs = [];
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
    channels = channels.map((ch) => resampleChannel(ch, audio.sampleRate, targetRate));
    outputs.push({
      filename: `${files[i]!.name.replace(/\.[^.]*$/, '') || 'audio'}.wav`,
      blob: toWavBlob(channels, targetRate),
    });
  }

  onProgress?.(1, 'Done');
  return { outputs, stats: { files: outputs.length } };
}

const tool: FileToolModule = { meta, run };
export default tool;
