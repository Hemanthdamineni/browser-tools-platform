import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './plist-decoder.meta';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_OBJECTS = 1_000_000;
const MAX_DEPTH = 64;
const MAX_TREE_ROWS = 2000;
const MAX_FINDINGS = 300;
const MAX_OBJECT_ROWS = 500;
const CLIP = 100;

class PlistError extends Error {}

type Node =
  | { kind: 'dict'; entries: { key: string; node: Node }[] }
  | { kind: 'array'; items: Node[] }
  | { kind: 'set'; items: Node[] }
  | { kind: 'string'; value: string; utf16: boolean }
  | { kind: 'data'; length: number; base64: string }
  | { kind: 'integer'; text: string; bytes: number }
  | { kind: 'real'; value: number; bytes: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'date'; iso: string; seconds: number }
  | { kind: 'null' }
  | { kind: 'uid'; text: string; bytes: number }
  | { kind: 'cycle' }
  | { kind: 'truncated' };

interface Finding {
  level: 'error' | 'warning' | 'note';
  problem: string;
  detail: string;
}

interface WalkState {
  rows: number;
  depth: number;
  counts: Map<string, number>;
  truncated: boolean;
  maxDepth: number;
}

const clip = (value: string, max = CLIP): string => {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const typeLabel = (node: Node): string => {
  switch (node.kind) {
    case 'dict':
      return 'dictionary';
    case 'array':
      return 'array';
    case 'set':
      return 'set';
    case 'string':
      return node.utf16 ? 'string (UTF-16)' : 'string';
    case 'data':
      return 'data';
    case 'integer':
      return 'integer (' + node.bytes + ' bytes)';
    case 'real':
      return 'real (' + node.bytes + ' bytes)';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'uid':
      return 'UID (' + node.bytes + ' bytes)';
    case 'cycle':
      return 'cycle';
    case 'truncated':
      return 'truncated';
    default:
      return 'null';
  }
};

const valueText = (node: Node, dataPreview: boolean): string => {
  switch (node.kind) {
    case 'dict':
      return '{' + node.entries.length + ' key' + (node.entries.length === 1 ? '' : 's') + '}';
    case 'array':
      return '[' + node.items.length + ' item' + (node.items.length === 1 ? '' : 's') + ']';
    case 'set':
      return 'set(' + node.items.length + ')';
    case 'string':
      return clip(node.value);
    case 'data':
      return dataPreview
        ? node.length + ' bytes: ' + clip(node.base64, 60)
        : node.length + ' bytes';
    case 'integer':
      return node.text;
    case 'real':
      return Number.isFinite(node.value) ? String(node.value) : String(node.value);
    case 'boolean':
      return node.value ? 'true' : 'false';
    case 'date':
      return node.iso;
    case 'uid':
      return 'UID ' + node.text;
    case 'cycle':
      return '(reference back to an enclosing value)';
    case 'truncated':
      return '(not expanded)';
    default:
      return 'null';
  }
};

const childCount = (node: Node): number => {
  if (node.kind === 'dict') return node.entries.length;
  if (node.kind === 'array' || node.kind === 'set') return node.items.length;
  return 0;
};

interface BinaryPlist {
  version: string;
  objectCount: number;
  topObject: number;
  offsets: number[];
  offsetIntSize: number;
  objectRefSize: number;
  offsetTableOffset: number;
  trailerStart: number;
}

function readUint64(bytes: Uint8Array, offset: number): number {
  let value = 0n;
  for (let index = 0; index < 8; index += 1) value = (value << 8n) | BigInt(bytes[offset + index] ?? 0);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new PlistError('A header field is too large to be real.');
  return Number(value);
}

function readHeader(bytes: Uint8Array): BinaryPlist {
  if (bytes.length < 40) throw new PlistError('The file is too short to be a binary plist.');
  const magic = new TextDecoder('latin1').decode(bytes.subarray(0, 6));
  if (magic !== 'bplist') throw new PlistError('The file does not start with bplist.');
  const version = new TextDecoder('latin1').decode(bytes.subarray(6, 8));
  if (version !== '00') {
    throw new PlistError('Binary plist version ' + version + ' is not supported (only bplist00 is defined).');
  }

  const trailerStart = bytes.length - 32;
  const offsetIntSize = bytes[trailerStart + 6] ?? 0;
  const objectRefSize = bytes[trailerStart + 7] ?? 0;
  const objectCount = readUint64(bytes, trailerStart + 8);
  const topObject = readUint64(bytes, trailerStart + 16);
  const offsetTableOffset = readUint64(bytes, trailerStart + 24);

  if (offsetIntSize < 1 || offsetIntSize > 8) throw new PlistError('The offset size in the trailer is invalid.');
  if (objectRefSize < 1 || objectRefSize > 8) throw new PlistError('The object reference size is invalid.');
  if (objectCount === 0) throw new PlistError('The trailer says there are no objects.');
  if (objectCount > MAX_OBJECTS) throw new PlistError('The trailer claims ' + objectCount + ' objects, which is past this tool\u2019s limit.');
  if (topObject >= objectCount) throw new PlistError('The top object index is past the end of the offset table.');

  const tableEnd = offsetTableOffset + objectCount * offsetIntSize;
  if (offsetTableOffset < 8 || tableEnd > trailerStart) {
    throw new PlistError('The offset table does not fit inside the file.');
  }

  const offsets: number[] = [];
  for (let index = 0; index < objectCount; index += 1) {
    let value = 0;
    for (let byte = 0; byte < offsetIntSize; byte += 1) {
      value = value * 256 + (bytes[offsetTableOffset + index * offsetIntSize + byte] ?? 0);
    }
    offsets.push(value);
  }

  return { version, objectCount, topObject, offsets, offsetIntSize, objectRefSize, offsetTableOffset, trailerStart };
}

interface BinaryState {
  bytes: Uint8Array;
  header: BinaryPlist;
  nodes: Map<number, Node>;
  reading: Set<number>;
  findings: Finding[];
  cyclic: boolean;
  depthExceeded: boolean;
  nonAsciiStrings: number;
  unreachable: number;
  trailingBytes: number;
}

function addFinding(findings: Finding[], level: Finding['level'], problem: string, detail: string): void {
  if (findings.length < MAX_FINDINGS) findings.push({ level, problem, detail });
}

function readLength(state: BinaryState, offset: number): { length: number; next: number } {
  const marker = state.bytes[offset] ?? 0;
  const info = marker & 0x0f;
  if (info !== 0x0f) return { length: info, next: offset + 1 };
  const intMarker = state.bytes[offset + 1] ?? 0;
  if (intMarker >> 4 !== 0x1) throw new PlistError('An extended length is not followed by an integer.');
  const intBytes = 1 << (intMarker & 0x0f);
  if (intBytes > 8) throw new PlistError('An extended length uses an integer that is too wide.');
  let length = 0;
  for (let index = 0; index < intBytes; index += 1) {
    length = length * 256 + (state.bytes[offset + 2 + index] ?? 0);
  }
  return { length, next: offset + 2 + intBytes };
}

function readRef(state: BinaryState, offset: number): number {
  let value = 0;
  for (let index = 0; index < state.header.objectRefSize; index += 1) {
    value = value * 256 + (state.bytes[offset + index] ?? 0);
  }
  return value;
}

function readIntegerBytes(state: BinaryState, offset: number, byteCount: number): bigint {
  let value = 0n;
  for (let index = 0; index < byteCount; index += 1) value = (value << 8n) | BigInt(state.bytes[offset + index] ?? 0);
  // Writers store 1, 2 and 4 byte integers unsigned, so negative values always take 8 bytes.
  // Only the 8 and 16 byte widths are two's complement.
  if (byteCount < 8) return value;
  const limit = 1n << BigInt(byteCount * 8 - 1);
  return value >= limit ? value - (limit << 1n) : value;
}

function readObject(state: BinaryState, index: number, depth: number): Node {
  const cached = state.nodes.get(index);
  if (cached !== undefined) return cached;
  if (state.reading.has(index)) {
    state.cyclic = true;
    return { kind: 'cycle' };
  }
  if (depth > MAX_DEPTH) {
    state.depthExceeded = true;
    return { kind: 'truncated' };
  }

  const offset = state.header.offsets[index];
  if (offset === undefined || offset >= state.bytes.length) throw new PlistError('An object offset points outside the file.');
  const marker = state.bytes[offset] ?? 0;
  const type = marker >> 4;
  const info = marker & 0x0f;

  state.reading.add(index);
  let node: Node;
  switch (type) {
    case 0x0: {
      if (info === 0x8) node = { kind: 'boolean', value: false };
      else if (info === 0x9) node = { kind: 'boolean', value: true };
      else node = { kind: 'null' };
      break;
    }
    case 0x1: {
      const byteCount = 1 << info;
      if (byteCount > 16) throw new PlistError('An integer object is wider than 16 bytes.');
      const value = readIntegerBytes(state, offset + 1, byteCount);
      const text = value.toString();
      if (value > 9007199254740991n || value < -9007199254740991n) {
        addFinding(
          state.findings,
          'note',
          'Integer needs more than 53 bits',
          text + ' is kept exactly as a decimal string because JavaScript numbers would round it.',
        );
      }
      node = { kind: 'integer', text, bytes: byteCount };
      break;
    }
    case 0x2: {
      const byteCount = info === 0x3 ? 8 : 4;
      const view = new DataView(state.bytes.buffer, state.bytes.byteOffset + offset + 1, byteCount);
      const value = byteCount === 8 ? view.getFloat64(0, false) : view.getFloat32(0, false);
      if (!Number.isFinite(value)) {
        addFinding(state.findings, 'note', 'A real number is not finite', 'The stored value is ' + value + '.');
      }
      node = { kind: 'real', value, bytes: byteCount };
      break;
    }
    case 0x3: {
      const view = new DataView(state.bytes.buffer, state.bytes.byteOffset + offset + 1, 8);
      const seconds = view.getFloat64(0, false);
      const iso = new Date(978307200000 + seconds * 1000).toISOString();
      if (seconds < -978307200 || seconds > 4_000_000_000) {
        addFinding(state.findings, 'note', 'A date is far outside the expected range', iso + ' is stored in this plist.');
      }
      node = { kind: 'date', iso, seconds };
      break;
    }
    case 0x4: {
      const { length, next } = readLength(state, offset);
      if (next + length > state.bytes.length) throw new PlistError('A data object runs past the end of the file.');
      node = { kind: 'data', length, base64: toBase64(state.bytes.subarray(next, next + length)) };
      break;
    }
    case 0x5: {
      const { length, next } = readLength(state, offset);
      if (next + length > state.bytes.length) throw new PlistError('A string runs past the end of the file.');
      const raw = state.bytes.subarray(next, next + length);
      if (raw.some((byte) => byte > 0x7f)) {
        state.nonAsciiStrings += 1;
        addFinding(
          state.findings,
          'note',
          'An ASCII string holds non-ASCII bytes',
          'The marker says ASCII but the bytes need UTF-8; it was decoded as UTF-8.',
        );
      }
      node = { kind: 'string', value: new TextDecoder('utf-8').decode(raw), utf16: false };
      break;
    }
    case 0x6: {
      const { length, next } = readLength(state, offset);
      const byteLength = length * 2;
      if (next + byteLength > state.bytes.length) throw new PlistError('A UTF-16 string runs past the end of the file.');
      node = {
        kind: 'string',
        value: new TextDecoder('utf-16be').decode(state.bytes.subarray(next, next + byteLength)),
        utf16: true,
      };
      break;
    }
    case 0x8: {
      const byteCount = info + 1;
      let value = 0n;
      for (let byte = 0; byte < byteCount; byte += 1) value = (value << 8n) | BigInt(state.bytes[offset + 1 + byte] ?? 0);
      node = { kind: 'uid', text: value.toString(), bytes: byteCount };
      break;
    }
    case 0xa:
    case 0xc: {
      const { length, next } = readLength(state, offset);
      if (next + length * state.header.objectRefSize > state.bytes.length) {
        throw new PlistError('A collection runs past the end of the file.');
      }
      const items: Node[] = [];
      for (let item = 0; item < length; item += 1) {
        items.push(readObject(state, readRef(state, next + item * state.header.objectRefSize), depth + 1));
      }
      node = type === 0xa ? { kind: 'array', items } : { kind: 'set', items };
      break;
    }
    case 0xd: {
      const { length, next } = readLength(state, offset);
      const refs = length * 2 * state.header.objectRefSize;
      if (next + refs > state.bytes.length) throw new PlistError('A dictionary runs past the end of the file.');
      const entries: { key: string; node: Node }[] = [];
      const seen = new Set<string>();
      for (let entry = 0; entry < length; entry += 1) {
        const keyRef = readRef(state, next + entry * state.header.objectRefSize);
        const valueRef = readRef(state, next + (length + entry) * state.header.objectRefSize);
        const keyNode = readObject(state, keyRef, depth + 1);
        const key = keyNode.kind === 'string' ? keyNode.value : valueText(keyNode, false);
        if (seen.has(key)) {
          addFinding(state.findings, 'warning', 'Duplicate key in a dictionary', 'The key "' + clip(key, 40) + '" appears more than once; the later value is the one readers see.');
        }
        seen.add(key);
        entries.push({ key, node: readObject(state, valueRef, depth + 1) });
      }
      node = { kind: 'dict', entries };
      break;
    }
    default:
      throw new PlistError('Object marker 0x' + marker.toString(16) + ' is not a type this tool knows.');
  }

  state.reading.delete(index);
  state.nodes.set(index, node);
  return node;
}

function describeObject(state: BinaryState, index: number): string[] {
  const offset = state.header.offsets[index] ?? 0;
  const marker = state.bytes[offset] ?? 0;
  const type = marker >> 4;
  const info = marker & 0x0f;
  const hex = '0x' + marker.toString(16).toUpperCase().padStart(2, '0');
  const refSize = state.header.objectRefSize;
  try {
    switch (type) {
      case 0x0:
        return [hex, info === 0x9 ? 'true' : info === 0x8 ? 'false' : info === 0xf ? 'fill' : 'null', '-', '-'];
      case 0x1:
        return [
          hex,
          'integer',
          (1 << info) + ' bytes',
          readIntegerBytes(state, offset + 1, 1 << info).toString(),
        ];
      case 0x2: {
        const byteCount = info === 0x3 ? 8 : 4;
        const view = new DataView(state.bytes.buffer, state.bytes.byteOffset + offset + 1, byteCount);
        return [hex, 'real', byteCount + ' bytes', String(byteCount === 8 ? view.getFloat64(0, false) : view.getFloat32(0, false))];
      }
      case 0x3: {
        const view = new DataView(state.bytes.buffer, state.bytes.byteOffset + offset + 1, 8);
        return [hex, 'date', '8 bytes', new Date(978307200000 + view.getFloat64(0, false) * 1000).toISOString()];
      }
      case 0x4: {
        const { length } = readLength(state, offset);
        return [hex, 'data', length + ' bytes', '-'];
      }
      case 0x5:
      case 0x6: {
        const { length, next } = readLength(state, offset);
        const byteLength = type === 0x6 ? length * 2 : length;
        const raw = state.bytes.subarray(next, next + byteLength);
        const text = new TextDecoder(type === 0x6 ? 'utf-16be' : 'utf-8').decode(raw);
        return [hex, type === 0x6 ? 'string (UTF-16)' : 'string', length + (type === 0x6 ? ' chars' : ' bytes'), clip(text, 60)];
      }
      case 0x8:
        return [hex, 'UID', info + 1 + ' bytes', '-'];
      case 0xa:
      case 0xc: {
        const { length } = readLength(state, offset);
        return [hex, type === 0xa ? 'array' : 'set', length + ' items', length * refSize + ' bytes of refs'];
      }
      case 0xd: {
        const { length } = readLength(state, offset);
        return [hex, 'dictionary', length + ' entries', length * 2 * refSize + ' bytes of refs'];
      }
      default:
        return [hex, 'unknown', '-', '-'];
    }
  } catch {
    return [hex, 'unreadable', '-', '-'];
  }
}

function walk(
  node: Node,
  path: string,
  depth: number,
  state: WalkState,
  dataPreview: boolean,
  rows: string[][],
): void {
  if (state.rows >= MAX_TREE_ROWS) {
    state.truncated = true;
    return;
  }
  state.rows += 1;
  state.depth = Math.max(state.depth, depth);
  state.counts.set(typeLabel(node), (state.counts.get(typeLabel(node)) ?? 0) + 1);
  rows.push([path, typeLabel(node), valueText(node, dataPreview)]);
  if (depth >= MAX_DEPTH) return;
  if (node.kind === 'dict') {
    for (const entry of node.entries) {
      walk(entry.node, path + '.' + entry.key, depth + 1, state, dataPreview, rows);
    }
  } else if (node.kind === 'array' || node.kind === 'set') {
    node.items.forEach((item, index) => {
      walk(item, path + '[' + index + ']', depth + 1, state, dataPreview, rows);
    });
  }
}

function localName(element: Element): string {
  return (element.localName ?? element.tagName).toLowerCase();
}

interface XmlResult {
  node: Node;
  version: string;
  findings: Finding[];
}

function readXmlValue(element: Element, depth: number, findings: Finding[], counts: Map<string, number>): Node {
  const tag = localName(element);
  const text = element.textContent ?? '';
  switch (tag) {
    case 'dict': {
      const entries: { key: string; node: Node }[] = [];
      const children = Array.from(element.children);
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        if (child === undefined) continue;
        if (localName(child) !== 'key') {
          addFinding(findings, 'note', 'Unexpected element inside <dict>', '<' + localName(child) + '> was skipped because a <key> was expected.');
          continue;
        }
        const key = child.textContent ?? '';
        const valueElement = children[index + 1];
        if (valueElement === undefined) {
          addFinding(findings, 'warning', 'A <key> has no value', 'The key "' + clip(key, 40) + '" is the last element in its dictionary.');
          entries.push({ key, node: { kind: 'null' } });
          break;
        }
        index += 1;
        entries.push({ key, node: readXmlValue(valueElement, depth + 1, findings, counts) });
      }
      const seen = new Set<string>();
      for (const entry of entries) {
        if (seen.has(entry.key)) {
          addFinding(findings, 'warning', 'Duplicate key in a dictionary', 'The key "' + clip(entry.key, 40) + '" appears more than once; the later value is the one readers see.');
        }
        seen.add(entry.key);
      }
      return { kind: 'dict', entries };
    }
    case 'array':
      return { kind: 'array', items: Array.from(element.children).map((child) => readXmlValue(child, depth + 1, findings, counts)) };
    case 'string':
      return { kind: 'string', value: text, utf16: false };
    case 'data': {
      const compact = text.replace(/\s+/gu, '');
      try {
        const bytes = compact === '' ? new Uint8Array(0) : fromBase64(compact);
        return { kind: 'data', length: bytes.length, base64: toBase64(bytes) };
      } catch {
        addFinding(findings, 'warning', 'A <data> element is not valid base64', 'It was treated as empty.');
        return { kind: 'data', length: 0, base64: '' };
      }
    }
    case 'integer': {
      const trimmed = text.trim();
      if (!/^-?\d+$/u.test(trimmed)) {
        addFinding(findings, 'error', 'An <integer> is not a number', 'It reads "' + clip(trimmed, 40) + '".');
        return { kind: 'null' };
      }
      return { kind: 'integer', text: BigInt(trimmed).toString(), bytes: 8 };
    }
    case 'real': {
      const value = Number(text.trim());
      if (!Number.isFinite(value)) {
        addFinding(findings, 'error', 'A <real> is not a number', 'It reads "' + clip(text.trim(), 40) + '".');
        return { kind: 'null' };
      }
      return { kind: 'real', value, bytes: 8 };
    }
    case 'true':
      return { kind: 'boolean', value: true };
    case 'false':
      return { kind: 'boolean', value: false };
    case 'date': {
      const milliseconds = Date.parse(text.trim());
      if (Number.isNaN(milliseconds)) {
        addFinding(findings, 'error', 'A <date> is not a valid date', 'It reads "' + clip(text.trim(), 40) + '".');
        return { kind: 'null' };
      }
      return { kind: 'date', iso: new Date(milliseconds).toISOString(), seconds: milliseconds / 1000 - 978307200 };
    }
    default:
      addFinding(findings, 'note', 'Unsupported element <' + tag + '>', 'This is not part of the property list schema, so it was skipped.');
      return { kind: 'null' };
  }
}

function readXml(text: string): XmlResult {
  const findings: Finding[] = [];
  if (/<!DOCTYPE/iu.test(text)) {
    findings.push({
      level: 'note',
      problem: 'The XML declares a DOCTYPE',
      detail: 'External entities are never fetched here, so anything defined in the DTD is ignored.',
    });
  }

  let document: Document;
  try {
    document = new DOMParser().parseFromString(text, 'application/xml');
  } catch {
    throw new ToolError('That XML could not be parsed.', 'Check for an unclosed tag or a stray character.');
  }
  if (document.querySelector('parsererror') !== null) {
    throw new ToolError('That XML could not be parsed.', 'Check for an unclosed tag or a stray character.');
  }

  const root = document.documentElement;
  if (root === null || localName(root) !== 'plist') {
    throw new ToolError(
      'That XML is not a property list.',
      root === null ? 'The document is empty.' : 'The root element is <' + localName(root) + '>, not <plist>.',
    );
  }
  const version = root.getAttribute('version') ?? '';
  if (version !== '' && version !== '1.0') {
    findings.push({ level: 'note', problem: 'Unexpected plist version', detail: 'The document declares version "' + version + '"; 1.0 is the defined value.' });
  }
  const valueElement = root.children[0];
  if (valueElement === undefined) {
    throw new ToolError('That property list has no value.', 'A <plist> element must contain exactly one value such as <dict> or <array>.');
  }
  const counts = new Map<string, number>();
  const node = readXmlValue(valueElement, 0, findings, counts);
  return { node, version: version === '' ? '1.0' : version, findings };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = String(o.format ?? 'tree');
  const dataPreview = o.dataPreview === true;

  const source = input.files[0];
  let bytes: Uint8Array;
  let sourceLabel: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 8 MB.');
    bytes = new Uint8Array(await source.arrayBuffer());
    sourceLabel = source.name === '' ? 'uploaded file' : source.name;
  } else {
    const text = String(input.text ?? '');
    if (text.trim() === '') throw new ToolError('No property list was provided.', 'Drop a .plist file or paste its text.');
    if (text.length > MAX_BYTES) throw new ToolError('That is more than 8 MB of input.');
    bytes = new TextEncoder().encode(text);
    sourceLabel = 'pasted text';
  }

  const findings: Finding[] = [];
  let node: Node;
  let isBinary = false;
  let version = '1.0';
  let header: BinaryPlist | null = null;
  let state: BinaryState | null = null;
  const xmlCounts = new Map<string, number>();

  const magic = new TextDecoder('latin1').decode(bytes.subarray(0, 6));
  if (magic === 'bplist') {
    isBinary = true;
    try {
      header = readHeader(bytes);
    } catch (error) {
      const reason = error instanceof PlistError ? error.message : 'The header could not be read.';
      throw new ToolError('That binary plist could not be decoded.', reason);
    }
    state = {
      bytes,
      header,
      nodes: new Map(),
      reading: new Set(),
      findings,
      cyclic: false,
      depthExceeded: false,
      nonAsciiStrings: 0,
      unreachable: 0,
      trailingBytes: 0,
    };
    try {
      node = readObject(state, header.topObject, 0);
    } catch (error) {
      const reason = error instanceof PlistError ? error.message : 'The structure could not be read.';
      throw new ToolError('That binary plist could not be decoded.', reason);
    }
    version = header.version;

    const reachable = new Set<number>();
    const mark = (index: number, depth: number): void => {
      if (reachable.has(index) || depth > MAX_DEPTH * 2) return;
      reachable.add(index);
      const offset = header?.offsets[index];
      if (offset === undefined) return;
      const marker = bytes[offset] ?? 0;
      const type = marker >> 4;
      const { length, next } = (() => {
        try {
          return readLength(state as BinaryState, offset);
        } catch {
          return { length: 0, next: offset + 1 };
        }
      })();
      const refSize = header?.objectRefSize ?? 0;
      if (type === 0xa || type === 0xc) {
        for (let item = 0; item < length; item += 1) mark(readRef(state as BinaryState, next + item * refSize), depth + 1);
      } else if (type === 0xd) {
        for (let entry = 0; entry < length * 2; entry += 1) mark(readRef(state as BinaryState, next + entry * refSize), depth + 1);
      }
    };
    mark(header.topObject, 0);
    state.unreachable = header.objectCount - reachable.size;
    state.trailingBytes = Math.max(0, header.trailerStart - (header.offsetTableOffset + header.objectCount * header.offsetIntSize));
    if (state.unreachable > 0) {
      addFinding(
        findings,
        'note',
        state.unreachable + ' object(s) are never referenced',
        'The offset table holds more objects than the top-level value reaches.',
      );
    }
    if (state.trailingBytes > 0) {
      addFinding(findings, 'note', state.trailingBytes + ' byte(s) sit between the tables', 'The offset table does not end where the trailer begins.');
    }
    if (state.cyclic) {
      addFinding(
        findings,
        'error',
        'The structure contains a reference cycle',
        'An object refers back to a value that contains it, which no writer should produce; the repeat was cut off.',
      );
    }
    if (state.depthExceeded) {
      addFinding(findings, 'warning', 'Nesting is deeper than ' + MAX_DEPTH + ' levels', 'Deeper values were not expanded.');
    }
  } else {
    const text = new TextDecoder('utf-8').decode(bytes);
    const result = readXml(text);
    node = result.node;
    version = result.version;
    for (const finding of result.findings) addFinding(findings, finding.level, finding.problem, finding.detail);
  }

  const walkState: WalkState = { rows: 0, depth: 0, counts: isBinary ? new Map() : xmlCounts, truncated: false, maxDepth: 0 };
  const rows: string[][] = [];
  walk(node, 'root', 0, walkState, dataPreview, rows);
  if (walkState.truncated) {
    addFinding(findings, 'note', 'The value tree was cut off', 'Only the first ' + MAX_TREE_ROWS + ' values are listed.');
  }
  const uidCount = walkState.counts.get('UID (1 bytes)') ?? 0;
  if (uidCount > 0) {
    addFinding(findings, 'note', 'UID values are present', 'These come from keyed archives such as NSKeyedArchiver and refer to objects by index.');
  }

  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  const notes = findings.filter((finding) => finding.level === 'note').length;
  const types = [...walkState.counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));

  const resultNotes: string[] = [];
  const resultWarnings: string[] = [];
  if (rows.length >= MAX_TREE_ROWS) resultNotes.push('Only the first ' + MAX_TREE_ROWS + ' tree rows are shown.');
  if (errors > 0) resultWarnings.push(errors + ' structural error(s) found.');

  const stats: Record<string, string | number> = {
    format: isBinary ? 'binary' : 'xml',
    bytes: bytes.length,
    values: rows.length,
    depth: walkState.depth,
    objects: header?.objectCount ?? 0,
    findings: findings.length,
  };

  if (format === 'summary') {
    const summaryRows: string[][] = [
      ['Format', isBinary ? 'binary property list (bplist' + version + ')' : 'XML property list'],
      ['Source', sourceLabel],
      ['Bytes', String(bytes.length)],
      ['Version', version],
      ['Top-level type', typeLabel(node)],
      ['Top-level size', childCount(node) === 0 ? 'scalar value' : String(childCount(node)) + (node.kind === 'dict' ? ' keys' : ' items')],
      ['Objects in offset table', isBinary && header !== null ? String(header.objectCount) : 'not applicable'],
      ['Object ref size', isBinary && header !== null ? header.objectRefSize + ' bytes' : 'not applicable'],
      ['Offset size', isBinary && header !== null ? header.offsetIntSize + ' bytes' : 'not applicable'],
      ['Values walked', String(rows.length)],
      ['Deepest nesting', String(walkState.depth)],
      ['Types', types.length === 0 ? 'none' : types.map((entry) => entry[0] + ' × ' + entry[1]).join(', ')],
      ['Errors', String(errors)],
      ['Warnings', String(warnings)],
      ['Notes', String(notes)],
    ];
    return {
      outputs: [],
      report: { output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }), render: 'table' },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'objects') {
    if (!isBinary || header === null || state === null) {
      return {
        outputs: [],
        report: {
          output: JSON.stringify({
            headers: ['#', 'Marker', 'Type', 'Size', 'Value'],
            rows: [['-', '-', 'not applicable', '-', 'The offset table is part of the binary format; this is an XML plist.']],
          }),
          render: 'table',
        },
        notes: resultNotes,
        warnings: resultWarnings,
        stats,
      };
    }
    const objectRows: string[][] = [];
    for (let index = 0; index < header.objectCount && objectRows.length < MAX_OBJECT_ROWS; index += 1) {
      objectRows.push([String(index), ...describeObject(state, index)]);
    }
    if (header.objectCount > objectRows.length) {
      resultNotes.push('Only the first ' + MAX_OBJECT_ROWS + ' objects are listed.');
      stats.objectsListed = objectRows.length;
    }
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['#', 'Marker', 'Type', 'Size', 'Value'], rows: objectRows }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'findings') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Level', 'Problem', 'Detail'],
          rows:
            findings.length === 0
              ? [['ok', 'Nothing to flag', 'The property list reads cleanly and no structural problems were found.']]
              : findings.map((finding) => [finding.level, finding.problem, finding.detail]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Path', 'Type', 'Value'], rows }),
      render: 'table',
    },
    notes: resultNotes,
    warnings: resultWarnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
