import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { isAbortError, loadModel } from '@/lib/ml';
import { formatBytes, formatDuration } from '@/lib/format';
import { decodeFile, remixChannels, resampleChannel } from './lib';
import {
  checkByteCap,
  checkDurationCap,
  mergeOverlappingSegments,
  resolveModel,
  segmentsToSrt,
  segmentsToTxt,
  segmentsToVtt,
  type TranscriptSegment,
} from '../../components/panels/speech-to-text-panel';
import { meta } from './speech-to-text.meta';

/**
 * Transcribe speech on-device with Whisper (tiny.en or base).
 *
 * Both models are on the reviewed ML allow-list (`Xenova/whisper-tiny.en`,
 * `Xenova/whisper-base`, Apache-2.0). The weights are downloaded from the
 * Hugging Face Hub on first use and cached in the browser; the audio never
 * leaves the tab. Web Audio decoding needs an `OfflineAudioContext`, so this
 * tool runs on the main thread (`meta.worker = false`).
 *
 * The model call is injectable (`setTranscriber`) and the audio decode is
 * injectable (`setAudioDecoder`) so the `run()` flow can be tested without a
 * network connection or a real Web Audio stack.
 */

/** The transformers.js task that produces a transcription pipeline. */
export const MODEL_TASK = 'automatic-speech-recognition';

/** The sample rate Whisper expects. */
export const WHISPER_SAMPLE_RATE = 16000;

/** Decoded audio, as the panel + tool share it. */
export interface DecodedAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/** Everything the transcription pipeline needs for one audio clip. */
export interface TranscribeInput {
  /** 16 kHz mono samples, the format Whisper expects. */
  samples: Float32Array;
  /** Hub model id, e.g. `Xenova/whisper-base`. */
  modelId: string;
  /** `'auto'` or an ISO 639-1 code such as `'en'`. */
  language: string;
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/**
 * Turns 16 kHz mono samples into timestamped segments. Injectable so tests
 * never need the real model (or a network connection).
 */
export type Transcriber = (input: TranscribeInput) => Promise<TranscriptSegment[]>;

/** Decodes a File into raw channels. Injectable so tests skip `OfflineAudioContext`. */
export type AudioDecoder = (file: File) => Promise<DecodedAudio>;

let transcriber: Transcriber | null = null;
let audioDecoder: AudioDecoder | null = null;

/** Replace the transcription pipeline (tests). Pass `null` to restore Whisper. */
export function setTranscriber(next: Transcriber | null): void {
  transcriber = next;
}

/** Replace the audio decoder (tests). Pass `null` to restore Web Audio. */
export function setAudioDecoder(next: AudioDecoder | null): void {
  audioDecoder = next;
}

/** The default decoder: Web Audio's `OfflineAudioContext`, then down-mix to mono. */
async function decodeAudio(file: File): Promise<DecodedAudio> {
  const decoded = await decodeFile(file);
  return { channels: decoded.channels, sampleRate: decoded.sampleRate };
}

/** The default pipeline: load Whisper through the shared ML runtime and run it. */
async function transcribeWithWhisper(input: TranscribeInput): Promise<TranscriptSegment[]> {
  const loaded = await loadModel<{
    (
      audio: Float32Array,
      opts?: Record<string, unknown>,
    ): Promise<{
      text: string;
      chunks?: { text: string; timestamp: [number, number] | [null, null] }[];
    }>;
  }>({
    task: MODEL_TASK,
    model: input.modelId,
    signal: input.signal,
    onProgress: (progress) => {
      const fraction = Math.min(1, Math.max(0, progress.fraction ?? 0));
      if (progress.phase === 'downloading') {
        input.onProgress?.(
          0.05 + 0.6 * fraction,
          progress.total > 0
            ? `Downloading the model (first run only): ${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}`
            : `Downloading the model (first run only): ${formatBytes(progress.loaded)}`,
        );
      } else {
        input.onProgress?.(0.05 + 0.6 * fraction, progress.message);
      }
    },
  });

  try {
    input.onProgress?.(0.75, 'Transcribing…');
    const options: Record<string, unknown> = {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    };
    if (input.language && input.language !== 'auto') {
      options.language = input.language;
    }
    const result = await loaded.pipeline(input.samples, options);
    const chunks = result.chunks ?? [];
    const segments: TranscriptSegment[] = [];
    for (const chunk of chunks) {
      if (!Array.isArray(chunk.timestamp)) continue;
      const [start, end] = chunk.timestamp;
      if (typeof start !== 'number' || typeof end !== 'number') continue;
      if (!chunk.text?.trim()) continue;
      segments.push({ start, end, text: chunk.text });
    }
    return mergeOverlappingSegments(segments);
  } finally {
    await loaded.dispose();
  }
}

/** Turn an unexpected model failure into a friendly, user-facing error. */
function producerError(error: unknown): unknown {
  if (error instanceof ToolError || isAbortError(error)) return error;
  const detail = error instanceof Error ? error.message : String(error);
  const trimmed = detail.length > 160 ? `${detail.slice(0, 157)}…` : detail;
  return new ToolError(
    'The audio could not be transcribed.',
    trimmed
      ? `The model failed to run: ${trimmed}`
      : 'The model failed to run. Try a recent Chrome, Edge, Firefox or Safari.',
  );
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;
  if (!files.length) throw new ToolError('Choose an audio file.');

  const file = files[0]!;
  const byteError = checkByteCap(file.size);
  if (byteError) throw new ToolError(byteError, `Choose a file under 64 MB.`);

  const { modelId, englishOnly } = resolveModel(String(o.model ?? 'tiny.en'));
  const language = englishOnly ? 'auto' : String(o.language ?? 'auto');

  signal?.throwIfAborted?.();
  onProgress?.(0.03, 'Decoding the audio…');

  const decode = audioDecoder ?? decodeAudio;
  let audio: DecodedAudio;
  try {
    audio = await decode(file);
  } catch (error) {
    if (error instanceof ToolError) throw error;
    throw new ToolError(
      'This browser could not decode that audio file.',
      'Try a WAV, MP3, OGG or M4A file.',
    );
  }
  signal?.throwIfAborted?.();

  const durationSec = audio.channels[0]?.length ? audio.channels[0].length / audio.sampleRate : 0;
  const durationError = checkDurationCap(durationSec);
  if (durationError) throw new ToolError(durationError, `Keep recordings under 10 minutes.`);

  // Whisper reads 16 kHz mono samples.
  const mono = remixChannels(audio.channels, 1)[0]!;
  const samples = resampleChannel(mono, audio.sampleRate, WHISPER_SAMPLE_RATE);

  onProgress?.(0.05, 'Loading the Whisper model…');
  const produce = transcriber ?? transcribeWithWhisper;
  let segments: TranscriptSegment[];
  try {
    segments = await produce({ samples, modelId, language, signal, onProgress });
  } catch (error) {
    throw producerError(error);
  }
  signal?.throwIfAborted?.();

  const txt = segmentsToTxt(segments);
  const srt = segmentsToSrt(segments);
  const vtt = segmentsToVtt(segments);
  const stem = (file.name.replace(/\.[^.]*$/, '') || 'transcript').trim();

  onProgress?.(1, 'Done');
  return {
    outputs: [
      { filename: `${stem}.txt`, blob: new Blob([txt], { type: 'text/plain;charset=utf-8' }) },
      {
        filename: `${stem}.srt`,
        blob: new Blob([srt], { type: 'application/x-subrip;charset=utf-8' }),
      },
      { filename: `${stem}.vtt`, blob: new Blob([vtt], { type: 'text/vtt;charset=utf-8' }) },
    ],
    report: { output: txt, render: 'text' },
    notes: [
      `Transcribed with ${modelId} (${englishOnly ? 'English only' : 'multilingual'}) on your device.`,
      segments.length
        ? `${segments.length} spoken segment${segments.length === 1 ? '' : 's'}, about ${formatDuration(Math.round(durationSec * 1000))} of audio.`
        : 'No speech was recognised.',
      'The model weights are cached, so the next run starts immediately.',
    ],
    warnings: segments.length ? undefined : ['No speech was detected in this clip.'],
    stats: {
      model: modelId,
      segments: segments.length,
      durationMs: Math.round(durationSec * 1000),
      language: language === 'auto' ? 'auto' : language,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
