import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import { meta } from './file-metadata.meta';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function modified(ms: number): string {
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString();
}

async function sha256(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const options = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose at least one file.');
  const rows: string[][] = [];
  let totalBytes = 0;
  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = files[i]!;
    const hash = options.hash ? await sha256(file) : '—';
    rows.push([file.webkitRelativePath || file.name, file.type || 'application/octet-stream', formatBytes(file.size), modified(file.lastModified), hash]);
    totalBytes += file.size;
    onProgress?.((i + 1) / files.length, `Reading ${file.name}`);
  }
  return {
    outputs: [],
    report: { output: JSON.stringify({ headers: ['Name', 'MIME type', 'Size', 'Modified', 'SHA-256'], rows }), render: 'table' },
    stats: { files: files.length, totalBytes },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
