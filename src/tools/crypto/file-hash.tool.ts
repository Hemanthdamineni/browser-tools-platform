import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './file-hash.meta';

function toHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i]!.toString(16).padStart(2, '0');
  return s;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, options, signal, onProgress } = input;
  const algorithm = String(options.algorithm ?? 'SHA-256');
  const expected = String(options.expected ?? '')
    .trim()
    .toLowerCase();

  if (!files.length) throw new ToolError('Choose at least one file.');
  if (!crypto?.subtle) throw new ToolError('Web Crypto is not available in this browser.');

  const lines: string[] = [];
  const tableRows: string[][] = [];
  let matched: boolean | null = null;

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const file = files[i]!;
    onProgress?.(i / files.length, `Hashing ${file.name}`);
    const digest = await crypto.subtle.digest(algorithm, await file.arrayBuffer());
    const hex = toHex(digest);
    lines.push(`${hex}  ${file.name}`);
    tableRows.push([algorithm, hex, file.name]);
    if (expected) matched = matched === false ? false : hex === expected;
  }
  onProgress?.(1, 'Done');

  const text = lines.join('\n') + '\n';
  const warnings: string[] = [];
  if (expected) {
    warnings.push(
      matched
        ? `✅ Match: a file’s ${algorithm} equals the expected value.`
        : `❌ No file matches the expected ${algorithm} value.`,
    );
  }
  if (algorithm === 'SHA-1') warnings.push('SHA-1 is broken for security use; prefer SHA-256+.');

  return {
    outputs: [
      {
        filename:
          files.length === 1
            ? `${files[0]!.name}.${algorithm.toLowerCase()}`
            : `checksums.${algorithm.toLowerCase()}.txt`,
        blob: new Blob([text], { type: 'text/plain' }),
      },
    ],
    report: {
      output: JSON.stringify({
        headers: ['Algorithm', 'Hash', 'Filename'],
        rows: tableRows,
      }),
      render: 'table',
    },
    warnings: warnings.length ? warnings : undefined,
    stats: { files: files.length, algorithm },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
