import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './data-uri.meta';
import {
  bytesToDataUri,
  decodeDataUriToText,
  encodeTextToDataUri,
  imageExtension,
  normalizeMode,
  parseImageDataUri,
  wrapDataUri,
} from './data-uri.core';

/**
 * The merged data URI tool.
 *
 * It replaced three tools: `data-uri` (text ⇄ data URI), `image-to-datauri`
 * (image file → data URI) and `datauri-to-image` (data URI → image file). The
 * panel drives it, so `run()` accepts either a text payload or a file payload.
 */
type MergedInput = FileRunInput & { text?: string };

/** The text of the current payload — from the textarea or from a dropped file. */
async function payloadText(input: MergedInput): Promise<string> {
  const text = input.text ?? '';
  if (text) return text;
  const file = input.files?.[0];
  if (!file) return '';
  return await file.text();
}

/**
 * The merged tool's entry point.
 *
 * Exported so the legacy aliases (`image-to-datauri`, `datauri-to-image`) can
 * delegate to it without duplicating any logic.
 */
/** The largest image that is inlined as a data: URI — the base64 result would be ~1.33× this. */
export const MAX_INLINE_IMAGE_BYTES = 25 * 1024 * 1024;

/** Abort helper, mirroring `src/tools/image/common.ts`. */
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}

export async function run(input: MergedInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = normalizeMode(o.mode);

  if (mode === 'text-encode') {
    const text = input.text ?? '';
    if (!text) return { outputs: [] };
    const uri = encodeTextToDataUri(text, {
      mimeType: String(o.mimeType),
      charset: Boolean(o.charset),
      encoding: o.encoding === 'url' ? 'url' : 'base64',
    });
    return {
      outputs: [],
      report: { output: uri, render: 'text' },
      stats: {
        characters: text.length,
        uriLength: uri.length,
        encoding: o.encoding === 'url' ? 'percent' : 'base64',
      },
    };
  }

  if (mode === 'text-decode') {
    const text = input.text ?? '';
    if (!text) return { outputs: [] };
    const decoded = decodeDataUriToText(text);
    const notes: string[] = [];
    if (decoded.binary) notes.push(`binary payload, ${decoded.bytes} bytes`);
    return {
      outputs: [],
      report: { output: decoded.text, render: 'text' },
      notes: notes.length ? notes : undefined,
      stats: {
        'MIME type': decoded.mime,
        Parameters: decoded.parameters.join(', ') || 'none',
        Encoding: decoded.encoding,
        bytes: decoded.bytes,
      },
    };
  }

  if (mode === 'image-encode') {
    const files = input.files ?? [];
    if (!files.length) throw new ToolError('Choose an image file.');
    if (files.length !== 1) throw new ToolError('Choose exactly one image file.');
    const file = files[0]!;
    if (!file.type.startsWith('image/')) {
      throw new ToolError('The selected file is not an image.');
    }
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      throw new ToolError(
        `That image is too large to inline as a data: URI (${Math.round(file.size / (1024 * 1024))} MB).`,
        `Keep images under ${Math.round(MAX_INLINE_IMAGE_BYTES / (1024 * 1024))} MB — a data: URI is base64, so it is about a third larger than the file.`,
      );
    }
    checkAbort(input.signal);
    input.onProgress?.(0, 'Encoding image');
    const bytes = new Uint8Array(await file.arrayBuffer());
    checkAbort(input.signal);
    const uri = bytesToDataUri(bytes, file.type);
    const wrapped = wrapDataUri(uri, String(o.wrap), Boolean(o.mediaQueryComment));
    input.onProgress?.(1, 'Done');
    return {
      outputs: [
        { filename: `${file.name}.data-uri.txt`, blob: new Blob([uri], { type: 'text/plain' }) },
      ],
      report: {
        output: wrapped,
        render: 'code',
        language: o.wrap === 'html-img' ? 'html' : o.wrap === 'css-background' ? 'css' : 'text',
      },
      stats: {
        originalBytes: file.size,
        encodedBytes: uri.length,
        overheadPercent: file.size ? Math.round((uri.length / file.size - 1) * 1000) / 10 : 0,
      },
    };
  }

  // image-decode — a data URI pasted as text, or a text file that holds one.
  const files = input.files ?? [];
  if (files.length > 1) {
    throw new ToolError('Choose one text file containing an image data URI.');
  }
  const text = await payloadText(input);
  if (!text.trim()) {
    throw new ToolError('Choose one text file containing an image data URI.');
  }
  input.onProgress?.(0, 'Decoding image');
  const parsed = parseImageDataUri(text);
  const ext = imageExtension(parsed.mime);
  input.onProgress?.(1, 'Done');
  return {
    outputs: [{ filename: `image.${ext}`, blob: new Blob([parsed.bytes], { type: parsed.mime }) }],
    stats: { mime: parsed.mime, bytes: parsed.bytes.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
