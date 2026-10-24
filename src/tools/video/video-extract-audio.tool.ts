/**
 * Audio extractor.
 *
 * The sound track is demuxed and decoded by the shared Mediabunny-based engine
 * (`@/lib/video`), which loads lazily on the first run and must never end up
 * in the main bundle. File tools run inside the generic tool worker, so a long
 * extraction never freezes the page: progress is streamed back and the run can
 * be cancelled.
 *
 * Nothing leaves the device, and the video track is never decoded — only the
 * primary audio track is read.
 *
 * - **WAV** is written by this tool itself: the engine decodes the track into
 *   `AudioBuffer`s, the samples are interleaved into 16-bit PCM by
 *   `./video-extract-audio.core.ts` and wrapped in a RIFF/WAVE header. No
 *   encoder is involved, so WAV works in every browser that can decode.
 * - **MP3** and **AAC** are produced by the browser's WebCodecs audio encoder
 *   via Mediabunny's `Conversion` (MP3 in a raw MP3 stream, AAC as ADTS).
 *   Availability is checked up front with `getFirstEncodableAudioCodec`; a
 *   browser without the encoder gets a clear message instead of a broken file.
 *
 * The pure parts — the format table, option resolution, channel remixing and
 * the WAV writer — live in `./video-extract-audio.core.ts` so they can be
 * unit-tested without a browser codec.
 */

import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import {
  assertVideoFile,
  describeAudioCodec,
  formatTimecode,
  loadVideoEngine,
  openVideo,
  openVideoWith,
  probeVideoFileWith,
  type VideoEngine,
} from '@/lib/video';
import {
  encodeWavPcm16,
  EXTRACT_MAX_OUTPUT_BYTES,
  EXTRACT_MAX_SOURCE_BYTES,
  extractOutputFilename,
  remixChannels,
  resolveAudioFormat,
  resolveExtractSettings,
  type ExtractSettings,
  type ExtractSourceInfo,
} from './video-extract-audio.core';
import { meta } from './video-extract-audio.meta';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface ExtractRunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** What an extraction produced. */
export interface ExtractedAudio {
  bytes: Uint8Array;
  mimeType: string;
  /** The format id the file was written in. */
  formatId: 'wav' | 'mp3' | 'aac';
  /** The codec actually used (`'pcm-s16'` for WAV, or `'mp3'`/`'aac'`). */
  codec: string;
  channelCount: number;
  sampleRate: number;
  /** Warnings raised while extracting. */
  warnings: string[];
}

/** Everything the WAV extraction needs from an opened file. */
export interface OpenedAudioSource {
  dispose(): void;
  /** Track channel count, or `null` when it could not be read. */
  channels: number | null;
  /** Track sample rate in hertz, or `null` when it could not be read. */
  sampleRate: number | null;
  /** Source codec id (`'aac'`, `'opus'`, …), or `null` when unknown. */
  codec: string | null;
  /** Human codec description for the notes. */
  codecLabel: string | null;
  durationSeconds: number | null;
  /** Iterate the decoded audio as one channel array per track channel. */
  buffers(): AsyncGenerator<{ channels: Float32Array[]; sampleRate: number }>;
}

/** The seams the tests use to drive the tool without a browser codec. */
export interface ExtractDeps {
  /** Opens the file and exposes the primary audio track. */
  open?: (file: File, ctx: ExtractRunContext) => Promise<OpenedAudioSource>;
  /** Produces WAV bytes from an open source. */
  extractWav?: (
    source: OpenedAudioSource,
    settings: ExtractSettings,
    ctx: ExtractRunContext,
  ) => Promise<ExtractedAudio>;
  /** Produces MP3/AAC bytes from the raw file. */
  extractEncoded?: (
    file: File,
    settings: ExtractSettings,
    ctx: ExtractRunContext,
  ) => Promise<ExtractedAudio>;
}

/* -------------------------------------------------------------------------- */
/*  Opening                                                                    */
/* -------------------------------------------------------------------------- */

/** Try a track property that may legitimately fail; never let it doom the run. */
async function trackProperty<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Open the file and expose its primary audio track for sample reading.
 *
 * The video track is never touched. The engine can be injected, which is how
 * the tests exercise every branch (no audio track, undecodable codec,
 * malformed container) without a real browser codec.
 */
export async function openAudioSource(
  file: File,
  ctx: ExtractRunContext,
  engine?: VideoEngine,
): Promise<OpenedAudioSource> {
  const resolved = engine ?? (await loadVideoEngine());
  ctx.signal?.throwIfAborted?.();
  const opened = engine
    ? await openVideoWith(resolved, file, { signal: ctx.signal, onProgress: ctx.onProgress })
    : await openVideo(file, { signal: ctx.signal, onProgress: ctx.onProgress });

  try {
    const track = opened.audioTrack;
    if (!track) {
      throw new ToolError(
        'This file has no audio track.',
        'There is nothing to extract — check that the clip actually has sound.',
      );
    }

    const channels = await trackProperty(() => track.getNumberOfChannels(), null);
    const sampleRate = await trackProperty(() => track.getSampleRate(), null);
    const codec = await trackProperty(() => track.getCodec(), null);
    const codecString = await trackProperty(() => track.getCodecParameterString(), null);
    const decodable = await trackProperty(() => track.canDecode(), false);
    ctx.signal?.throwIfAborted?.();

    if (!decodable) {
      throw new ToolError(
        'This browser cannot decode the audio codec used in this file.',
        'Re-export the clip with AAC, MP3, Opus or PCM audio and try again.',
      );
    }

    const codecLabel = codec ? describeAudioCodec(codec, codecString) : (codecString ?? null);

    return {
      dispose: () => opened.dispose(),
      channels,
      sampleRate,
      codec,
      codecLabel,
      durationSeconds: opened.durationSeconds,
      async *buffers() {
        // AudioSampleSink, not AudioBufferSink: the generic tool worker has
        // WebCodecs but no Web Audio, and `AudioSample.toAudioBuffer()`
        // constructs an `AudioBuffer`, which does not exist in a worker
        // global scope. Raw planar f32 copies keep the run worker-safe.
        const sink = new resolved.AudioSampleSink(track);
        for await (const sample of sink.samples()) {
          try {
            ctx.signal?.throwIfAborted?.();
            const chans: Float32Array[] = [];
            for (let c = 0; c < sample.numberOfChannels; c++) {
              const byteLength = sample.allocationSize({ planeIndex: c, format: 'f32-planar' });
              const bytes = new Uint8Array(byteLength);
              sample.copyTo(bytes, { planeIndex: c, format: 'f32-planar' });
              chans.push(new Float32Array(bytes.buffer));
            }
            yield { channels: chans, sampleRate: sample.sampleRate };
          } finally {
            sample.close();
          }
        }
      },
    };
  } catch (error) {
    opened.dispose();
    if (error instanceof ToolError) throw error;
    if (ctx.signal?.aborted) {
      throw new DOMException('The operation was cancelled.', 'AbortError');
    }
    throw new ToolError(
      'This file could not be opened for audio extraction.',
      'It may be damaged, or use a container this browser cannot read.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  WAV extraction                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read every decoded buffer, remix to the requested layout and write 16-bit
 * PCM WAV bytes with the pure core writer.
 */
export async function extractWav(
  source: OpenedAudioSource,
  settings: ExtractSettings,
  ctx: ExtractRunContext,
): Promise<ExtractedAudio> {
  // Chunks grouped by sample rate: the WAV header carries one rate, so a file
  // whose decoder reports a different rate mid-stream (never seen in practice)
  // is still written faithfully by concatenating only same-rate chunks.
  // Progress runs in the 0.1–0.95 band; the tool emits 0–0.08 while opening.
  const chunksByRate = new Map<number, Float32Array[][]>();
  let sampleRate = 0;
  let frames = 0;
  let channelCount = 0;

  let processedFrames = 0;
  const estimateFrames =
    source.durationSeconds != null && source.sampleRate
      ? source.durationSeconds * source.sampleRate
      : 0;
  for await (const chunk of source.buffers()) {
    ctx.signal?.throwIfAborted?.();
    let chans = chunk.channels;
    if (settings.channelCount != null && chans.length !== settings.channelCount) {
      chans = remixChannels(chans, settings.channelCount);
    }
    const chunkFrames = chans[0]?.length ?? 0;
    if (chunkFrames === 0) continue;
    channelCount = Math.max(channelCount, chans.length);
    sampleRate = chunk.sampleRate || sampleRate;
    const list = chunksByRate.get(chunk.sampleRate) ?? [];
    list.push(chans);
    chunksByRate.set(chunk.sampleRate, list);
    frames += chunkFrames;
    processedFrames += chunkFrames;
    if (estimateFrames > 0) {
      ctx.onProgress?.(
        Math.min(0.95, 0.1 + 0.85 * (processedFrames / estimateFrames)),
        'Reading the audio',
      );
    }
  }

  if (frames === 0 || !sampleRate) {
    throw new ToolError(
      'This file contains no readable audio samples.',
      'The sound track may be empty, or its codec may not be supported by this browser.',
    );
  }

  // One long channel array per output channel, chunks concatenated in order.
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) channels.push(new Float32Array(frames));
  let offset = 0;
  for (const list of chunksByRate.values()) {
    for (const chunk of list) {
      const chunkFrames = chunk[0]?.length ?? 0;
      for (let c = 0; c < channelCount; c++) {
        channels[c]!.set(chunk[c] ?? new Float32Array(chunkFrames), offset);
      }
      offset += chunkFrames;
    }
  }

  ctx.onProgress?.(0.98, 'Writing the WAV file');
  const bytes = encodeWavPcm16(channels, sampleRate);
  return {
    bytes,
    mimeType: 'audio/wav',
    formatId: 'wav',
    codec: 'pcm-s16',
    channelCount,
    sampleRate,
    warnings: [],
  };
}

/* -------------------------------------------------------------------------- */
/*  MP3 / AAC extraction                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Encode the audio track with the browser's WebCodecs encoder through a
 * Mediabunny `Conversion`: the video track is discarded, the primary audio
 * track is decoded, remixed to the requested layout and re-encoded.
 *
 * The browser's encoder availability is checked before any work starts; a
 * missing encoder is a clear `ToolError`, never a silent fallback.
 */
export async function extractEncoded(
  file: File,
  settings: ExtractSettings,
  ctx: ExtractRunContext,
  engine?: VideoEngine,
): Promise<ExtractedAudio> {
  const resolved = engine ?? (await loadVideoEngine());
  ctx.signal?.throwIfAborted?.();

  const codecId = settings.formatId === 'aac' ? 'aac' : 'mp3';
  const outChannels = settings.channelCount ?? (settings.channelCount ?? 2);

  const supported = await resolved.getFirstEncodableAudioCodec([codecId], {
    numberOfChannels: settings.channelCount ?? 2,
    sampleRate: 48_000,
  });
  if (supported !== codecId) {
    throw new ToolError(
      `This browser cannot encode ${settings.format.label}.`,
      'Pick WAV instead — it is produced by this tool itself and always works.',
    );
  }

  ctx.onProgress?.(0.15, 'Preparing the encoder');
  const format =
    codecId === 'aac' ? new resolved.AdtsOutputFormat() : new resolved.Mp3OutputFormat();
  const target = new resolved.BufferTarget();
  const output = new resolved.Output({ format, target });
  const input = new resolved.Input({
    formats: resolved.ALL_FORMATS,
    source: new resolved.BlobSource(file),
  });

  let conversion;
  try {
    conversion = await resolved.Conversion.init({
      input,
      output,
      // The picture is not wanted — only the sound track is converted.
      video: { discard: true },
      audio: {
        codec: codecId,
        quality: new resolved.Quality({ bitrate: settings.bitrate }),
        // Mono/stereo remixing is done by the engine during the conversion.
        ...(settings.channelCount != null
          ? { numberOfChannels: settings.channelCount }
          : {}),
        // A fresh encode, never a copy of the source packets.
        forceTranscode: true,
      },
      tracks: 'primary',
      showWarnings: false,
    });
  } catch (error) {
    disposeInput(input);
    if (error instanceof ToolError) throw error;
    throw new ToolError(
      'This file could not be prepared for audio extraction.',
      'The file may be damaged, or use a container this browser cannot read.',
    );
  }

  const discardedAudio = conversion.discardedTracks.find(
    (track: { track: { type: string }; reason: string }) => track.track.type === 'audio',
  );
  if (discardedAudio) {
    disposeInput(input);
    if (discardedAudio.reason === 'undecodable_source_codec') {
      throw new ToolError(
        'This browser cannot decode the audio codec used in this file.',
        'Re-export the clip with AAC, MP3, Opus or PCM audio and try again.',
      );
    }
    throw new ToolError(
      `The audio track could not be converted to ${settings.format.label}.`,
      'Try WAV, or a clip with standard AAC/MP3/Opus sound.',
    );
  }

  conversion.onProgress = (progress: number) => {
    const fraction = Math.min(1, Math.max(0, progress));
    ctx.onProgress?.(0.15 + 0.8 * fraction, 'Encoding the audio');
  };

  const onAbort = (): void => {
    void conversion.cancel();
  };
  ctx.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await conversion.execute();
  } catch (error) {
    if (ctx.signal?.aborted) {
      throw new DOMException('The operation was cancelled.', 'AbortError');
    }
    if (error instanceof ToolError) throw error;
    throw new ToolError(
      'The audio could not be encoded.',
      'The file may be damaged, or the browser ran out of memory. Try WAV instead.',
    );
  } finally {
    ctx.signal?.removeEventListener('abort', onAbort);
    disposeInput(input);
  }

  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) {
    throw new ToolError(
      'The encoder produced an empty file.',
      'The clip may have no audible audio — try another clip or WAV.',
    );
  }

  ctx.onProgress?.(0.97, 'Checking the result');
  // Read the produced file back with the engine, so a broken file is never
  // handed over. MP3 and ADTS are containers the engine can parse.
  const bytes = new Uint8Array(buffer);
  const verifyFile = new File([bytes.slice().buffer as ArrayBuffer], `check.${codecId}`, {
    type: settings.format.mimeType,
  });
  try {
    const probe = await probeVideoFileWith(resolved, verifyFile, {
      signal: ctx.signal,
      scanFrames: false,
      readTags: false,
      checkDecode: false,
    });
    if (!probe.audioTracks.length) throw new Error('no audio track');
  } catch (error) {
    if (ctx.signal?.aborted) {
      throw new DOMException('The operation was cancelled.', 'AbortError');
    }
    throw new ToolError(
      'The encoded file could not be read back, so it was discarded.',
      'The encoder produced something unusable — try WAV instead.',
    );
  }

  return {
    bytes,
    mimeType: settings.format.mimeType,
    formatId: codecId,
    codec: codecId,
    channelCount: outChannels,
    sampleRate: settings.channelCount ? 48_000 : 48_000,
    warnings: [],
  };
}

function disposeInput(input: { dispose?: () => void }): void {
  try {
    input.dispose?.();
  } catch {
    /* disposing is best-effort */
  }
}

/* -------------------------------------------------------------------------- */
/*  Tool                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Run the extraction and turn it into the workbench's result shape: the audio
 * file as a download, an inline summary table and the notes.
 */
export async function runVideoExtractAudio(
  input: FileRunInput,
  deps: ExtractDeps = {},
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) throw new ToolError('Choose a video file.');
  if (files.length > 1) {
    throw new ToolError(`Choose one video file — ${files.length} were selected.`);
  }
  const file = files[0]!;

  assertVideoFile(file, EXTRACT_MAX_SOURCE_BYTES);
  signal?.throwIfAborted?.();
  onProgress?.(0.02, 'Opening the video');

  const source = await (deps.open ?? openAudioSource)(file, { signal, onProgress });
  try {
    const sourceInfo: ExtractSourceInfo = {
      durationSeconds: source.durationSeconds,
      channels: source.channels,
      sampleRate: source.sampleRate,
      codec: source.codec,
      fileSize: file.size,
    };
    onProgress?.(0.08, 'Working out the settings');
    // The meta exposes one quality picker per compressed format; pick the one
    // that belongs to the chosen format.
    const formatId = resolveAudioFormat(o.format);
    const settings = resolveExtractSettings(
      { ...o, quality: formatId === 'aac' ? o.aacQuality : o.quality },
      sourceInfo,
    );

    const extracted = await (settings.formatId === 'wav'
      ? (deps.extractWav ?? extractWav)(source, settings, { signal, onProgress })
      : (deps.extractEncoded ?? extractEncoded)(file, settings, { signal, onProgress }));

    if (extracted.bytes.byteLength > EXTRACT_MAX_OUTPUT_BYTES) {
      throw new ToolError('The extracted file is too large to hand over.');
    }

    const filename = extractOutputFilename(file.name, settings.format.extension);
    const blob = new Blob([extracted.bytes.slice().buffer as ArrayBuffer], {
      type: extracted.mimeType,
    });

    const warnings = [...settings.warnings, ...extracted.warnings];
    const seconds =
      source.durationSeconds ??
      (extracted.formatId === 'wav'
        ? extracted.bytes.byteLength / (extracted.channelCount * 2 * extracted.sampleRate || 1)
        : null);

    const channelsLabel =
      extracted.channelCount === 1
        ? 'Mono'
        : extracted.channelCount === 2
          ? 'Stereo'
          : `${extracted.channelCount} channels`;
    const notes = [
      `Extracted the ${source.codecLabel ?? 'audio'} track (${channelsLabel.toLowerCase()} · ${extracted.sampleRate.toLocaleString('en-US')} Hz).`,
      `Wrote ${settings.format.label} — ${formatBytes(extracted.bytes.byteLength)} from a ${formatBytes(file.size)} video.`,
      seconds != null ? `Duration ${formatTimecode(seconds)}.` : 'Duration unknown.',
    ];

    const report = {
      output: JSON.stringify({
        headers: ['Property', 'Value'],
        rows: [
          ['Source file', `${file.name} (${formatBytes(file.size)})`],
          ['Source audio', source.codecLabel ?? 'unknown'],
          ['Output format', settings.format.label],
          [
            'Output size',
            `${formatBytes(extracted.bytes.byteLength)} (${extracted.bytes.byteLength.toLocaleString('en-US')} bytes)`,
          ],
          ['Channels', channelsLabel],
          ['Sample rate', `${extracted.sampleRate.toLocaleString('en-US')} Hz`],
          ['Duration', seconds != null ? formatTimecode(seconds) : '—'],
          [
            'Bit depth',
            extracted.formatId === 'wav'
              ? '16-bit PCM'
              : `≈${Math.round(settings.bitrate / 1000)} kbps`,
          ],
        ],
      }),
      render: 'table' as const,
    };

    onProgress?.(1, 'Done');
    return {
      outputs: [{ filename, blob }],
      report,
      notes,
      warnings: warnings.length ? warnings : undefined,
      stats: {
        sourceBytes: file.size,
        outputBytes: extracted.bytes.byteLength,
        channelCount: extracted.channelCount,
        sampleRate: extracted.sampleRate,
        durationSeconds: seconds == null ? 0 : Math.round(seconds * 100) / 100,
        format: extracted.formatId,
      },
    };
  } finally {
    source.dispose();
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runVideoExtractAudio(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
