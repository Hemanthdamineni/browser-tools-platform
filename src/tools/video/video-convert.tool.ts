/**
 * Convert a video between containers.
 *
 * The heavy work happens in the tool worker, so the page never freezes. The
 * file is demuxed with the shared Mediabunny-based engine (`@/lib/video`) and
 * rewritten with Mediabunny's `Conversion` API:
 *
 *   - the `format` option says which container is written;
 *   - the `copy` option says whether the encoded packets may be reused
 *     (`'preferred'`), must be reused (`'forced'`) or must not be reused at
 *     all (`copy: false`).
 *
 * That is the whole point of the tool: when the chosen container can hold the
 * codecs of the source, the encoded packets are written into the new file
 * untouched — a remux, which is lossless and takes seconds. When they cannot,
 * the affected tracks are decoded and encoded again.
 *
 * The pure parts — the container and copy-mode resolution, the
 * remux-vs-re-encode verdict and the report — live in `./video-convert.core`
 * so they can be unit-tested without a browser codec.
 *
 * Nothing leaves the device: the file is read from the local `File` and the
 * result is written back into a Blob.
 */

import type { FileRunInput, FileRunResult, FileToolModule, OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  assertDecodeBudget,
  assertVideoFile,
  loadVideoEngine,
  openVideo,
  openVideoWith,
  type VideoEngine,
} from '@/lib/video';
import type {
  ConversionCopyOptions,
  ConversionOptions,
  DiscardedTrack,
  OutputTrack,
} from 'mediabunny';
import {
  buildConvertReport,
  classifyConvertMode,
  convertOutputFilename,
  describeDiscardReason,
  resolveContainerSpec,
  resolveConvertSettings,
  CONVERT_MAX_INPUT_BYTES,
  type ConvertContainerSpec,
  type ConvertDiscardedTrack,
  type ConvertModeVerdict,
  type ConvertSettings,
  type ConvertSourceInfo,
} from './video-convert.core';
import { meta } from './video-convert.meta';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface ConvertRunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** Everything the tool learned about a finished conversion. */
export interface ConvertResult {
  /** The bytes of the converted file. */
  bytes: Uint8Array;
  /** Name of the download. */
  filename: string;
  /** MIME type of the converted file. */
  mimeType: string;
  /** Duration of the source clip, or `null` when it could not be read. */
  inputDurationSeconds: number | null;
  /** Size of the source file in bytes. */
  inputSizeBytes: number;
  /** Size of the converted file in bytes. */
  outputSizeBytes: number;
  /** The container that was written. */
  container: ConvertContainerSpec;
  /** Whether the conversion was a remux or a re-encode. */
  verdict: ConvertModeVerdict;
  /** Codec string of the video track before the conversion. */
  inputVideoCodec: string | null;
  /** Codec string of the video track after the conversion. */
  outputVideoCodec: string | null;
  /** Codec string of the audio track before the conversion. */
  inputAudioCodec: string | null;
  /** Codec string of the audio track after the conversion. */
  outputAudioCodec: string | null;
  /** Whether the source had audio that is not in the result. */
  audioDropped: boolean;
  /** Tracks the engine left out. */
  discarded: ConvertDiscardedTrack[];
  /** Whether the audio track was asked for. */
  keepAudio: boolean;
}

/** The whole conversion, injectable so the tool's plumbing can be tested. */
export type ConvertFn = (
  file: File,
  options: OptionValues,
  ctx: ConvertRunContext,
) => Promise<ConvertResult>;

/* -------------------------------------------------------------------------- */
/*  Engine helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Build the Mediabunny output format for a container. */
function createOutputFormat(
  engine: VideoEngine,
  container: ConvertContainerSpec['kind'],
): InstanceType<VideoEngine['OutputFormat']> {
  switch (container) {
    case 'webm':
      return new engine.WebMOutputFormat();
    case 'mkv':
      return new engine.MkvOutputFormat();
    case 'mov':
      return new engine.MovOutputFormat();
    default:
      return new engine.Mp4OutputFormat();
  }
}

/**
 * Translate the copy mode into Mediabunny's copy options.
 *
 * `false` means “never copy”: every track is decoded and encoded again.
 */
function copyOptions(settings: ConvertSettings): ConversionCopyOptions | false {
  if (settings.copyMode === 'never') return false;
  return { mode: settings.copyMode === 'forced' ? 'forced' : 'preferred' };
}

/** The codec string of a track, or `null` when the container does not say. */
async function readTrackCodec(track: {
  getDecoderConfig(): Promise<{ codec: string } | null>;
}): Promise<string | null> {
  try {
    const config = await track.getDecoderConfig();
    return config?.codec ?? null;
  } catch {
    return null;
  }
}

/** Pull the codec strings out of a MIME type such as `video/mp4; codecs="avc1.42E01E"`. */
function parseMimeCodecs(mimeType: string): string[] {
  const match = /codecs\s*=\s*"([^"]*)"/i.exec(mimeType ?? '');
  if (!match) return [];
  return match[1]!
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Whether an output track carries the source's encoded packets.
 *
 * Mediabunny writes copied packets through an `EncodedVideoPacketSource`
 * (or its audio twin) and re-encoded frames through a sample source, so the
 * source class tells us exactly what happened.
 */
function isCopiedTrack(engine: VideoEngine, track: OutputTrack): boolean {
  if (track.isVideoTrack()) {
    const cls = engine.EncodedVideoPacketSource;
    return typeof cls === 'function' && track.source instanceof cls;
  }
  if (track.isAudioTrack()) {
    const cls = engine.EncodedAudioPacketSource;
    return typeof cls === 'function' && track.source instanceof cls;
  }
  return false;
}

interface OutputFact {
  /** Codec string of the track in the result. */
  codec: string | null;
  /** Whether the encoded packets were reused. */
  copied: boolean;
}

/** Read the codecs and the copy state of the tracks in the finished file. */
async function readOutputFacts(
  engine: VideoEngine,
  output: InstanceType<VideoEngine['Output']>,
): Promise<{ video: OutputFact | null; audio: OutputFact | null }> {
  let codecs: string[] = [];
  try {
    codecs = parseMimeCodecs(await output.getMimeType());
  } catch {
    // The codec strings are a nicety — the copy check below still works.
  }
  const tracks = output.tracks.map((track, index) => ({
    type: track.type,
    codec: codecs[index] ?? null,
    copied: isCopiedTrack(engine, track),
  }));
  return {
    video: tracks.find((track) => track.type === 'video') ?? null,
    audio: tracks.find((track) => track.type === 'audio') ?? null,
  };
}

/** The tracks the engine left out, with the reason it gave. */
function describeDiscarded(tracks: DiscardedTrack[]): ConvertDiscardedTrack[] {
  return tracks.map((entry) => ({
    type: entry.track.type,
    reason: entry.reason,
  }));
}

/** Why a conversion is impossible, in one sentence. */
function invalidReason(discarded: ConvertDiscardedTrack[]): string {
  const reasons = new Set(discarded.map((track) => track.reason));
  if (reasons.has('no_encodable_target_codec')) {
    return 'This browser cannot encode a codec the chosen output container accepts. Pick another container, or keep the one of the source file.';
  }
  if (reasons.has('undecodable_source_codec')) {
    return 'This browser cannot decode the codec of the source file, so it cannot be re-encoded.';
  }
  if (reasons.has('cannot_copy')) {
    return 'The conversion cannot be made without re-encoding, and “remux only” mode forbids that. Use “remux when possible” instead.';
  }
  if (reasons.has('max_track_count_of_type_reached')) {
    return 'The chosen output container cannot hold this many tracks.';
  }
  return 'Try a different output container, or a source file this browser can handle.';
}

/* -------------------------------------------------------------------------- */
/*  The conversion                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Convert a clip to the requested container.
 *
 * The engine can be injected, which is how the tests exercise every branch —
 * a remux, a re-encode, a discarded track — without a real browser codec.
 */
export async function convertVideo(
  file: File,
  options: OptionValues,
  ctx: ConvertRunContext,
  engine?: VideoEngine,
): Promise<ConvertResult> {
  ctx.signal?.throwIfAborted?.();
  assertVideoFile(file, CONVERT_MAX_INPUT_BYTES);

  ctx.onProgress?.(0.04, 'Loading the video engine');
  const resolved = engine ?? (await loadVideoEngine());

  const opened = engine
    ? await openVideoWith(resolved, file, { signal: ctx.signal, onProgress: ctx.onProgress })
    : await openVideo(file, { signal: ctx.signal, onProgress: ctx.onProgress });

  try {
    if (!opened.videoTrack) {
      throw new ToolError(
        'This file has no video track.',
        'It looks like an audio-only file — the audio tools can inspect it instead.',
      );
    }

    const source: ConvertSourceInfo = { formatName: opened.formatName };
    const settings = resolveConvertSettings(options, source);
    const container = resolveContainerSpec(settings.format, opened.formatName);

    // A re-encode decodes every frame, so the frame size decides how much
    // memory the conversion may use.
    assertDecodeBudget(
      await opened.videoTrack.getDisplayWidth(),
      await opened.videoTrack.getDisplayHeight(),
    );

    const inputVideoCodec = await readTrackCodec(opened.videoTrack);
    const inputAudioCodec = opened.audioTrack ? await readTrackCodec(opened.audioTrack) : null;

    ctx.onProgress?.(0.12, 'Preparing the output');
    const target = new resolved.BufferTarget();
    const output = new resolved.Output({
      format: createOutputFormat(resolved, container.kind),
      target,
    });

    const conversionOptions: ConversionOptions = {
      input: opened.input,
      output,
      // Only the primary video and audio track are kept — a file with several
      // of them would be converted into something nobody asked for.
      tracks: 'primary',
      copy: copyOptions(settings),
      video: {},
      audio: settings.keepAudio ? {} : { discard: true },
      showWarnings: false,
    };
    const conversion = await resolved.Conversion.init(conversionOptions);

    const discarded = describeDiscarded(conversion.discardedTracks);
    if (!conversion.isValid) {
      throw new ToolError(
        'This clip cannot be converted into the chosen output format.',
        invalidReason(discarded),
      );
    }

    conversion.onProgress = (fraction) => {
      const clamped = Math.min(1, Math.max(0, fraction));
      ctx.onProgress?.(0.12 + 0.85 * clamped, 'Converting the video');
    };

    const onAbort = (): void => {
      void conversion.cancel();
    };
    ctx.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      await conversion.execute();
    } catch (error) {
      if (ctx.signal?.aborted || isCancellation(error)) {
        throw new DOMException('The operation was cancelled.', 'AbortError');
      }
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        'The video could not be converted.',
        'The file may be damaged, or its codec may not be supported by this browser. Try another clip.',
      );
    } finally {
      ctx.signal?.removeEventListener('abort', onAbort);
    }

    ctx.onProgress?.(0.98, 'Finishing the file');
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new ToolError('The conversion came out empty.', 'The source file may be damaged.');
    }
    const bytes = new Uint8Array(buffer);

    const facts = await readOutputFacts(resolved, output);
    const outVideo = facts.video;
    const outAudio = facts.audio;

    const mode = classifyConvertMode({
      video: {
        inputCodec: inputVideoCodec,
        outputCodec: outVideo?.codec ?? null,
        copied: outVideo?.copied ?? false,
      },
      audio: outAudio
        ? {
            inputCodec: inputAudioCodec,
            outputCodec: outAudio.codec,
            copied: outAudio.copied,
          }
        : null,
      copyMode: settings.copyMode,
      discarded,
    });

    ctx.onProgress?.(1, 'Done');
    return {
      bytes,
      filename: convertOutputFilename(file.name, container.extension),
      mimeType: container.mimeType,
      inputDurationSeconds: opened.durationSeconds,
      inputSizeBytes: file.size,
      outputSizeBytes: bytes.byteLength,
      container,
      verdict: mode,
      inputVideoCodec,
      outputVideoCodec: outVideo?.codec ?? null,
      inputAudioCodec,
      outputAudioCodec: outAudio?.codec ?? null,
      audioDropped: opened.audioTrack !== null && outAudio === null,
      discarded,
      keepAudio: settings.keepAudio,
    };
  } finally {
    opened.dispose();
  }
}

/** Whether an error is Mediabunny's “the conversion was cancelled”. */
function isCancellation(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || !('name' in error)) return false;
  return error.name === 'ConversionCanceledError' || error.name === 'AbortError';
}

/* -------------------------------------------------------------------------- */
/*  Tool                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Run the conversion and turn it into the workbench's result shape: the
 * converted file as a download, plus a table that says whether the file was a
 * lossless remux or a re-encode.
 */
export async function runVideoConvert(
  input: FileRunInput,
  convert: ConvertFn = convertVideo,
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) throw new ToolError('Choose a video file.');
  if (files.length > 1) {
    throw new ToolError(`Choose one video file — ${files.length} were selected.`);
  }
  const file = files[0]!;

  const result = await convert(file, o, { signal, onProgress });

  const blob = new Blob([result.bytes.slice().buffer as ArrayBuffer], {
    type: result.mimeType,
  });

  const report = buildConvertReport({
    fileName: file.name,
    inputSizeBytes: result.inputSizeBytes,
    outputSizeBytes: result.outputSizeBytes,
    inputDurationSeconds: result.inputDurationSeconds,
    container: result.container,
    verdict: result.verdict,
    inputVideoCodec: result.inputVideoCodec,
    outputVideoCodec: result.outputVideoCodec,
    inputAudioCodec: result.inputAudioCodec,
    outputAudioCodec: result.outputAudioCodec,
    discarded: result.discarded,
  });

  const notes: string[] = [];
  const warnings: string[] = [];

  if (result.verdict.lossless) {
    notes.push('The encoded packets were copied untouched, so the conversion is lossless.');
  } else if (result.verdict.kind === 'copy') {
    notes.push(
      'The encoded packets were reused, but the codec of the result could not be verified.',
    );
  } else if (result.verdict.kind === 'mixed') {
    notes.push(
      'Part of the file was remuxed and part was re-encoded — the re-encoded part lost a little quality.',
    );
  } else {
    notes.push(
      'The media was decoded and encoded again, so the result is not bit-identical to the source.',
    );
  }
  if (result.audioDropped) {
    notes.push('The audio track is not part of the result — the file holds the picture only.');
  }
  if (result.discarded.length) {
    warnings.push(
      `The ${result.discarded.map((track) => track.type).join(' and ')} track could not be included in the output — ${describeDiscardReason(result.discarded[0]!.reason)}.`,
    );
  }
  if (result.outputSizeBytes > result.inputSizeBytes) {
    warnings.push(
      'The converted file is larger than the original — re-encoding can do that. A remux keeps the size close to the source.',
    );
  }

  return {
    outputs: [{ filename: result.filename, blob }],
    report: { output: JSON.stringify(report), render: 'table' },
    notes,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      container: result.container.label,
      sizeBytes: result.outputSizeBytes,
      inputSizeBytes: result.inputSizeBytes,
      method: result.verdict.kind,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runVideoConvert(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
