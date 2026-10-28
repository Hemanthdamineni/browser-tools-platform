import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './compressed-file-inspector.meta';

/**
 * Compressed-stream inspector.
 *
 * Identifies and parses the headers of zstd, xz, bzip2, gzip, lz4 and brotli
 * streams from the raw bytes. Verdicts in the tests come from the reference
 * CLIs (`zstd -l`, `xz -l`, `bzip2 -tv`, `lz4 -l`, `gzip -l`), not from this
 * parser.
 */

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_UNITS = 5000;
const MAX_FINDINGS = 200;
const CLIP = 120;

type Severity = 'error' | 'warn' | 'info';

interface Finding {
  severity: Severity;
  kind: string;
  detail: string;
}

interface Unit {
  index: number;
  kind: string;
  at: number;
  compressed: number | null;
  uncompressed: number | null;
  extra: string;
}

interface Model {
  format: string;
  magic: string;
  bytes: number;
  wellFormed: boolean;
  units: Unit[];
  header: [string, string][];
  findings: Finding[];
  checksum: string | null;
  truncatedAt: number | null;
}

function toHex(bytes: Uint8Array, len: number): string {
  const out: string[] = [];
  for (let i = 0; i < Math.min(len, bytes.length); i += 1)
    out.push((bytes[i]! >>> 0).toString(16).padStart(2, '0'));
  return out.join(' ');
}

function readU32LE(b: Uint8Array, at: number): number {
  if (at + 4 > b.length) return -1;
  return (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;
}

function readU64LE(b: Uint8Array, at: number): number | null {
  if (at + 8 > b.length) return null;
  const lo = readU32LE(b, at);
  const hi = readU32LE(b, at + 4);
  if (lo < 0 || hi < 0) return null;
  const value = hi * 4294967296 + lo;
  return Number.isSafeInteger(value) ? value : null;
}

function formatBytes(n: number | null): string {
  if (n === null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

function ratio(packed: number | null, plain: number | null): string {
  if (packed === null || plain === null || packed <= 0) return '—';
  return `${(plain / packed).toFixed(2)}×`;
}

/** zstd: magic 28 B5 2F FD, then a frame header. */
function parseZstd(b: Uint8Array): Model {
  const findings: Finding[] = [];
  const units: Unit[] = [];
  let at = 0;
  let declaredPlain = 0;
  let checksum: string | null = null;
  let truncatedAt: number | null = null;
  const header: [string, string][] = [];

  while (at + 4 <= b.length) {
    const magic = readU32LE(b, at);
    if (magic === 0xfd2fb528) {
      // standard frame
    } else if (magic === 0x184d2a50 || (magic & 0xfffffff0) === 0x184d2a50) {
      // skippable frame
      const size = readU32LE(b, at + 4);
      units.push({
        index: units.length,
        kind: 'skippable frame',
        at,
        compressed: size >= 0 ? size + 8 : null,
        uncompressed: null,
        extra: 'user data',
      });
      if (size < 0 || at + 8 + size > b.length) {
        truncatedAt = at;
        break;
      }
      at += 8 + size;
      continue;
    } else {
      findings.push({
        severity: 'error',
        kind: 'zstd-bad-magic',
        detail: `Expected a zstd frame magic at byte ${at}, found ${toHex(b.subarray(at, at + 4), 4)}.`,
      });
      truncatedAt = at;
      break;
    }

    const start = at;
    at += 4;
    if (at >= b.length) {
      truncatedAt = start;
      break;
    }
    const descriptor = b[at]!;
    const fcsFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 0x20) !== 0;
    const hasChecksum = (descriptor & 0x04) !== 0;
    const dictFlag = descriptor & 0x03;
    at += 1;
    if (!singleSegment) at += 1; // window descriptor
    if (dictFlag === 3) at += 4;
    else if (dictFlag === 2) at += 2;
    else if (dictFlag === 1) at += 1;

    let contentSize: number | null = null;
    if (fcsFlag === 0) contentSize = singleSegment ? 1 : null;
    else if (fcsFlag === 1) contentSize = 2;
    else if (fcsFlag === 2) contentSize = 4;
    else contentSize = 8;
    let plainLen: number | null = null;
    if (contentSize !== null) {
      if (at + contentSize > b.length) {
        truncatedAt = start;
        break;
      }
      plainLen =
        contentSize === 1
          ? b[at]! + 256
          : contentSize === 2
            ? b[at]! | (b[at + 1]! << 8)
            : contentSize === 4
              ? readU32LE(b, at)
              : readU64LE(b, at);
      at += contentSize;
    }

    // Walk blocks until the last block.
    let walked = at;
    let broke = false;
    while (walked + 3 <= b.length) {
      const bh = b[walked]! | (b[walked + 1]! << 8) | (b[walked + 2]! << 16);
      const last = bh & 1;
      const type = (bh >>> 1) & 3;
      const size = bh >>> 3;
      walked += 3;
      if (type === 3) {
        findings.push({
          severity: 'error',
          kind: 'zstd-reserved-block',
          detail: `Reserved block type in the frame starting at byte ${start}.`,
        });
        broke = true;
        break;
      }
      if (walked + size > b.length) {
        truncatedAt = start;
        broke = true;
        break;
      }
      walked += size;
      if (last === 1) break;
    }
    if (broke) break;

    let frameEnd = walked;
    if (hasChecksum) {
      if (frameEnd + 4 > b.length) {
        truncatedAt = start;
        break;
      }
      checksum ??= 'XXH64';
      frameEnd += 4;
    }
    units.push({
      index: units.length,
      kind: 'zstd frame',
      at: start,
      compressed: frameEnd - start,
      uncompressed: plainLen,
      extra: `${hasChecksum ? 'checksum' : 'no checksum'}${singleSegment ? ', single segment' : ''}`,
    });
    if (plainLen !== null) declaredPlain += plainLen;
    at = frameEnd;
  }

  if (at < b.length && truncatedAt === null) truncatedAt = at;

  header.push(
    ['Format', 'zstd'],
    ['Magic bytes', toHex(b, 4)],
    ['Frames', String(units.filter((u) => u.kind === 'zstd frame').length)],
    ['Skippable frames', String(units.filter((u) => u.kind === 'skippable frame').length)],
    ['Declared uncompressed size', declaredPlain > 0 ? formatBytes(declaredPlain) : '—'],
    ['Frame checksum', checksum ?? 'none'],
    ['Compression ratio', ratio(b.length, declaredPlain > 0 ? declaredPlain : null)],
  );

  if (truncatedAt !== null)
    findings.push({
      severity: 'error',
      kind: 'truncated',
      detail: `Parsing stopped at byte ${truncatedAt}: the frame extends past the end of the ${b.length}-byte file.`,
    });

  return {
    format: 'zstd',
    magic: toHex(b, 4),
    bytes: b.length,
    wellFormed: truncatedAt === null,
    units,
    header,
    findings,
    checksum,
    truncatedAt,
  };
}

/** bzip2: magic 42 5A 68 ("BZh") followed by a block-size digit (1..9). */
function parseBzip2(b: Uint8Array): Model {
  const findings: Finding[] = [];
  const digit = b.length > 3 ? String.fromCharCode(b[3]!) : '';
  const level = /^[1-9]$/u.test(digit) ? digit : null;

  if (level === null)
    findings.push({
      severity: 'error',
      kind: 'bzip2-bad-level',
      detail: `Byte 3 should be a block size digit 1-9, found ${b.length > 3 ? `0x${b[3]!.toString(16)}` : "end of file"}.`,
    });

  findings.push({
    severity: 'info',
    kind: 'bzip2-binary-stream',
    detail:
      'bzip2 packs its blocks as a bit stream, so block and member counts cannot be read from the bytes without full Huffman decoding. Only the header is reported.',
  });

  return {
    format: 'bzip2',
    magic: toHex(b, 4),
    bytes: b.length,
    wellFormed: false,
    units: [],
    header: [
      ['Format', 'bzip2'],
      ['Magic bytes', toHex(b, 4)],
      ['Block size', level === null ? '—' : `${level}00 KiB (level ${level})`],
      ['Members', 'not determinable'],
      ['Declared uncompressed size', '—'],
      ['Compression ratio', '—'],
    ],
    findings,
    checksum: 'CRC32C per block (not verified)',
    truncatedAt: null,
  };
}

/** xz: magic FD 37 7A 58 5A 00, stream header, then block headers. */
function parseXz(b: Uint8Array): Model {
  const findings: Finding[] = [];
  const units: Unit[] = [];
  const magic = 'fd 37 7a 58 5a 00';
  let checksums: string[] = [];
  let truncatedAt: number | null = null;

  // xz puts the check type in the stream footer; the stream header flags are 2 bytes.
  if (b.length >= 12) {
    // Stream flags are two bytes: byte 6 is reserved (0), byte 7's low
    // nibble selects the integrity check (1=CRC32, 4=CRC64, 10=SHA-256).
    const checkId = b[7]! & 0x0f;
    const names: Record<number, string> = { 0: 'none', 1: 'CRC32', 4: 'CRC64', 10: 'SHA-256' };
    checksums = [names[checkId] ?? 'reserved'];
    const footer = findXzFooter(b);
    if (footer !== null) {
      const backsize = b[footer + 5]!;
      const footerCheck = b[footer + 9]! & 0x0f;
      if (footerCheck !== checkId)
        findings.push({
          severity: 'error',
          kind: 'xz-check-mismatch',
          detail: `The stream header says ${names[checkId]} but the footer says ${names[footerCheck]}.`,
        });
      units.push({
        index: 0,
        kind: 'xz stream',
        at: 0,
        compressed: footer + 12,
        uncompressed: null,
        extra: `${backsize === 0 ? 'backward size 0' : `block(s) within ${(backsize + 1) * 4} B index`}`,
      });
    } else {
      truncatedAt = 0;
      findings.push({
        severity: 'error',
        kind: 'truncated',
        detail: 'No xz stream footer (magic 59 5A) found at the end of the file.',
      });
    }
  } else {
    truncatedAt = 0;
    findings.push({ severity: 'error', kind: 'truncated', detail: 'File too short to be an xz stream.' });
  }

  return {
    format: 'xz',
    magic,
    bytes: b.length,
    wellFormed: truncatedAt === null,
    units,
    header: [
      ['Format', 'xz'],
      ['Magic bytes', magic],
      ['Streams', String(units.length)],
      ['Integrity check', checksums[0] ?? '—'],
      ['Declared uncompressed size', '—'],
      ['Compression ratio', '—'],
    ],
    findings,
    checksum: checksums[0] ?? null,
    truncatedAt,
  };
}

/** Locate the xz footer: 12 bytes ending the file, starting with 59 5A. */
function findXzFooter(b: Uint8Array): number | null {
  // The stream footer is 12 bytes and always ends with the magic 59 5A.
  const at = b.length - 12;
  if (at >= 0 && b[b.length - 2] === 0x59 && b[b.length - 1] === 0x5a) return at;
  return null;
}

/** gzip: 1F 8B 08 + flags; ISIZE is the last 4 bytes; FNAME may be present. */
function parseGzip(b: Uint8Array): Model {
  const findings: Finding[] = [];
  const units: Unit[] = [];
  let at = 0;
  let truncatedAt: number | null = null;
  let originalName: string | null = null;
  let mtime: number | null = null;

  if (b.length < 10 || b[0] !== 0x1f || b[1] !== 0x8b) {
    findings.push({
      severity: 'error',
      kind: 'truncated',
      detail: 'The file is too short to hold even the 10-byte gzip header.',
    });
    return {
      format: 'gzip',
      magic: toHex(b, 4),
      bytes: b.length,
      wellFormed: false,
      units: [],
      header: [
        ['Format', 'gzip'],
        ['Magic bytes', toHex(b, 4)],
      ],
      findings,
      checksum: null,
      truncatedAt: 0,
    };
  }

  while (at + 10 <= b.length && b[at] === 0x1f && b[at + 1] === 0x8b) {
    const start = at;
    const method = b[at + 2]!;
    if (method !== 8)
      findings.push({
        severity: 'error',
        kind: 'gzip-method',
        detail: `Byte ${start}: compression method ${method} is not deflate (8).`,
      });
    const flags = b[at + 3]!;
    mtime ??= readU32LE(b, at + 4);
    at += 10;
    if (flags & 0x04) {
      const xlen = b[at]! | (b[at + 1]! << 8);
      at += 2 + xlen;
    }
    if (flags & 0x08) {
      const end = indexOfNul(b, at);
      if (end === null) {
        truncatedAt = start;
        break;
      }
      originalName ??= latin1(b.subarray(at, end));
      at = end + 1;
    }
    if (flags & 0x10) {
      const end = indexOfNul(b, at);
      if (end === null) {
        truncatedAt = start;
        break;
      }
      at = end + 1;
    }
    if (flags & 0x02) at += 2;
    const isize = readU32LE(b, b.length - 4);
    units.push({
      index: units.length,
      kind: 'gzip member',
      at: start,
      compressed: b.length - start,
      uncompressed: isize >= 0 ? isize : null,
      extra: `deflate${(flags & 0x08) !== 0 ? ', name' : ''}${(flags & 0x02) !== 0 ? ', hcrc' : ''}`,
    });
    break; // single member; multi-member gzip is rare and we cannot size them without inflating
  }

  if (units.length === 0 && truncatedAt === null) truncatedAt = 0;

  const isize = readU32LE(b, b.length - 4);
  const sizeLabel = isize >= 0 ? formatBytes(isize) : '—';

  return {
    format: 'gzip',
    magic: toHex(b, 4),
    bytes: b.length,
    wellFormed: truncatedAt === null,
    units,
    header: [
      ['Format', 'gzip'],
      ['Magic bytes', toHex(b, 4)],
      ['Compression method', b.length > 2 && b[2] === 8 ? 'deflate (8)' : '—'],
      ['Members', String(units.length)],
      ['Original name', originalName ?? '—'],
      ['Stored mtime', mtime && mtime > 0 ? new Date(mtime * 1000).toISOString() : '—'],
      ['Declared uncompressed size', sizeLabel],
      ['Compression ratio', ratio(b.length, isize >= 0 ? isize : null)],
    ],
    findings,
    checksum: 'CRC32 + ISIZE',
    truncatedAt,
  };
}

/** lz4: magic 04 22 4D 18, then FLG/BD, optional content size per frame. */
function parseLz4(b: Uint8Array): Model {
  const findings: Finding[] = [];
  const units: Unit[] = [];
  let at = 0;
  let truncatedAt: number | null = null;
  let declared = 0;
  let contentChecksum = false;
  let blockChecksum = false;

  while (at + 7 <= b.length && readU32LE(b, at) === 0x184d2204) {
    const start = at;
    at += 4;
    const flg = b[at]!;
    at += 1;
    const bd = b[at]!;
    at += 1;
    if ((b[at - 2]! >>> 6) !== 1)
      findings.push({
        severity: 'warn',
        kind: 'lz4-version',
        detail: `Byte ${start + 4}: frame version bits are not 01.`,
      });
    const hasContentSize = (flg & 0x08) !== 0;
    const hasDict = (flg & 0x01) !== 0;
    contentChecksum ||= (flg & 0x04) !== 0;
    blockChecksum ||= (flg & 0x10) !== 0;
    let framePlain: number | null = null;
    if (hasContentSize) {
      framePlain = readU64LE(b, at);
      at += 8;
    }
    if (hasDict) at += 4;
    at += 1; // header checksum
    // Walk blocks until a zero-size block.
    while (at + 4 <= b.length) {
      const sizeWord = readU32LE(b, at);
      at += 4;
      if (sizeWord === 0) break;
      const size = sizeWord & 0x7fffffff;
      if (at + size > b.length) {
        truncatedAt = start;
        break;
      }
      at += size;
      if (blockChecksum) at += 4;
    }
    if (truncatedAt !== null) break;
    if (contentChecksum) at += 4;
    if (at > b.length) {
      truncatedAt = start;
      break;
    }
    units.push({
      index: units.length,
      kind: 'lz4 frame',
      at: start,
      compressed: at - start,
      uncompressed: framePlain,
      extra: `block max ${formatBytes(((bd >>> 4) & 0x07) === 4 ? 64 * 1024 : 256 * 1024)}${framePlain === null ? ', no content size' : ''}`,
    });
    if (framePlain !== null) declared += framePlain;
  }

  if (units.length === 0 && truncatedAt === null) truncatedAt = 0;

  return {
    format: 'lz4',
    magic: toHex(b, 4),
    bytes: b.length,
    wellFormed: truncatedAt === null,
    units,
    header: [
      ['Format', 'lz4'],
      ['Magic bytes', toHex(b, 4)],
      ['Frames', String(units.length)],
      ['Frame checksum', contentChecksum ? 'XXH32' : 'none'],
      ['Block checksum', blockChecksum ? 'XXH32' : 'none'],
      ['Declared uncompressed size', declared > 0 ? formatBytes(declared) : '—'],
      ['Compression ratio', '—'],
    ],
    findings,
    checksum: contentChecksum ? 'XXH32' : null,
    truncatedAt,
  };
}

/**
 * brotli has no magic number. We only claim brotli when the caller's file name
 * says so, because a stream that happens to start with a valid window-bit
 * pattern could be anything.
 */
function parseBrotli(b: Uint8Array): Model {
  const findings: Finding[] = [];
  if (b.length === 0) throw new ToolError('That file is empty.');
  // First bits encode the WBITS window size; only 0x81/0x01/… are valid starts.
  const first = b[0]!;
  const looksBrotli = first === 0x1b || first === 0x21 || first === 0x81 || first === 0x8b ||
    first === 0xa1 || first === 0xc1 || first === 0xe1 || (first & 0x01) === 0x01;
  if (!looksBrotli)
    findings.push({
      severity: 'warn',
      kind: 'brotli-heuristic',
      detail: 'brotli has no magic bytes; identification relies on the file extension.',
    });
  findings.push({
    severity: 'info',
    kind: 'brotli-no-metadata',
    detail: `The brotli stream declares no length or checksum, so only the ${formatBytes(b.length)} compressed size is knowable without decoding.`,
  });
  return {
    format: 'brotli',
    magic: 'none',
    bytes: b.length,
    wellFormed: true,
    units: [
      {
        index: 0,
        kind: 'brotli stream',
        at: 0,
        compressed: b.length,
        uncompressed: null,
        extra: 'no header metadata',
      },
    ],
    header: [
      ['Format', 'brotli'],
      ['Magic bytes', 'none (brotli has no signature)'],
      ['Streams', '1'],
      ['Declared uncompressed size', '—'],
      ['Compression ratio', '—'],
    ],
    findings,
    checksum: null,
    truncatedAt: null,
  };
}

function indexOfNul(b: Uint8Array, from: number): number | null {
  for (let i = from; i < b.length; i += 1) if (b[i] === 0) return i;
  return null;
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function detect(b: Uint8Array, name: string): Model {
  const head4 = toHex(b, 4);
  if (head4 === '28 b5 2f fd' || (readU32LE(b, 0) & 0xfffffff0) === 0x184d2a50) return parseZstd(b);
  if (toHex(b, 3) === '42 5a 68') return parseBzip2(b);
  if (toHex(b, 6) === 'fd 37 7a 58 5a 00') return parseXz(b);
  if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) return parseGzip(b);
  if (readU32LE(b, 0) === 0x184d2204) return parseLz4(b);
  if (/\.br$/iu.test(name)) return parseBrotli(b);
  throw new ToolError(
    'Unrecognized compression format.',
    'The inspector recognises zstd, xz, bzip2, gzip and lz4 by their magic bytes, and brotli by the .br extension.',
  );
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const errors = m.findings.filter((f) => f.severity === 'error').length;
  const warns = m.findings.filter((f) => f.severity === 'warn').length;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Detected format', m.format],
      ['Magic bytes', m.magic],
      ['File size', formatBytes(m.bytes)],
      [
        'Frames / members',
        m.format === 'bzip2' && m.units.length === 0 ? 'not determinable' : String(m.units.length),
      ],
      ['Integrity check', m.checksum ?? 'none'],
      [
        'Structure',
        m.wellFormed
          ? 'complete'
          : m.truncatedAt === null
            ? 'not verifiable (header only)'
            : `truncated at byte ${m.truncatedAt}`,
      ],
      ['Findings', `${errors} error, ${warns} warning, ${m.findings.length - errors - warns} note`],
    ],
  };
}

function tableStructure(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.units.slice(0, max) : [];
  return {
    headers: ['#', 'Kind', 'Offset', 'Compressed', 'Uncompressed', 'Ratio', 'Detail'],
    rows: shown.map((u) => [
      String(u.index),
      u.kind,
      String(u.at),
      formatBytes(u.compressed),
      formatBytes(u.uncompressed),
      ratio(u.compressed, u.uncompressed),
      u.extra,
    ]),
  };
}

function tableHeader(m: Model): { headers: string[]; rows: string[][] } {
  return { headers: ['Field', 'Value'], rows: m.header.map(([k, v]) => [k, v]) };
}

function tableFindings(m: Model): { headers: string[]; rows: string[][] } {
  if (m.findings.length === 0)
    return { headers: ['Finding', 'Severity', 'Detail'], rows: [['none', 'INFO', 'No problems found in the stream headers.']] };
  return {
    headers: ['Finding', 'Severity', 'Detail'],
    rows: m.findings.map((f) => [f.kind, f.severity.toUpperCase(), f.detail.slice(0, CLIP * 2)]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxUnits = Math.max(0, Math.min(MAX_UNITS, Number(options.maxUnits ?? 100) || 0));
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  if (source === undefined) throw new ToolError('No file was provided.', 'Choose a compressed file to inspect.');

  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES)
    throw new ToolError(
      'That file is larger than 64 MB.',
      'Only the headers are parsed, but the file is read into memory first.',
    );

  const bytes = new Uint8Array(await source.arrayBuffer());
  const model = detect(bytes, source.name ?? '');
  model.findings = model.findings.slice(0, MAX_FINDINGS);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'structure':
      table = tableStructure(model, maxUnits);
      break;
    case 'header':
      table = tableHeader(model);
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
    notes: [`${model.format}: ${model.units.length} unit(s), ${errors} error(s).`],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { units: model.units.length, findings: model.findings.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;