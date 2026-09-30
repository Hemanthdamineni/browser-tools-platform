import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { checkAbort } from './common';
import { meta } from './datauri-to-image.meta';

/** Parse an `image/*` data URI into its declared MIME and raw bytes. */
export function parseDataUri(s: string): { mime: string; bytes: Uint8Array<ArrayBuffer> } {
  const match = /^data:(image\/[a-z0-9.+-]+)(;base64)?,([\s\S]*)$/i.exec(s.trim());
  if (!match) throw new ToolError('Not a valid image data URI.');
  try {
    const bytes = match[2]
      ? Uint8Array.from(atob(match[3]!), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(match[3]!));
    return { mime: match[1]!.toLowerCase(), bytes };
  } catch {
    throw new ToolError('The image data URI payload is malformed.');
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  if (input.files.length !== 1) throw new ToolError('Choose one text file containing an image data URI.');
  checkAbort(input.signal);
  input.onProgress?.(0, 'Reading data URI');
  const file = input.files[0]!;
  const text = await file.text();
  const parsed = parseDataUri(text);
  const ext = parsed.mime.split('/')[1]!.replace('jpeg', 'jpg');
  input.onProgress?.(1, 'Done');
  return {
    outputs: [{ filename: `image.${ext}`, blob: new Blob([parsed.bytes], { type: parsed.mime }) }],
    stats: { mime: parsed.mime, bytes: parsed.bytes.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
