import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './base64.meta';

const STD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard (RFC 4648 §4) Base64 of raw bytes. */
function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += STD_ALPHABET[b0 >> 2];
    out += STD_ALPHABET[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? STD_ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? STD_ALPHABET[b2 & 63] : '=';
  }
  return out;
}

/**
 * Lenient decoder for typed text: ignores whitespace, accepts the URL-safe
 * alphabet and adds the missing padding. Throws on anything else.
 */
function base64ToBytes(input: string): Uint8Array {
  const clean = input
    .replace(/[\r\n\t ]/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = clean + '==='.slice((clean.length + 3) % 4);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(padded)) {
    throw new ToolError('Not valid Base64.', 'Check for stray characters or truncation.');
  }
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < STD_ALPHABET.length; i++) lookup[STD_ALPHABET.charCodeAt(i)] = i;

  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    const c0 = lookup[padded.charCodeAt(i)]!;
    const c1 = lookup[padded.charCodeAt(i + 1)]!;
    const c2 = padded[i + 2] === '=' ? 0 : lookup[padded.charCodeAt(i + 2)]!;
    const c3 = padded[i + 3] === '=' ? 0 : lookup[padded.charCodeAt(i + 3)]!;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (padded[i + 2] !== '=') bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (padded[i + 3] !== '=') bytes.push(((c2 & 3) << 6) | c3);
  }
  return new Uint8Array(bytes);
}

/** Base64 of a whole file, chunked so huge files do not blow the call stack. */
function encodeFileBase64(bytes: Uint8Array): string {
  // Decode in fixed chunks: a single `String.fromCharCode(...bytes)` spread
  // blows the argument limit on large files. Chunks are concatenated as one
  // binary string, which `btoa` needs.
  const chunk = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunk)
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
  return btoa(parts.join(''));
}

/**
 * Strict decoder for files: a complete Base64 string (or a data URI). A
 * truncated or malformed payload is an error — never a partial file.
 */
function decodeFileBase64(text: string): Uint8Array {
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
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    throw new ToolError('Invalid Base64 input.', 'Provide a complete Base64 string or data URI.');
  }
}

/** The file workbench shows notes but not stats, so mirror the stats as notes. */
function statNotes(stats: Record<string, string | number>): string[] {
  return Object.entries(stats).map(([key, value]) => `${key}: ${value}`);
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const mode = String(options.mode ?? 'encode');
  const urlSafe = Boolean(options.urlSafe);
  const wrap = Boolean(options.wrap);
  const files = input.files ?? [];
  const text = input.text ?? '';

  /* ---------------------------------------------------------------------- */
  /*  File path — a file was chosen. It wins over any pasted text.          */
  /* ---------------------------------------------------------------------- */
  if (files.length > 0) {
    const file = files[0]!;
    if (input.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const notes: string[] = [];
    if (text) notes.push('A file was selected, so the pasted text was ignored.');

    if (mode === 'encode') {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encoded = encodeFileBase64(bytes);
      input.onProgress?.(1, 'Done');
      return {
        outputs: [
          {
            filename: `${file.name}.base64.txt`,
            blob: new Blob([encoded], { type: 'text/plain' }),
          },
        ],
        report: { output: encoded, render: 'code', language: 'text' },
        stats: { inputBytes: bytes.length, encodedCharacters: encoded.length },
        notes,
      };
    }

    if (mode === 'decode') {
      const decoded = decodeFileBase64(await file.text());
      const filename = String(options.outputName || 'decoded.bin').replace(/[\\/\0]/g, '_');
      input.onProgress?.(1, 'Done');
      return {
        outputs: [{ filename, blob: new Blob([decoded.slice().buffer as ArrayBuffer]) }],
        stats: { inputCharacters: file.size, outputBytes: decoded.length },
        notes,
      };
    }

    throw new ToolError(`Unknown mode "${mode}".`, 'Use encode or decode.');
  }

  /* ---------------------------------------------------------------------- */
  /*  Text path — nothing was dropped in, only text was typed or pasted.     */
  /* ---------------------------------------------------------------------- */
  if (text) {
    if (mode === 'encode') {
      const bytes = new TextEncoder().encode(text);
      let b64 = bytesToBase64(bytes);
      if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      if (wrap) b64 = b64.replace(/.{76}/g, '$&\n');
      const stats = {
        'input bytes': bytes.length,
        'output chars': b64.replace(/\n/g, '').length,
      };
      return {
        outputs: [],
        report: { output: b64, render: 'code', language: 'base64' },
        stats,
        notes: statNotes(stats),
      };
    }

    if (mode === 'decode') {
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(base64ToBytes(text));
      const stats = { 'output chars': decoded.length };
      const notes = statNotes(stats);
      if (decoded.includes('\uFFFD')) {
        notes.push('Output contains replacement characters — the data may not be UTF-8 text.');
      }
      return { outputs: [], report: { output: decoded }, stats, notes };
    }

    throw new ToolError(`Unknown mode "${mode}".`, 'Use encode or decode.');
  }

  throw new ToolError(
    'Choose a file or paste some text.',
    'There is nothing to encode or decode yet.',
  );
}

const tool: FileToolModule = { meta, run };
export default tool;
