import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './base64.meta';

const STD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

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

function run(input: TextRunInput): TextRunResult {
  const { text, options } = input;
  const mode = String(options.mode ?? 'encode');
  const urlSafe = Boolean(options.urlSafe);

  if (!text) return { output: '' };

  if (mode === 'encode') {
    let b64 = bytesToBase64(new TextEncoder().encode(text));
    if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (options.wrap) b64 = b64.replace(/.{76}/g, '$&\n');
    return {
      output: b64,
      render: 'code',
      language: 'base64',
      stats: {
        'input bytes': new TextEncoder().encode(text).length,
        'output chars': b64.replace(/\n/g, '').length,
      },
    };
  }

  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(base64ToBytes(text));
  return {
    output: decoded,
    stats: { 'output chars': decoded.length },
    notes: decoded.includes('�')
      ? ['Output contains replacement characters — the data may not be UTF-8 text.']
      : undefined,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
