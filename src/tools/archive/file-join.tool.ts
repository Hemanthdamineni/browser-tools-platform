import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './file-join.meta';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const o = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose file parts to join.');
  const manifestFile = files.find((file) => file.name.endsWith('.manifest.json'));
  let ordered = files.filter((file) => file !== manifestFile && !file.name.endsWith('.manifest.json'));
  if (!ordered.length) throw new ToolError('Choose at least one chunk file.');
  if (String(o.sort) === 'name') {
    ordered = [...ordered].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  } else if (String(o.sort) !== 'upload-order') {
    throw new ToolError(`Unknown sort order "${String(o.sort)}".`);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const chunk = new Uint8Array(await ordered[i]!.arrayBuffer());
    chunks.push(chunk);
    total += chunk.length;
    onProgress?.((i + 1) / (ordered.length + (manifestFile ? 1 : 0)), `Reading ${ordered[i]!.name}`);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  const warnings: string[] = [];
  if (manifestFile) {
    try {
      const manifest = JSON.parse(await manifestFile.text()) as {
        original?: unknown; size?: unknown; sha256?: unknown; parts?: { name?: unknown; size?: unknown }[];
      };
      if (manifest.parts) {
        const expectedNames = manifest.parts.map((part) => String(part.name));
        const actualNames = ordered.map((file) => file.name);
        if (expectedNames.length !== actualNames.length || expectedNames.some((name, i) => name !== actualNames[i])) {
          warnings.push('Manifest part list does not match the selected files or their order.');
        }
        if (manifest.parts.some((part, i) => Number(part.size) !== chunks[i]?.length)) {
          warnings.push('One or more chunk sizes do not match the manifest.');
        }
      }
      if (typeof manifest.size === 'number' && manifest.size !== joined.length) warnings.push('Joined size does not match the manifest.');
      if (typeof manifest.sha256 === 'string') {
        if (!crypto?.subtle) warnings.push('Could not verify SHA-256 because Web Crypto is unavailable.');
        else {
          const hash = toHex(await crypto.subtle.digest('SHA-256', joined));
          if (hash.toLowerCase() !== manifest.sha256.toLowerCase()) warnings.push('SHA-256 checksum does not match the manifest.');
        }
      }
    } catch {
      warnings.push('Could not parse the manifest; the file was joined without manifest verification.');
    }
  }
  onProgress?.(1, 'Done');
  return {
    outputs: [{ filename: String(o.outputName || 'joined.bin'), blob: new Blob([joined]) }],
    warnings: warnings.length ? warnings : undefined,
    stats: { files: ordered.length, outputBytes: joined.length, manifest: manifestFile ? 'included' : 'not included' },
  };
}
const tool: FileToolModule = { meta, run };
export default tool;
