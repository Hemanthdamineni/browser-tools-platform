/**
 * Pure helpers for the merged `data-uri` tool.
 *
 * The tool used to be three separate tools (`data-uri`, `image-to-datauri`,
 * `datauri-to-image`). All of the encoding lives here so it can be unit-tested
 * without a DOM: no `window`, no `document`, no network.
 */
import { ToolError } from '@/lib/types';

/** The four things the merged tool can do. */
export type DataUriMode = 'text-encode' | 'text-decode' | 'image-encode' | 'image-decode';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** MIME types whose payload is worth showing as text rather than as bytes. */
const TEXTUAL = /^(text\/|application\/(json|xml|javascript|xhtml\+xml)$|image\/svg\+xml$)/;

export interface TextEncodeOptions {
  mimeType: string;
  charset: boolean;
  encoding: 'base64' | 'url';
}

export interface DecodedDataUri {
  /** The decoded payload. */
  text: string;
  mime: string;
  /** The `;name=value` parameters, without the `;`. */
  parameters: string[];
  encoding: 'base64' | 'percent';
  /** Byte length of the decoded payload. */
  bytes: number;
  /** True when the payload is not textual and only its size is interesting. */
  binary: boolean;
}

export interface ParsedDataUri {
  mime: string;
  parameters: string[];
  isBase64: boolean;
  payload: string;
}

/**
 * Map an option value onto a mode. The legacy `encode` / `decode` values of the
 * old text tool are still understood so an old bookmark or a saved option set
 * keeps working.
 */
export function normalizeMode(value: unknown): DataUriMode {
  const raw = String(value ?? '').trim();
  switch (raw) {
    case 'text-encode':
    case 'text-decode':
    case 'image-encode':
    case 'image-decode':
      return raw;
    case 'encode':
      return 'text-encode';
    case 'decode':
      return 'text-decode';
    default:
      throw new ToolError('Choose a supported mode.');
  }
}

/** True when the mode needs a file rather than a text input. */
export function modeNeedsFile(mode: DataUriMode): boolean {
  return mode === 'image-encode';
}

/** Encode bytes as standard base64 (no line breaks). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/**
 * Decode base64 into bytes. Throws on anything that is not valid base64 — a
 * malformed payload is a user error, never something to guess at.
 */
export function base64ToBytes(payload: string): Uint8Array<ArrayBuffer> {
  const clean = payload.replace(/\s+/g, '');
  if (clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new Error('Invalid base64 payload.');
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** UTF-8 text → base64. */
export function encodeTextBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

/** base64 → UTF-8 text. Throws when the bytes are not valid UTF-8. */
export function decodeTextBase64(payload: string): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(payload));
}

/** Build a `data:` URI for a UTF-8 text payload. */
export function encodeTextToDataUri(text: string, options: TextEncodeOptions): string {
  const mime = options.mimeType.trim() || 'text/plain';
  const charset = options.charset ? ';charset=utf-8' : '';
  if (options.encoding === 'url') {
    return `data:${mime}${charset},${encodeURIComponent(text)}`;
  }
  return `data:${mime}${charset};base64,${encodeTextBase64(text)}`;
}

/** Split a `data:` URI into its parts. Throws when it is not one. */
export function parseDataUri(uri: string): ParsedDataUri {
  const match = /^data:([^;,]*)((?:;[^;,]+)*?)(;base64)?,([\s\S]*)$/.exec(uri.trim());
  if (!match) throw new ToolError('Not a data: URI.');
  const parameters = (match[2] ?? '').split(';').filter((p) => p && p !== 'base64');
  return {
    mime: match[1] || 'text/plain',
    parameters,
    isBase64: Boolean(match[3]),
    payload: match[4] ?? '',
  };
}

/** Decode a `data:` URI into text plus the facts about its payload. */
export function decodeDataUriToText(uri: string): DecodedDataUri {
  const parsed = parseDataUri(uri);
  let text: string;
  if (parsed.isBase64) {
    try {
      text = decodeTextBase64(parsed.payload);
    } catch {
      throw new ToolError('The payload could not be decoded.', 'Malformed base64.');
    }
  } else {
    try {
      text = decodeURIComponent(parsed.payload);
    } catch {
      throw new ToolError('The payload could not be decoded.', 'Malformed percent-escaping.');
    }
  }
  const bytes = new TextEncoder().encode(text).length;
  return {
    text,
    mime: parsed.mime,
    parameters: parsed.parameters,
    encoding: parsed.isBase64 ? 'base64' : 'percent',
    bytes,
    binary: !TEXTUAL.test(parsed.mime) && !parsed.mime.startsWith('text/'),
  };
}

/** Build a `data:` URI for binary content (an image, for instance). */
export function bytesToDataUri(bytes: Uint8Array, mime: string): string {
  const type = mime.trim() || 'application/octet-stream';
  return `data:${type};base64,${bytesToBase64(bytes)}`;
}

/**
 * Parse an `image/*` data URI into its declared MIME type and raw bytes.
 * Throws when the URI is not an image data URI or its payload is malformed.
 */
export function parseImageDataUri(uri: string): { mime: string; bytes: Uint8Array<ArrayBuffer> } {
  const match = /^data:(image\/[a-z0-9.+-]+)(;base64)?,([\s\S]*)$/i.exec(uri.trim());
  if (!match) throw new ToolError('Not a valid image data URI.');
  try {
    const bytes = match[2]
      ? base64ToBytes(match[3]!)
      : new TextEncoder().encode(decodeURIComponent(match[3]!));
    return { mime: match[1]!.toLowerCase(), bytes };
  } catch {
    throw new ToolError('The image data URI payload is malformed.');
  }
}

/** The three ways an image data URI can be wrapped for pasting into code. */
export function wrapDataUri(uri: string, wrap: string, comment = false): string {
  const value =
    wrap === 'css-background'
      ? `background-image: url("${uri}");`
      : wrap === 'html-img'
        ? `<img src="${uri}" alt="">`
        : uri;
  return comment ? `/* Embedded image data URI */\n${value}` : value;
}

/**
 * The file extension for an image MIME type (`image/jpeg` → `jpg`).
 *
 * `image/svg+xml` becomes `svg`, which is what the other image tools in the
 * catalogue use (`src/tools/image/common.ts`).
 */
export function imageExtension(mime: string): string {
  const subtype = (mime.split('/')[1] ?? 'png').toLowerCase();
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'svg+xml') return 'svg';
  return subtype;
}
