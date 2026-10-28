import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './torrent-file-inspector.meta';

/**
 * BitTorrent metainfo inspector.
 *
 * Decodes the bencode container, then reads the torrent's own structure out of
 * it and computes the SHA-1 info-hash over the raw bytes of the info value.
 * Verdicts in the tests come from Python's hashlib over an independently built
 * bencode encoder, not from this parser.
 */

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ROWS = 20000;
const MAX_DEPTH = 100;
const MAX_STR = 8 * 1024 * 1024;

type Benc =
  | { kind: 'int'; value: number }
  | { kind: 'str'; value: Uint8Array }
  | { kind: 'list'; value: Benc[] }
  | { kind: 'dict'; value: Map<string, Benc> };

type Severity = 'error' | 'warn' | 'info';

interface Finding {
  severity: Severity;
  kind: string;
  detail: string;
}

interface TorrentFile {
  path: string;
  length: number;
}

interface Model {
  bytes: number;
  depth: number;
  topKeys: string[];
  announce: string | null;
  announceList: string[];
  comment: string | null;
  createdBy: string | null;
  creationDate: number | null;
  infoHashHex: string | null;
  infoHashBase32: string | null;
  name: string | null;
  pieceLength: number | null;
  pieces: number;
  expectedPieces: number | null;
  totalLength: number | null;
  files: TorrentFile[];
  multiFile: boolean;
  privateTorrent: boolean;
  findings: Finding[];
}

class DecodeError extends Error {
  readonly offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

class Decoder {
  readonly b: Uint8Array;
  at = 0;
  depth = 0;
  maxDepth = 0;

  constructor(b: Uint8Array) {
    this.b = b;
  }

  private peek(): number | undefined {
    return this.b[this.at];
  }

  private expect(byte: number, what: string): void {
    if (this.b[this.at] !== byte)
      throw new DecodeError(`Expected ${what} at byte ${this.at}.`, this.at);
  }

  /** Read a decimal integer up to 'e'. */
  private readInt(terminator: number, what: string): number {
    const start = this.at;
    let value = 0;
    let digits = 0;
    let negative = false;
    if (this.b[this.at] === 0x2d) {
      negative = true;
      this.at += 1;
    }
    while (this.at < this.b.length) {
      const c = this.b[this.at]!;
      if (c === terminator) {
        if (digits === 0) throw new DecodeError(`${what} at byte ${start} has no digits.`, start);
        this.at += 1;
        const signed = negative ? -value : value;
        if (!Number.isSafeInteger(signed))
          throw new DecodeError(`${what} at byte ${start} is too large to read.`, start);
        return signed;
      }
      if (c < 0x30 || c > 0x39)
        throw new DecodeError(
          `${what} at byte ${start} contains a non-digit byte 0x${c.toString(16)}.`,
          this.at,
        );
      value = value * 10 + (c - 0x30);
      digits += 1;
      this.at += 1;
    }
    throw new DecodeError(`${what} at byte ${start} is unterminated.`, start);
  }

  parse(): Benc {
    const node = this.value();
    if (this.at !== this.b.length)
      throw new DecodeError(`Trailing data after the top-level value at byte ${this.at}.`, this.at);
    return node;
  }

  private value(): Benc {
    if (this.at >= this.b.length)
      throw new DecodeError(`Unexpected end of input at byte ${this.at}.`, this.at);
    const c = this.b[this.at]!;

    if (c === 0x69) {
      // 'i' integer
      this.at += 1;
      return { kind: 'int', value: this.readInt(0x65, 'Integer') };
    }
    if (c === 0x6c) {
      // 'l' list
      this.at += 1;
      this.enter();
      const items: Benc[] = [];
      while (this.peek() !== 0x65) {
        if (this.at >= this.b.length)
          throw new DecodeError(`Unterminated list at byte ${this.at}.`, this.at);
        items.push(this.value());
      }
      this.expect(0x65, "'e' closing the list");
      this.at += 1;
      this.depth -= 1;
      return { kind: 'list', value: items };
    }
    if (c === 0x64) {
      // 'd' dictionary
      this.at += 1;
      this.enter();
      const entries = new Map<string, Benc>();
      while (this.peek() !== 0x65) {
        if (this.at >= this.b.length)
          throw new DecodeError(`Unterminated dictionary at byte ${this.at}.`, this.at);
        const keyNode = this.value();
        if (keyNode.kind !== 'str')
          throw new DecodeError(
            `Dictionary key at byte ${this.at} must be a string, found ${keyNode.kind}.`,
            this.at,
          );
        const key = latin1(keyNode.value);
        // bencode requires keys to be sorted; keep the first occurrence.
        if (!entries.has(key)) entries.set(key, this.value());
        else this.value();
      }
      this.expect(0x65, "'e' closing the dictionary");
      this.at += 1;
      this.depth -= 1;
      return { kind: 'dict', value: entries };
    }
    if (c >= 0x30 && c <= 0x39) {
      // byte string: <length>:<bytes>
      const start = this.at;
      const len = this.readInt(0x3a, 'String length');
      if (len < 0) throw new DecodeError(`String length at byte ${start} is negative.`, start);
      if (len > MAX_STR)
        throw new DecodeError(
          `String length ${len} at byte ${start} exceeds the ${MAX_STR}-byte limit.`,
          start,
        );
      if (this.at + len > this.b.length)
        throw new DecodeError(
          `String of ${len} bytes at byte ${this.at} runs past the end of the file.`,
          this.at,
        );
      const value = this.b.subarray(this.at, this.at + len);
      this.at += len;
      return { kind: 'str', value };
    }
    throw new DecodeError(
      `Unexpected byte 0x${c.toString(16)} at byte ${this.at}; expected a bencode value.`,
      this.at,
    );
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > this.maxDepth) this.maxDepth = this.depth;
    if (this.depth > MAX_DEPTH)
      throw new DecodeError(`Nesting deeper than ${MAX_DEPTH} levels at byte ${this.at}.`, this.at);
  }
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function utf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return latin1(bytes);
  }
}

function dictGet(node: Benc | undefined, key: string): Benc | undefined {
  return node !== undefined && node.kind === 'dict' ? node.value.get(key) : undefined;
}

function asInt(node: Benc | undefined): number | null {
  return node !== undefined && node.kind === 'int' ? node.value : null;
}

function asStr(node: Benc | undefined): string | null {
  return node !== undefined && node.kind === 'str' ? utf8(node.value) : null;
}

function asList(node: Benc | undefined): Benc[] {
  return node !== undefined && node.kind === 'list' ? node.value : [];
}

/** SHA-1 of a byte range, implemented here because WebCrypto has no SHA-1 digest. */
function sha1(bytes: Uint8Array): Uint8Array {
  const len = bytes.length;
  const bitLen = len * 8;
  const withPad = new Uint8Array((((len + 9) >> 6) + 1) << 6);
  withPad.set(bytes, 0);
  withPad[len] = 0x80;
  // 64-bit big-endian length; only the low 32 bits can be non-zero for our sizes.
  const hi = Math.floor(bitLen / 4294967296);
  const lo = bitLen >>> 0;
  withPad[withPad.length - 8] = (hi >>> 24) & 0xff;
  withPad[withPad.length - 7] = (hi >>> 16) & 0xff;
  withPad[withPad.length - 6] = (hi >>> 8) & 0xff;
  withPad[withPad.length - 5] = hi & 0xff;
  withPad[withPad.length - 4] = (lo >>> 24) & 0xff;
  withPad[withPad.length - 3] = (lo >>> 16) & 0xff;
  withPad[withPad.length - 2] = (lo >>> 8) & 0xff;
  withPad[withPad.length - 1] = lo & 0xff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = off + i * 4;
      w[i] =
        ((withPad[j]! << 24) |
          (withPad[j + 1]! << 16) |
          (withPad[j + 2]! << 8) |
          withPad[j + 3]!) >>>
        0;
    }
    for (let i = 16; i < 80; i += 1) {
      const x = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!;
      w[i] = ((x << 1) | (x >>> 31)) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const words = [h0, h1, h2, h3, h4];
  for (let i = 0; i < 5; i += 1) {
    const v = words[i]!;
    out[i * 4] = (v >>> 24) & 0xff;
    out[i * 4 + 1] = (v >>> 16) & 0xff;
    out[i * 4 + 2] = (v >>> 8) & 0xff;
    out[i * 4 + 3] = v & 0xff;
  }
  return out;
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += B32.charAt((value << (5 - bits)) & 31);
  return out;
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function formatBytes(n: number | null): string {
  if (n === null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

/** Walk the info dict to find the byte range of its value, needed for the hash. */
function reencode(node: Benc): Uint8Array {
  if (node.kind === 'int') return new TextEncoder().encode(`i${node.value}e`);
  if (node.kind === 'str') {
    const head = new TextEncoder().encode(`${node.value.length}:`);
    const out = new Uint8Array(head.length + node.value.length);
    out.set(head, 0);
    out.set(node.value, head.length);
    return out;
  }
  if (node.kind === 'list') {
    const parts = node.value.map(reencode);
    return concat([new Uint8Array([0x6c]), ...parts, new Uint8Array([0x65])]);
  }
  // Dictionary: bencode requires keys in byte-sorted order, which is what Map
  // insertion order preserves because we decode in file order.
  const pieces: Uint8Array[] = [new Uint8Array([0x64])];
  for (const [key, value] of node.value) {
    const keyBytes = new TextEncoder().encode(key);
    pieces.push(new TextEncoder().encode(`${keyBytes.length}:`), keyBytes, reencode(value));
  }
  pieces.push(new Uint8Array([0x65]));
  return concat(pieces);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function buildModel(bytes: Uint8Array, root: Benc, decoder: Decoder): Model {
  const findings: Finding[] = [];

  if (root.kind !== 'dict')
    throw new ToolError(
      'That file is not a torrent metainfo file.',
      `The top-level bencode value is a ${root.kind}, but a torrent must be a dictionary.`,
    );

  const topKeys = [...root.value.keys()];

  const announce = asStr(dictGet(root, 'announce'));
  const announceList: string[] = [];
  const tiers = asList(dictGet(root, 'announce-list'));
  for (const tier of tiers) {
    for (const entry of asList(tier)) {
      const url = asStr(entry);
      if (url !== null) announceList.push(url);
    }
  }

  const info = dictGet(root, 'info');
  if (info === undefined)
    throw new ToolError(
      'That torrent has no info dictionary.',
      'The bencoded file is valid but lacks the required "info" key.',
    );
  if (info.kind !== 'dict')
    throw new ToolError(
      "That torrent's info value is not a dictionary.",
      `Expected a dictionary under "info", found a ${info.kind}.`,
    );

  const name = asStr(info.value.get('name'));
  const pieceLength = asInt(info.value.get('piece length'));
  const piecesNode = info.value.get('pieces');
  const piecesBytes =
    piecesNode !== undefined && piecesNode.kind === 'str' ? piecesNode.value.length : 0;
  const pieces = Math.floor(piecesBytes / 20);

  if (name === null || name === '')
    findings.push({
      severity: 'error',
      kind: 'missing-name',
      detail: 'The info dictionary has no "name"; a client cannot name the download.',
    });
  if (pieceLength === null || pieceLength <= 0)
    findings.push({
      severity: 'error',
      kind: 'bad-piece-length',
      detail: `"piece length" is ${pieceLength === null ? 'missing' : pieceLength}; it must be a positive integer.`,
    });
  if (piecesNode === undefined)
    findings.push({
      severity: 'error',
      kind: 'missing-pieces',
      detail: 'The info dictionary has no "pieces" string; the torrent cannot be verified.',
    });
  else if (piecesBytes % 20 !== 0)
    findings.push({
      severity: 'error',
      kind: 'pieces-not-multiple-of-20',
      detail: `The "pieces" string is ${piecesBytes} bytes; piece hashes must be whole 20-byte SHA-1 values, so ${piecesBytes % 20} bytes are left over.`,
    });

  // --- File list ----------------------------------------------------------
  const files: TorrentFile[] = [];
  const fileList = asList(info.value.get('files'));
  const multiFile = fileList.length > 0;
  const singleLength = asInt(info.value.get('length'));

  if (multiFile) {
    for (const entry of fileList) {
      if (entry.kind !== 'dict')
        findings.push({
          severity: 'error',
          kind: 'bad-file-entry',
          detail: `A "files" entry is a ${entry.kind}, not a dictionary.`,
        });
      else {
        const length = asInt(entry.value.get('length'));
        const pathParts = asList(entry.value.get('path'))
          .map((p) => asStr(p))
          .filter((p): p is string => p !== null);
        if (length === null)
          findings.push({
            severity: 'error',
            kind: 'file-missing-length',
            detail: `The file "${pathParts.join('/')}" has no "length".`,
          });
        if (pathParts.length === 0)
          findings.push({
            severity: 'error',
            kind: 'file-missing-path',
            detail: 'A "files" entry has an empty "path" list.',
          });
        files.push({ path: pathParts.join('/'), length: length ?? 0 });
      }
    }
    const bad = files.find((f) => f.path.includes('..') || f.path.startsWith('/'));
    if (bad !== undefined)
      findings.push({
        severity: 'error',
        kind: 'path-traversal',
        detail: `The file path "${bad.path}" escapes the download directory; a client must reject it.`,
      });
  } else if (singleLength !== null) {
    files.push({ path: name ?? '(unnamed)', length: singleLength });
  } else {
    findings.push({
      severity: 'error',
      kind: 'no-length-or-files',
      detail: 'The info dictionary has neither "length" nor "files".',
    });
  }

  const totalLength = files.reduce((sum, f) => sum + f.length, 0);
  const expectedPieces =
    pieceLength !== null && pieceLength > 0 && files.length > 0
      ? Math.ceil(totalLength / pieceLength)
      : null;

  if (expectedPieces !== null && piecesNode !== undefined && pieces !== expectedPieces)
    findings.push({
      severity: 'warn',
      kind: 'piece-count-mismatch',
      detail: `The file list needs ${expectedPieces} pieces at ${formatBytes(pieceLength)} each, but "pieces" holds ${pieces}.`,
    });

  // --- Info hash ----------------------------------------------------------
  const infoBytes = reencode(info);
  const digest = sha1(infoBytes);

  const creationDate = asInt(dictGet(root, 'creation date'));
  const privateFlag = asInt(info.value.get('private'));

  if (privateFlag !== null && privateFlag !== 0)
    findings.push({
      severity: 'info',
      kind: 'private-torrent',
      detail: 'The torrent is marked private: peers should announce only to its own trackers.',
    });
  if (announce === null && announceList.length === 0)
    findings.push({
      severity: 'warn',
      kind: 'no-trackers',
      detail: 'No announce URL and no announce-list: the torrent is trackerless (DHT only).',
    });
  if (multiFile && files.some((f) => f.length === 0))
    findings.push({
      severity: 'info',
      kind: 'empty-file',
      detail: 'The file list contains a zero-length file.',
    });

  return {
    bytes: bytes.length,
    depth: decoder.maxDepth,
    topKeys,
    announce,
    announceList,
    comment: asStr(dictGet(root, 'comment')),
    createdBy: asStr(dictGet(root, 'created by')),
    creationDate,
    infoHashHex: hex(digest),
    infoHashBase32: base32(digest),
    name,
    pieceLength,
    pieces,
    expectedPieces,
    totalLength,
    files,
    multiFile,
    privateTorrent: privateFlag !== null && privateFlag !== 0,
    findings,
  };
}

function magnet(m: Model): string {
  const hash = m.infoHashBase32 !== null ? m.infoHashBase32 : (m.infoHashHex ?? '');
  const params = [`xt=urn:btih:${hash}`];
  if (m.name !== null) params.push(`dn=${encodeURIComponent(m.name)}`);
  if (m.pieceLength !== null) params.push(`xl=${m.pieceLength}`);
  const trackers = m.announce !== null ? [m.announce, ...m.announceList] : m.announceList;
  for (const tracker of new Set(trackers)) params.push(`tr=${encodeURIComponent(tracker)}`);
  return `magnet:?${params.join('&')}`;
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const errors = m.findings.filter((f) => f.severity === 'error').length;
  const warns = m.findings.filter((f) => f.severity === 'warn').length;
  const rows: string[][] = [
    ['Name', m.name ?? '—'],
    ['Info hash (hex)', m.infoHashHex ?? '—'],
    ['Info hash (base32)', m.infoHashBase32 ?? '—'],
    ['Total size', formatBytes(m.totalLength)],
    ['Files', String(m.files.length)],
    ['Multi-file', m.multiFile ? 'yes' : 'no'],
    ['Piece length', formatBytes(m.pieceLength)],
    ['Pieces', String(m.pieces)],
    ['Pieces expected', m.expectedPieces === null ? '—' : String(m.expectedPieces)],
    ['Private', m.privateTorrent ? 'yes' : 'no'],
    ['Announce', m.announce ?? '—'],
    ['Announce-list tiers', String(m.announceList.length)],
    ['Comment', m.comment ?? '—'],
    ['Created by', m.createdBy ?? '—'],
    [
      'Creation date',
      m.creationDate === null || m.creationDate <= 0
        ? '—'
        : new Date(m.creationDate * 1000).toISOString(),
    ],
    ['File size', formatBytes(m.bytes)],
    ['Findings', `${errors} error, ${warns} warning, ${m.findings.length - errors - warns} note`],
  ];
  return { headers: ['Property', 'Value'], rows };
}

function tableFiles(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.files.slice(0, max) : [];
  return {
    headers: ['#', 'Path', 'Length', 'First piece', 'Last piece'],
    rows: shown.map((f, i) => {
      if (m.pieceLength === null || m.pieceLength <= 0)
        return [String(i), f.path, formatBytes(f.length), '—', '—'];
      // Piece offsets are cumulative across the whole torrent.
      const before = m.files.slice(0, i).reduce((sum, g) => sum + g.length, 0);
      const first = Math.floor(before / m.pieceLength);
      const last = f.length === 0 ? first : Math.floor((before + f.length - 1) / m.pieceLength);
      return [String(i), f.path, formatBytes(f.length), String(first), String(last)];
    }),
  };
}

function tablePieces(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const pl = m.pieceLength;
  const total = m.totalLength ?? 0;
  const count = m.pieces;
  const rows: string[][] = [];
  if (pl !== null && pl > 0) {
    const limit = max > 0 ? Math.min(count, max) : 0;
    for (let i = 0; i < limit; i += 1) {
      const start = i * pl;
      const end = Math.min(start + pl, total);
      rows.push([String(i), String(start), String(end), formatBytes(end - start)]);
    }
  }
  return { headers: ['Piece', 'Byte start', 'Byte end', 'Length'], rows };
}

function tableTrackers(m: Model): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  if (m.announce !== null) rows.push(['announce', m.announce]);
  m.announceList.forEach((url, i) => rows.push([`announce-list[${i}]`, url]));
  if (rows.length === 0) rows.push(['—', 'No trackers: trackerless (DHT) torrent']);
  rows.push(['Magnet URI', magnet(m)]);
  return { headers: ['Source', 'URL'], rows };
}

function tableFindings(m: Model): { headers: string[]; rows: string[][] } {
  if (m.findings.length === 0)
    return {
      headers: ['Finding', 'Severity', 'Detail'],
      rows: [['none', 'INFO', 'The metainfo file is structurally valid.']],
    };
  return {
    headers: ['Finding', 'Severity', 'Detail'],
    rows: m.findings.map((f) => [f.kind, f.severity.toUpperCase(), f.detail]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(MAX_ROWS, Number(options.maxRows ?? 100) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No torrent file was provided.', 'Choose a .torrent file to inspect.');

  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES)
    throw new ToolError(
      'That file is larger than 32 MB.',
      'Torrent metainfo files are normally a few kilobytes to a few megabytes.',
    );

  const bytes = new Uint8Array(await source.arrayBuffer());
  const decoder = new Decoder(bytes);

  let root: Benc;
  try {
    root = decoder.parse();
  } catch (error) {
    if (error instanceof DecodeError)
      throw new ToolError(
        `That file is not valid bencode: ${error.message}`,
        `Decoding stopped at byte ${error.offset} of ${bytes.length}.`,
      );
    throw error;
  }

  const model = buildModel(bytes, root, decoder);
  if (model.announce === null && model.announceList.length === 0) {
    // Already recorded as a finding; no extra warning needed.
  }

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'files':
      table = tableFiles(model, maxRows);
      break;
    case 'pieces':
      table = tablePieces(model, maxRows);
      break;
    case 'trackers':
      table = tableTrackers(model);
      break;
    case 'findings':
      table = tableFindings(model);
      break;
    case 'summary':
      table = tableSummary(model);
      break;
    default:
      table = tableSummary(model);
      warnings.push(`Unknown view "${format}" — showing the summary instead.`);
  }

  const errors = model.findings.filter((f) => f.severity === 'error').length;
  return {
    outputs: [],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      `${model.name ?? '(unnamed)'}: ${model.files.length} file(s), ` +
        `${formatBytes(model.totalLength)}, ${model.pieces} piece(s), ${errors} error(s).`,
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: {
      files: model.files.length,
      pieces: model.pieces,
      findings: model.findings.length,
      bytes: model.bytes,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
