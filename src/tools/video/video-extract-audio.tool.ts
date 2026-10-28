import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { resolveOptions } from '@/lib/options';
import { extractAudio } from './video-extract-audio.core';
import { meta } from './video-extract-audio.meta';
import { loadVideoEngine } from '@/lib/video';

/*
 * Lazy loading: this module is only pulled in when the tool runs (the registry
 * turns `*.tool.ts` into a lazy `import()` factory), and the video engine
 * (~180 KB) is itself imported on demand inside `loadVideoEngine()`, so
 * the tool page and the other tools never download it.
 */

function firstFile(input: FileRunInput): File {
  if (!input.files?.length) throw new ToolError('Choose a file.');
  return input.files[0]!;
}

function abort(input: FileRunInput) {
  if (input.signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const file = firstFile(input);

  input.onProgress?.(0.02, 'Reading the file');
  const bytes = new Uint8Array(await file.arrayBuffer());
  abort(input);

  input.onProgress?.(0.1, 'Loading the video engine');
  const engine = await loadVideoEngine();
  abort(input);

  input.onProgress?.(0.3, 'Extracting audio');
  const result = await extractAudio(
    file,
    {
      outputFormat: String(o.outputFormat || 'mp3'),
      bitrate: String(o.bitrate || '192'),
      channels: String(o.channels || 'stereo'),
      sampleRate: String(o.sampleRate || 'original'),
    },
    { signal: input.signal },
    engine,
  );
  abort(input);

  // The core returns stats with format, channels, sampleRate, bitrate
  const stats = result.stats;
  const ext = stats.codec === 'wav' ? 'wav' : stats.codec === 'aac' ? 'm4a' : 'mp3';
  const filename = file.name.replace(/\.[^.]+$/, '') + `-audio.${ext}`;

  input.onProgress?.(1, 'Done');

  return {
    outputs: [{ filename, blob: result.blob }],
    notes: [
      `Extracted ${stats.channels} channel${stats.channels !== 1 ? 's' : ''} at ${stats.sampleRate} Hz.`,
      `Format: ${stats.codec.toUpperCase()}${stats.bitrate ? ` (${stats.bitrate} kbps)` : ''}.`,
    ],
    stats: {
      format: stats.codec.toUpperCase(),
      ...(stats.bitrate ? { bitrate: String(stats.bitrate) } : {}),
      channels: stats.channels,
      sampleRate: stats.sampleRate,
      input: formatBytes(bytes.byteLength),
      output: formatBytes(result.blob.size),
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
