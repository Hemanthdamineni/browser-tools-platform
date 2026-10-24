import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cbor-decoder.meta';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ITEMS = 200_000;
const MAX_DEPTH = 64;
const PREVIEW_CHARS = 60;
const UTF8 = new TextDecoder('utf-8');

interface Outline {
  path: string;
  type: string;
  preview: string;
}

interface State {
  bytes: Uint8Array;
  offset: number;
  items: number;
  maxDepth: number;
  outline: Outline[];
  interpret: boolean;
}

function fail(state: State, message: string): never {
  throw new ToolError(
    message + ' (at byte ' + state.offset + ').',
    'Check that the input is well formed CBOR.',
  );
}

function readByte(state: State): number {
  if (state.offset >= state.bytes.length) fail(state, 'Unexpected end of input');
  const byte = state.bytes[state.offset] ?? 0;
  state.offset += 1;
  return byte;
}

function readRaw(state: State, length: number): Uint8Array {
  if (state.offset + length > state.bytes.length) fail(state, 'Unexpected end of input');
  const slice = state.bytes.subarray(state.offset, state.offset + length);
  state.offset += length;
  return slice;
}

function readUnsigned(state: State, count: number): number | bigint {
  if (state.offset + count > state.bytes.length) fail(state, 'Unexpected end of input');
  let value = 0n;
  for (let i = 0; i < count; i += 1) {
    value = (value << 8n) | BigInt(state.bytes[state.offset + i] ?? 0);
  }
  state.offset += count;
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
}

function readArgument(state: State, additional: number): { value: number | bigint; indefinite: boolean } {
  if (additional < 24) return { value: additional, indefinite: false };
  if (additional === 24) return { value: readUnsigned(state, 1), indefinite: false };
  if (additional === 25) return { value: readUnsigned(state, 2), indefinite: false };
  if (additional === 26) return { value: readUnsigned(state, 4), indefinite: false };
  if (additional === 27) return { value: readUnsigned(state, 8), indefinite: false };
  if (additional === 31) return { value: 0, indefinite: true };
  return fail(state, 'Reserved additional information ' + additional);
}

function asLength(state: State, value: number | bigint): number {
  const length = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(length) || length < 0) fail(state, 'Length is not a usable number');
  if (length > MAX_ITEMS) fail(state, 'Length exceeds the ' + MAX_ITEMS + ' item limit');
  return length;
}

function peekBreak(state: State): boolean {
  return state.offset < state.bytes.length && state.bytes[state.offset] === 0xff;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function fromHex(text: string): Uint8Array {
  const out = new Uint8Array(Math.floor(text.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** IEEE 754 half precision, decoded by hand: 1 sign, 5 exponent, 10 fraction bits. */
function halfToNumber(bits: number): number {
  const sign = (bits & 0x8000) === 0 ? 1 : -1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x3ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 31) return fraction === 0 ? sign * Infinity : NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function readFloat(state: State, count: 4 | 8): number {
  if (state.offset + count > state.bytes.length) fail(state, 'Unexpected end of input');
  const view = new DataView(state.bytes.buffer, state.bytes.byteOffset + state.offset, count);
  state.offset += count;
  return count === 4 ? view.getFloat32(0) : view.getFloat64(0);
}

function clip(value: string): string {
  const flat = value.replace(/\s+/gu, ' ');
  return flat.length > PREVIEW_CHARS ? flat.slice(0, PREVIEW_CHARS - 1) + '…' : flat;
}

/** Readable, lossless rendering: JSON plus markers for things JSON cannot hold. */
function pretty(value: unknown, depth = 0): string {
  const pad = '  '.repeat(depth);
  const padInner = '  '.repeat(depth + 1);

  if (value === null) return 'null';
  if (value === undefined) return '$undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    if (Object.is(value, -0)) return '-0';
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const parts = value.map((item) => padInner + pretty(item, depth + 1));
    return '[\n' + parts.join(',\n') + '\n' + pad + ']';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const parts = entries.map(
      ([key, item]) => padInner + JSON.stringify(key) + ': ' + pretty(item, depth + 1),
    );
    return '{\n' + parts.join(',\n') + '\n' + pad + '}';
  }
  return String(value);
}

const compact = (value: unknown): string => pretty(value).replace(/\n\s*/gu, ' ');

function isBytes(value: unknown): value is { $bytes: string } {
  return typeof value === 'object' && value !== null && '$bytes' in value;
}

function childPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key) ? path + '.' + key : path + '[' + JSON.stringify(key) + ']';
}

function keyLabel(key: unknown): string {
  if (typeof key === 'string') return key;
  if (typeof key === 'number' || typeof key === 'bigint' || typeof key === 'boolean') return String(key);
  if (key === null) return 'null';
  if (key === undefined) return '$undefined';
  return compact(key);
}

function decodeItem(state: State, path: string, depth: number): unknown {
  if (depth > MAX_DEPTH) fail(state, 'Nesting is deeper than ' + MAX_DEPTH + ' levels');
  state.items += 1;
  if (state.items > MAX_ITEMS) fail(state, 'More than ' + MAX_ITEMS + ' items');
  if (depth > state.maxDepth) state.maxDepth = depth;

  const initial = readByte(state);
  const major = initial >> 5;
  const additional = initial & 0x1f;

  if (major === 7) {
    switch (additional) {
      case 20:
        state.outline.push({ path, type: 'false', preview: 'false' });
        return false;
      case 21:
        state.outline.push({ path, type: 'true', preview: 'true' });
        return true;
      case 22:
        state.outline.push({ path, type: 'null', preview: 'null' });
        return null;
      case 23:
        state.outline.push({ path, type: 'undefined', preview: '$undefined' });
        return undefined;
      case 24: {
        const simple = Number(readUnsigned(state, 1));
        state.outline.push({ path, type: 'simple(' + simple + ')', preview: String(simple) });
        return { $simple: simple };
      }
      case 25: {
        const bits = Number(readUnsigned(state, 2));
        const value = halfToNumber(bits);
        state.outline.push({ path, type: 'float16', preview: pretty(value) });
        return value;
      }
      case 26: {
        const value = readFloat(state, 4);
        state.outline.push({ path, type: 'float32', preview: pretty(value) });
        return value;
      }
      case 27: {
        const value = readFloat(state, 8);
        state.outline.push({ path, type: 'float64', preview: pretty(value) });
        return value;
      }
      case 31:
        return fail(state, 'Unexpected break code');
      default:
        if (additional < 20) {
          state.outline.push({ path, type: 'simple(' + additional + ')', preview: String(additional) });
          return { $simple: additional };
        }
        return fail(state, 'Reserved simple value ' + additional);
    }
  }

  const argument = readArgument(state, additional);

  if (major === 0) {
    if (argument.indefinite) fail(state, 'An integer cannot have an indefinite length');
    state.outline.push({ path, type: 'uint', preview: String(argument.value) });
    return argument.value;
  }

  if (major === 1) {
    if (argument.indefinite) fail(state, 'An integer cannot have an indefinite length');
    const value =
      typeof argument.value === 'bigint' ? -1n - argument.value : -1 - argument.value;
    state.outline.push({ path, type: 'nint', preview: String(value) });
    return value;
  }

  if (major === 2 || major === 3) {
    const isText = major === 3;
    let payload: Uint8Array;
    if (argument.indefinite) {
      const chunks: Uint8Array[] = [];
      for (;;) {
        if (state.offset >= state.bytes.length) fail(state, 'Unterminated indefinite-length string');
        if (peekBreak(state)) {
          state.offset += 1;
          break;
        }
        const inner = readByte(state);
        if (inner >> 5 !== major) fail(state, 'Indefinite string contains a different chunk type');
        const chunkLength = asLength(state, readArgument(state, inner & 0x1f).value);
        chunks.push(readRaw(state, chunkLength).slice());
      }
      payload = concatBytes(chunks);
    } else {
      payload = readRaw(state, asLength(state, argument.value));
    }
    if (isText) {
      const text = UTF8.decode(payload);
      state.outline.push({ path, type: 'text(' + payload.length + ')', preview: clip(text) });
      return text;
    }
    const hex = toHex(payload);
    state.outline.push({
      path,
      type: 'bytes(' + payload.length + ')',
      preview: "h'" + clip(hex) + "'",
    });
    return { $bytes: hex };
  }

  if (major === 4) {
    const row: Outline = { path, type: 'array', preview: '' };
    state.outline.push(row);
    const items: unknown[] = [];
    if (argument.indefinite) {
      for (;;) {
        if (state.offset >= state.bytes.length) fail(state, 'Unterminated indefinite-length array');
        if (peekBreak(state)) {
          state.offset += 1;
          break;
        }
        items.push(decodeItem(state, path + '[' + items.length + ']', depth + 1));
      }
    } else {
      const length = asLength(state, argument.value);
      for (let i = 0; i < length; i += 1) {
        items.push(decodeItem(state, path + '[' + i + ']', depth + 1));
      }
    }
    row.type = 'array(' + items.length + ')';
    row.preview = items.length + (items.length === 1 ? ' item' : ' items');
    return items;
  }

  if (major === 5) {
    const row: Outline = { path, type: 'map', preview: '' };
    state.outline.push(row);
    // A null prototype keeps hostile keys such as __proto__ from touching Object.
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    let count = 0;
    const take = (): void => {
      // Keys are represented by the child's path, so their own rows are dropped.
      const mark = state.outline.length;
      const rawKey = decodeItem(state, path + '<key ' + count + '>', depth + 1);
      state.outline.length = mark;
      const label = keyLabel(rawKey);
      result[label] = decodeItem(state, childPath(path, label), depth + 1);
      count += 1;
    };
    if (argument.indefinite) {
      for (;;) {
        if (state.offset >= state.bytes.length) fail(state, 'Unterminated indefinite-length map');
        if (peekBreak(state)) {
          state.offset += 1;
          break;
        }
        take();
      }
    } else {
      const length = asLength(state, argument.value);
      for (let i = 0; i < length; i += 1) take();
    }
    row.type = 'map(' + count + ')';
    row.preview = count + (count === 1 ? ' pair' : ' pairs');
    return result;
  }

  // major === 6, tags.
  const tag = typeof argument.value === 'bigint' ? Number(argument.value) : argument.value;
  state.outline.push({ path, type: 'tag(' + tag + ')', preview: 'tag ' + tag });
  const inner = decodeItem(state, path + '<tag ' + tag + '>', depth + 1);

  if (!state.interpret) return { $tag: tag, value: inner };

  if (tag === 0 && typeof inner === 'string') {
    const date = new Date(inner);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (tag === 1 && typeof inner === 'number' && Number.isFinite(inner)) {
    const date = new Date(inner * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if ((tag === 2 || tag === 3) && isBytes(inner)) {
    try {
      const magnitude = inner.$bytes === '' ? 0n : BigInt('0x' + inner.$bytes);
      return { $bignum: (tag === 3 ? -1n - magnitude : magnitude).toString() };
    } catch {
      return { $tag: tag, value: inner };
    }
  }
  if (tag === 24 && isBytes(inner)) {
    try {
      const embedded: State = {
        bytes: fromHex(inner.$bytes),
        offset: 0,
        items: 0,
        maxDepth: 0,
        outline: [],
        interpret: state.interpret,
      };
      const value = decodeItem(embedded, path + '<embedded>', 0);
      for (const entry of embedded.outline) state.outline.push(entry);
      return value;
    } catch {
      return { $tag: 24, value: inner };
    }
  }
  return { $tag: tag, value: inner };
}

function parseHexInput(text: string): Uint8Array {
  const cleaned = text.replace(/0x/giu, '').replace(/[^0-9a-f]/giu, '');
  if (cleaned === '') throw new ToolError('No hexadecimal digits found in that text.');
  if (cleaned.length % 2 !== 0) {
    throw new ToolError('Hexadecimal input has an odd number of digits.', 'Each byte needs two digits.');
  }
  return fromHex(cleaned);
}

function parseBase64Input(text: string): Uint8Array {
  const cleaned = text.replace(/\s+/gu, '').replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    throw new ToolError('That does not look like valid base64.');
  }
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const inputFormat = String(o.inputFormat ?? 'auto');
  const format = String(o.format ?? 'json') === 'table' ? 'table' : 'json';
  const interpret = o.interpretTags !== false;

  const file = input.files[0];
  let bytes: Uint8Array;
  let from = 'pasted input';

  if (file !== undefined) {
    if (file.size === 0) throw new ToolError('That file is empty.');
    bytes = new Uint8Array(await file.arrayBuffer());
    from = file.name;
  } else {
    const text = String(input.text ?? '').trim();
    if (text === '') {
      throw new ToolError('Choose a CBOR file or paste hex or base64.', 'Both a file and pasted text work.');
    }
    if (inputFormat === 'hex') bytes = parseHexInput(text);
    else if (inputFormat === 'base64') bytes = parseBase64Input(text);
    else if (/^[0-9a-f]+$/iu.test(text.replace(/0x/giu, '').replace(/[\s,]/gu, ''))) {
      bytes = parseHexInput(text);
    } else bytes = parseBase64Input(text);
  }

  if (bytes.length === 0) throw new ToolError('There are no bytes to decode.');
  if (bytes.length > MAX_BYTES) {
    throw new ToolError('That is more than 10 MB of CBOR.', 'Decode a smaller payload.');
  }

  const state: State = { bytes, offset: 0, items: 0, maxDepth: 0, outline: [], interpret };
  const values: unknown[] = [];
  let guard = 0;
  while (state.offset < bytes.length) {
    const before = state.offset;
    values.push(decodeItem(state, '$' + values.length, 0));
    if (state.offset === before) fail(state, 'The decoder made no progress');
    guard += 1;
    if (guard > MAX_ITEMS) fail(state, 'Too many top-level items');
  }

  if (values.length === 1) {
    for (const row of state.outline) row.path = row.path.replace(/^\$0/u, '$');
  }

  const notes: string[] = [];
  const warnings: string[] = [];
  if (values.length > 1) {
    notes.push('Decoded ' + values.length + ' top-level items; CBOR sequences are printed one per line.');
  }
  if (state.outline.some((row) => row.type === 'tag(24)')) {
    notes.push('Tag 24 payloads were decoded as embedded CBOR.');
  }
  if (!interpret) notes.push('Tag interpretation is off, so tags are shown as objects.');

  const stats: Record<string, string | number> = {
    bytes: bytes.length,
    items: state.items,
    topLevel: values.length,
    depth: state.maxDepth + 1,
  };

  if (format === 'table') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Path', 'Type', 'Value'],
          rows: state.outline.map((row) => [row.path, row.type, row.preview]),
        }),
        render: 'table',
      },
      notes,
      warnings,
      stats,
    };
  }

  notes.unshift('Decoded ' + from + ' (' + bytes.length + ' bytes).');
  return {
    outputs: [],
    report: {
      output: values.map((value) => pretty(value)).join('\n'),
      render: 'code',
      language: 'json',
    },
    notes,
    warnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
