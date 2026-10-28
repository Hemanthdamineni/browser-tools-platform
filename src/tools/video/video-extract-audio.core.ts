/**
 * Video → Audio extract.
 *
 * Uses the shared Mediabunny video engine to demux a video file and extract
 * the audio track. The audio is encoded using the Conversion class.
 */
import { loadVideoEngine, openVideoWith, type VideoEngine } from '@/lib/video';
import type { ConversionOptions } from 'mediabunny';

export interface ExtractAudioRunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

export interface ExtractedAudio {
  filename: string;
  blob: Blob;
  stats: {
    duration: number | null;
    codec: string;
    channels: number;
    sampleRate: number;
    bitrate?: number;
  };
}

export type ExtractFn = (
  file: File,
  options: { outputFormat: string; bitrate?: string; channels?: string; sampleRate?: string },
  ctx: ExtractAudioRunContext,
  engine?: VideoEngine,
) => Promise<ExtractedAudio>;

export async function extractAudio(
  file: File,
  options: { outputFormat: string; bitrate?: string; channels?: string; sampleRate?: string },
  ctx: ExtractAudioRunContext = {},
  engine?: VideoEngine,
): Promise<ExtractedAudio> {
  const { signal, onProgress } = ctx;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const engineToUse = engine ?? (await loadVideoEngine());

  onProgress?.(0.1, 'Opening file…');
  const opened = await openVideoWith(engineToUse, file, { signal });

  if (!opened.audioTrack) {
    throw new Error('No audio track found in this file.');
  }

  onProgress?.(0.3, 'Preparing extraction…');

  const decoderConfig = await opened.audioTrack.getDecoderConfig();
  const _codec = decoderConfig?.codec || 'unknown';
  const originalSampleRate = await opened.audioTrack.getSampleRate();
  const originalChannels = await opened.audioTrack.getNumberOfChannels();
  const duration = opened.durationSeconds;

  // Determine output format and settings
  const outputFormat = options.outputFormat;
  let container: 'mp4' | 'webm' | 'mkv' | 'wav';
  let audioCodec: 'mp3' | 'aac' | 'pcm-s16';
  let mimeType: string;
  let fileExt: string;

  if (outputFormat === 'wav') {
    container = 'wav';
    audioCodec = 'pcm-s16' as const;
    mimeType = 'audio/wav';
    fileExt = 'wav';
  } else if (outputFormat === 'mp3') {
    container = 'mp4';
    audioCodec = 'mp3' as const;
    mimeType = 'audio/mpeg';
    fileExt = 'mp3';
  } else if (outputFormat === 'aac') {
    container = 'mp4';
    audioCodec = 'aac' as const;
    mimeType = 'audio/aac';
    fileExt = 'm4a';
  } else {
    throw new Error(`Unsupported output format: ${outputFormat}`);
  }

  // Create output format
  let outputFormatClass: InstanceType<VideoEngine['OutputFormat']>;
  // Note: container is narrowed to 'mp4' | 'wav' by the if/else above
  switch (container) {
    case 'mp4':
      outputFormatClass = new engineToUse.Mp4OutputFormat();
      break;
    case 'wav':
      throw new Error('WAVE encoding not yet implemented via Conversion');
    default:
      throw new Error('Unexpected container type');
  }

  onProgress?.(0.5, 'Extracting audio…');

  // Use Conversion to extract and encode audio
  const target = new engineToUse.BufferTarget();
  const output = new engineToUse.Output({
    format: outputFormatClass,
    target,
  });

  const conversionOptions: ConversionOptions = {
    input: opened.input,
    output,
    tracks: 'primary',
    video: { discard: true },
    audio: {
      codec: audioCodec,
      sampleRate:
        options.sampleRate === 'original' ? originalSampleRate : parseInt(String(options.sampleRate)),
      numberOfChannels:
        options.channels === 'stereo' ? 2 : options.channels === 'mono' ? 1 : originalChannels,
      bitrate: options.bitrate ? parseInt(options.bitrate) * 1000 : undefined,
      quality: 'high',
    },
    showWarnings: false,
  };

  const conversion = await engineToUse.Conversion.init(conversionOptions);

  if (!conversion.isValid) {
    throw new Error('Audio extraction failed: invalid conversion configuration');
  }

  conversion.onProgress = (fraction) => {
    onProgress?.(0.5 + 0.4 * fraction, 'Encoding audio…');
  };

  await conversion.execute({ pauseSignal: signal });

  await output.finalize();

  const encoded = target.buffer;
  if (!encoded) throw new Error('Output buffer is empty');
  const blob = new Blob([encoded], { type: mimeType });

  const stats = {
    duration: duration ?? null,
    codec: audioCodec,
    channels:
      options.channels === 'stereo'
        ? 2
        : options.channels === 'mono'
        ? 1
        : originalChannels,
    sampleRate:
      options.sampleRate === 'original'
        ? originalSampleRate
        : parseInt(String(options.sampleRate)),
    bitrate: options.bitrate ? parseInt(options.bitrate) * 1000 : undefined,
  };

  const name = `${file.name.replace(/\.[^.]*$/, '') || 'audio'}.${fileExt}`;

  return { filename: name, blob, stats };
}