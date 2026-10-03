import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './base64-file.meta';

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function decode(text: string): Uint8Array {
  const normalized = text.replace(/\s+/g, '').replace(/^data:[^,]*;base64,/i, '');
  if (
    !normalized ||
    normalized.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)
  ) {
    throw new ToolError('Invalid Base64 input.', 'Provide a complete Base64 string or data URI.');
  }
  try {
    const binary = atob(normalized);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new ToolError('Invalid Base64 input.', 'Provide a complete Base64 string or data URI.');
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const { files, signal, onProgress } = input;
  const options = resolveOptions(meta, input.options);
  if (!files.length) throw new ToolError('Choose a file.');
  const file = files[0]!;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const mode = String(options.mode);
  if (mode === 'encode') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const encoded = encode(bytes);
    onProgress?.(1, 'Done');
    return {
      outputs: [
        { filename: `${file.name}.base64.txt`, blob: new Blob([encoded], { type: 'text/plain' }) },
      ],
      report: { output: encoded, render: 'code', language: 'text' },
      stats: { inputBytes: bytes.length, encodedCharacters: encoded.length },
    };
  }
  if (mode === 'decode') {
    const decoded = decode(await file.text());
    const filename = String(options.outputName || 'decoded.bin').replace(/[\\/\0]/g, '_');
    onProgress?.(1, 'Done');
    return {
      outputs: [{ filename, blob: new Blob([decoded.slice().buffer as ArrayBuffer]) }],
      stats: { inputCharacters: file.size, outputBytes: decoded.length },
    };
  }
  throw new ToolError(`Unknown mode "${mode}".`, 'Use encode or decode.');
}

const tool: FileToolModule = { meta, run };
export default tool;
