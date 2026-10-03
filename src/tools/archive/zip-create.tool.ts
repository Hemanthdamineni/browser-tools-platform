import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { zip } from 'fflate';
import { meta } from './zip-create.meta';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const o = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose at least one file.');
  const entries: Record<string, Uint8Array> = {};
  let total = 0;
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = files[i]!;
    const rawName = o.flatten ? file.name.split(/[\\/]/).pop()! : file.webkitRelativePath || file.name;
    const name = rawName.replace(/\\/g, '/');
    if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new ToolError('Invalid archive path.', 'Archive entry paths must be relative and cannot contain empty, dot or traversal segments.');
    }
    entries[name] = new Uint8Array(await file.arrayBuffer());
    total += file.size;
    onProgress?.((i + 1) / files.length, `Adding ${file.name}`);
  }
  const bytes: Uint8Array = await new Promise((resolve, reject) => {
    zip(entries, { level: Math.max(0, Math.min(9, Number(o.level) || 0)) as 0|1|2|3|4|5|6|7|8|9 }, (err, data) => {
      if (err) reject(new ToolError('ZIP creation failed.', err.message));
      else resolve(data);
    });
  });
  return {
    outputs: [{ filename: String(o.zipName || 'bundle.zip'), blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' }) }],
    stats: { files: files.length, inputBytes: total, outputBytes: bytes.length, ratio: total ? bytes.length / total : 0 },
  };
}
const tool: FileToolModule = { meta, run };
export default tool;