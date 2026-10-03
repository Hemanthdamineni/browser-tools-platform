import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './file-split.meta';

function toHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i]!.toString(16).padStart(2, '0');
  return s;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const o = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose a file to split.');
  const file = files[0]!;
  const raw = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const total = raw.length;
  const mode = String(o.mode);
  let chunkSize: number;
  if (mode === 'by-count') {
    const n = Math.max(2, Math.floor(Number(o.count) || 2));
    chunkSize = Math.max(1, Math.ceil(total / n));
  } else if (mode === 'by-size') {
    const unit = String(o.chunkUnit) === 'KB' ? 1024 : 1024 * 1024;
    chunkSize = Math.max(1, Math.floor(Number(o.chunkSize) || 1) * unit);
  } else {
    throw new ToolError(`Unknown mode "${mode}".`, 'Use by-size or by-count.');
  }
  if (chunkSize >= total) {
    throw new ToolError(
      'The chunk size is larger than the file.',
      'Pick a smaller chunk size or more parts.',
    );
  }
  const base = file.name.replace(/\.[^./\\]+$/, '');
  const totalParts = Math.ceil(total / chunkSize);
  const width = String(totalParts).length;
  const parts: FileRunResult['outputs'] = [];
  const partList: { name: string; size: number }[] = [];
  for (let i = 0; i < totalParts; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, total);
    const chunk = raw.subarray(start, end);
    const name = `${base}.part${String(i + 1).padStart(width, '0')}`;
    parts.push({ filename: name, blob: new Blob([chunk]) });
    partList.push({ name, size: chunk.length });
    onProgress?.((i + 1) / totalParts, `Writing ${name}`);
  }
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const manifest = JSON.stringify(
    { original: file.name, size: total, sha256: toHex(digest), parts: partList },
    null,
    2,
  );
  parts.push({
    filename: `${base}.manifest.json`,
    blob: new Blob([manifest], { type: 'application/json' }),
  });
  return {
    outputs: parts,
    stats: { parts: totalParts, inputBytes: total, chunkBytes: chunkSize },
  };
}
const tool: FileToolModule = { meta, run };
export default tool;
