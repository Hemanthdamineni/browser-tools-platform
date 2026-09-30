import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { gzipSync, gunzipSync } from 'fflate';
import { meta } from './gzip.meta';
const GZIP_MAGIC = [0x1f, 0x8b];
function sniff(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}
function stripGz(name: string): string {
  return /\.gz$/i.test(name) ? name.slice(0, -3) : name;
}
async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const o = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose a file.');
  const file = files[0]!;
  const raw = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const mode = String(o.mode);
  let output: Uint8Array;
  let outName: string;
  let action: 'compress' | 'decompress';
  if (mode === 'auto') {
    if (sniff(raw)) {
      try { output = gunzipSync(raw); } catch { throw new ToolError('Could not decompress this file.', 'It starts with gzip magic bytes but is not a valid gzip stream.'); }
      outName = stripGz(file.name) || file.name + '.out';
      action = 'decompress';
    } else {
      output = gzipSync(raw, { level: Math.max(0, Math.min(9, Number(o.level) || 0)) as 0|1|2|3|4|5|6|7|8|9 });
      outName = /\.gz$/i.test(file.name) ? file.name : file.name + '.gz';
      action = 'compress';
    }
  } else if (mode === 'compress') {
    output = gzipSync(raw, { level: Math.max(0, Math.min(9, Number(o.level) || 0)) as 0|1|2|3|4|5|6|7|8|9 });
    outName = /\.gz$/i.test(file.name) ? file.name : file.name + '.gz';
    action = 'compress';
  } else if (mode === 'decompress') {
    if (!sniff(raw)) throw new ToolError('Not a gzip file.', 'Gzip streams start with the bytes 1F 8B.');
    try { output = gunzipSync(raw); } catch { throw new ToolError('Could not decompress this file.', 'It starts with gzip magic bytes but is not a valid gzip stream.'); }
    outName = stripGz(file.name) || file.name + '.out';
    action = 'decompress';
  } else {
    throw new ToolError(`Unknown mode "${mode}".`, 'Use auto, compress or decompress.');
  }
  onProgress?.(1, 'Done');
  return {
    outputs: [{ filename: outName, blob: new Blob([output.slice().buffer as ArrayBuffer]) }],
    stats: { mode: action, inputBytes: raw.length, outputBytes: output.length, ratio: raw.length ? output.length / raw.length : 0 },
  };
}
const tool: FileToolModule = { meta, run };
export default tool;