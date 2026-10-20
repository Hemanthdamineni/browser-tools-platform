import type { BothRunInput, BothRunResult, BothToolModule, OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './base64.meta';

const STD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Files beyond this size are refused instead of risking an out-of-memory tab. */
const MAX_FILE_BYTES = 64 * 1024 * 1024;
/** Above this many encoded characters the inline report is skipped (download only). */
const MAX_INLINE_REPORT = 1_000_000;

/** Encode bytes as standard Base64. Reports progress while walking large inputs. */
function bytesToBase64(bytes: Uint8Array, onProgress?: (fraction: number) => void): string {
  const step = 3 * 0x100000; // check progress roughly every megabyte of input
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += STD_ALPHABET[b0 >> 2];
    out += STD_ALPHABET[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? STD_ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? STD_ALPHABET[b2 & 63] : '=';
    if (onProgress && i % step === 0) onProgress(i / bytes.length);
  }
  return out;
}

/** Decode Base64 (standard or URL-safe, with or without padding/a data URI prefix). */
function base64ToBytes(input: string): Uint8Array {
  const clean = input
    .replace(/^data:[^,]*;base64,/i, '')
    .replace(/[\r\n\t ]/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = clean + '==='.slice((clean.length + 3) % 4);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(padded)) {
    throw new ToolError('Not valid Base64.', 'Check for stray characters or truncation.');
  }
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < STD_ALPHABET.length; i++) lookup[STD_ALPHABET.charCodeAt(i)] = i;

  const bytes = new Uint8Array((padded.length / 4) * 3);
  let p = 0;
  for (let i = 0; i < padded.length; i += 4) {
    const c0 = lookup[padded.charCodeAt(i)]!;
    const c1 = lookup[padded.charCodeAt(i + 1)]!;
    const c2 = padded[i + 2] === '=' ? 0 : lookup[padded.charCodeAt(i + 2)]!;
    const c3 = padded[i + 3] === '=' ? 0 : lookup[padded.charCodeAt(i + 3)]!;
    bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (padded[i + 2] !== '=') bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (padded[i + 3] !== '=') bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.subarray(0, p);
}

function applyEncodeOptions(b64: string, o: OptionValues): string {
  let out = b64;
  if (o.urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (o.wrap) out = out.replace(/.{76}/g, '$&\n');
  return out;
}

/** Strip path separators so a user-supplied name cannot escape the download folder. */
function safeFilename(name: string, fallback: string): string {
  const cleaned = name.trim().replace(/[\\/\0]/g, '_');
  return cleaned || fallback;
}

function resolveMode(o: OptionValues): 'encode' | 'decode' {
  const mode = String(o.mode ?? 'encode');
  if (mode !== 'encode' && mode !== 'decode') {
    throw new ToolError(`Unknown direction "${mode}".`, 'Choose Encode or Decode.');
  }
  return mode;
}

/** Throw an AbortError when the caller has cancelled (portable across runtimes). */
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}

function encodeText(text: string, o: OptionValues): BothRunResult {
  const bytes = new TextEncoder().encode(text);
  const b64 = applyEncodeOptions(bytesToBase64(bytes), o);
  return {
    outputs: [
      { filename: 'base64.txt', blob: new Blob([b64], { type: 'text/plain;charset=utf-8' }) },
    ],
    report: { output: b64, render: 'code', language: 'base64' },
    stats: { 'input bytes': bytes.length, 'output chars': b64.replace(/\n/g, '').length },
  };
}

function decodeText(text: string, o: OptionValues): BothRunResult {
  const bytes = base64ToBytes(text);
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return {
    outputs: [
      {
        filename: safeFilename(String(o.outputName ?? ''), 'decoded.bin'),
        blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/octet-stream' }),
      },
    ],
    report: { output: decoded },
    stats: { 'output chars': decoded.length },
    notes: decoded.includes('�')
      ? ['Output contains replacement characters — the data may not be UTF-8 text.']
      : undefined,
  };
}

async function encodeFile(
  file: File,
  o: OptionValues,
  input: BothRunInput,
): Promise<BothRunResult> {
  input.onProgress?.(0, 'Reading file');
  const bytes = new Uint8Array(await file.arrayBuffer());
  checkAbort(input.signal);
  input.onProgress?.(0.1, 'Encoding');
  const b64 = applyEncodeOptions(
    bytesToBase64(bytes, (fraction) => input.onProgress?.(0.1 + fraction * 0.9, 'Encoding')),
    o,
  );
  input.onProgress?.(1, 'Done');

  const result: BothRunResult = {
    outputs: [
      {
        filename: `${safeFilename(file.name, 'file')}.base64.txt`,
        blob: new Blob([b64], { type: 'text/plain;charset=utf-8' }),
      },
    ],
    stats: { 'input bytes': bytes.length, 'output chars': b64.replace(/\n/g, '').length },
  };
  if (b64.length <= MAX_INLINE_REPORT) {
    result.report = { output: b64, render: 'code', language: 'base64' };
  } else {
    result.notes = ['The encoded text is too large to show here — use Save to download it.'];
  }
  return result;
}

async function decodeFile(
  file: File,
  o: OptionValues,
  input: BothRunInput,
): Promise<BothRunResult> {
  input.onProgress?.(0, 'Reading file');
  const raw = await file.text();
  checkAbort(input.signal);
  if (!raw.trim()) {
    throw new ToolError('Nothing to decode.', 'The chosen file does not contain any Base64 text.');
  }
  input.onProgress?.(0.5, 'Decoding');
  const bytes = base64ToBytes(raw);
  input.onProgress?.(1, 'Done');
  return {
    outputs: [
      {
        filename: safeFilename(String(o.outputName ?? ''), 'decoded.bin'),
        blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/octet-stream' }),
      },
    ],
    stats: { 'input chars': raw.replace(/\s+/g, '').length, 'output bytes': bytes.length },
  };
}

async function run(input: BothRunInput): Promise<BothRunResult> {
  const o = resolveOptions(meta, input.options);
  const files = input.files ?? [];

  // A chosen file addresses the file workflow; pasted text addresses the text
  // workflow. A file wins when both are present, which the workbench explains.
  if (files.length > 0) {
    const file = files[0]!;
    if (file.size > MAX_FILE_BYTES) {
      throw new ToolError(
        'This file is too large to encode in the browser.',
        'Choose a file smaller than 64 MB.',
      );
    }
    const mode = resolveMode(o);
    return mode === 'encode' ? encodeFile(file, o, input) : decodeFile(file, o, input);
  }

  if (input.text === undefined) {
    // No text field at all and no file: a file-style call with nothing to work on.
    throw new ToolError('Nothing to process.', 'Choose a file, or paste text or Base64 to convert.');
  }
  if (input.text === '') {
    // An explicitly empty text input keeps its historical empty result.
    return { outputs: [], report: { output: '' } };
  }

  const mode = resolveMode(o);
  return mode === 'encode' ? encodeText(input.text, o) : decodeText(input.text, o);
}

const tool: BothToolModule = { meta, run };
export default tool;
