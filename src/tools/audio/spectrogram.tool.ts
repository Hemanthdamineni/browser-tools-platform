import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './spectrogram.meta';
import { decodeFile } from './lib';
import {
  generateSpectrogram,
  exportSpectrogramPng,
  SpectrogramOptions,
  SpectrogramData,
} from './spectrogram.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose an audio file.');

  const file = files[0]!;
  onProgress?.(0.1, 'Decoding audio');

  const audio = await decodeFile(file);
  signal?.throwIfAborted?.();

  onProgress?.(0.3, 'Computing spectrogram');

  const options: SpectrogramOptions = {
    fftSize: Number(o.fftSize ?? 2048),
    windowType: String(o.windowType ?? 'hann') as SpectrogramOptions['windowType'],
    overlap: Number(o.overlap ?? 75) / 100,
    colorMap: String(o.colorMap ?? 'viridis') as SpectrogramOptions['colorMap'],
    minDb: Number(o.minDb ?? -100),
    maxDb: Number(o.maxDb ?? 0),
    freqMin: Number(o.freqMin ?? 20),
    freqMax: Number(o.freqMax ?? 20000),
    logScale: Boolean(o.logScale ?? true),
  };

  const data = await generateSpectrogram(audio.channels, audio.sampleRate, options);
  signal?.throwIfAborted?.();

  onProgress?.(0.8, 'Rendering PNG');

  const pngBlob = await exportSpectrogramPng(data, options, 1600, 800);

  onProgress?.(1, 'Done');

  const stem = file.name.replace(/\.[^.]+$/, '');
  return {
    outputs: [
      {
        filename: `${stem}-spectrogram.png`,
        blob: pngBlob,
        previewUrl: URL.createObjectURL(pngBlob),
      },
    ],
    stats: {
      fftSize: options.fftSize,
      frames: data.times.length,
      freqBins: data.frequencies.length,
      durationSec: data.times[data.times.length - 1] || 0,
      sampleRate: audio.sampleRate,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;