/**
 * Voice recorder — the tool module.
 *
 * The recording itself happens on the page: `getUserMedia`, the level meter
 * and `MediaRecorder` / `ScriptProcessorNode` are main-thread browser APIs, so
 * the dedicated panel (`voice-recorder.astro`) captures the take and hands the
 * finished WAV or WebM file to this module. `run()` validates it and turns it
 * into the downloadable artefact the workbench shows.
 *
 * Nothing leaves the device: the panel never uploads anything and this module
 * only reads the file it is given.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import { meta } from './voice-recorder.meta';

type RecordingFormat = 'wav' | 'webm';

/** Largest recording the tool will hand back (held in memory while written). */
const MAX_RECORDING_BYTES = 1024 * 1024 * 1024; // 1 GB

/** The container a MIME type belongs to, or `null` when it is not audio we know. */
function formatForMimeType(mime: string): RecordingFormat | null {
  const value = String(mime ?? '')
    .toLowerCase()
    .trim();
  if (!value) return null;
  const type = value.split(';')[0]!.trim();
  if (type === 'audio/wav' || type === 'audio/x-wav' || type === 'audio/wave') return 'wav';
  if (type === 'audio/webm') return 'webm';
  return null;
}

/** The container a file name suggests, or `null` when the name says nothing. */
function formatFromFileName(name: string): RecordingFormat | null {
  const value = String(name ?? '').toLowerCase();
  if (/\.wav$/.test(value)) return 'wav';
  if (/\.webm$/.test(value)) return 'webm';
  return null;
}

/** Read the container the user asked for from the option value. */
function requestedFormat(value: unknown): RecordingFormat {
  return value === 'webm' ? 'webm' : 'wav';
}

/**
 * Package a recorded take as the tool's download.
 *
 * The file the panel passes in is the raw recording. The format it is really
 * in decides the extension of the name the user gets, so a WAV take is never
 * handed out as `.webm` (and vice versa).
 */
export async function runVoiceRecorder(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files } = input;

  if (!files.length) {
    throw new ToolError(
      'Record a take first.',
      'Press the microphone on, then Record — the clip is captured in this tab and never uploaded.',
    );
  }
  if (files.length > 1) {
    throw new ToolError(
      `Keep one recording at a time — ${files.length} takes were supplied.`,
      'Record again to replace the clip on the page.',
    );
  }

  const file = files[0]!;
  if (!file.size) {
    throw new ToolError(
      'The recording is empty — there is nothing to save.',
      'Record for a second or two before pressing Stop.',
    );
  }
  if (file.size > MAX_RECORDING_BYTES) {
    throw new ToolError(
      'That recording is too large to save.',
      'Keep the take under 1 GB, or download it sooner.',
    );
  }

  input.onProgress?.(0.4, 'Reading the take');

  const detected = formatForMimeType(file.type) ?? formatFromFileName(file.name);
  const format: RecordingFormat = detected ?? requestedFormat(o.format);
  const duration = Number(o.duration);
  const durationSeconds = Number.isFinite(duration) && duration > 0 ? duration : 0;

  const notes: string[] = [
    format === 'wav'
      ? 'Recorded as WAV (uncompressed PCM) — it opens in almost every audio tool.'
      : 'Recorded as WebM (Opus) — it plays in every modern browser; convert it if you need it elsewhere.',
  ];
  notes.push('Captured in this tab — the recording was never uploaded.');

  input.onProgress?.(1, 'Done');

  return {
    outputs: [{ filename: file.name || `voice-recording.${format}`, blob: file }],
    notes,
    stats: {
      format,
      container: format,
      sizeBytes: file.size,
      sizeLabel: formatBytes(file.size),
      durationSeconds,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runVoiceRecorder(input);
}

const tool: FileToolModule = { meta, run };
export default tool;