import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './warc-archive-inspector.meta';

/**
 * WARC (Web ARChive) inspector.
 *
 * A WARC is a sequence of records. Each record is a header block terminated by
 * CRLFCRLF, followed by exactly `Content-Length` bytes, followed by two more
 * CRLF. The file may start with a WARC/1.0 file header block instead of a
 * record. This parser walks those boundaries so a wrong length is detected at
 * the exact byte where reading loses sync.
 *
 * Verdicts in the tests come from an independent Python walker over fixtures
 * built by an independent Python writer, not from this parser.
 */

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_DECOMPRESSED = 256 * 1024 * 1024;
const MAX_ROWS = 20000;
const MAX_HEADER_BYTES = 256 * 1024;
const CRLFCRLF = [0x0d, 0x0a, 0x0d, 0x0a];

type Severity = 'error' | 'warn' | 'info';

interface Finding {
  severity: Severity;
  kind: string;
  detail: string;
}

interface Record {
  index: number;
  offset: number;
  total: number;
  headerBytes: number;
  type: string;
  uri: string;
  date: string;
  ip: string;
  contentType: string;
  contentLength: number;
  recordId: string;
  httpStatus: string | null;
  ok: boolean;
}

interface Model {
  version: string;
  compressed: boolean;
  fileBytes: number;
  decodedBytes: number;
  fileHeader: Map<string, string>;
  records: Record[];
  findings: Finding[];
  duplicateUris: { uri: string; count: number }[];
  typeCounts: Map<string, number>;
  digestsChecked: number;
  digestFailures: number;
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

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

/** Compare a WARC digest header (e.g. "sha1:BASE32" or bare hex) against bytes. */
async function digestMatches(
  declared: string,
  bytes: Uint8Array,
): Promise<{ checked: boolean; matches: boolean; detail: string }> {
  const match = /^([a-z0-9-]+):(.+)$/iu.exec(declared.trim());
  const algorithm = (match?.[1] ?? 'sha1').toLowerCase();
  const expected = (match?.[2] ?? declared).trim();
  const webcryptoName =
    algorithm === 'sha1' ? 'SHA-1' : algorithm === 'sha256' ? 'SHA-256' : null;
  if (webcryptoName === null)
    return { checked: false, matches: false, detail: `Unsupported digest algorithm "${algorithm}".` };
  if (typeof crypto === 'undefined' || crypto.subtle === undefined)
    return { checked: false, matches: false, detail: 'WebCrypto is unavailable, so digests were not checked.' };
  const digest = new Uint8Array(await crypto.subtle.digest(webcryptoName, bytes as BufferSource));
  const actual = expected.length === digest.length * 2 ? hex(digest) : base32(digest);
  const matches = actual.toLowerCase() === expected.toLowerCase();
  return {
    checked: true,
    matches,
    detail: matches
      ? `${algorithm} digest matches`
      : `declared ${algorithm}:${expected} but content hashes to ${actual}`,
  };
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined')
    throw new ToolError(
      'This browser cannot decompress gzip archives.',
      'DecompressionStream is unavailable; open the uncompressed .warc instead.',
    );
  const stream = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(
    new DecompressionStream('gzip'),
  );
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function indexOfCrLfCrLf(b: Uint8Array, from: number, limit: number): number {
  for (let i = from; i + 3 < limit; i += 1) {
    if (
      b[i] === CRLFCRLF[0] &&
      b[i + 1] === CRLFCRLF[1] &&
      b[i + 2] === CRLFCRLF[2] &&
      b[i + 3] === CRLFCRLF[3]
    )
      return i;
  }
  return -1;
}

/** Parse `Key: value` header lines from a header block's text. */
function parseHeaderBlock(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = text.split(/\r\n/u);
  // First line is the version line (WARC/1.0) and is kept separately.
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line === '') continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key !== '' && !out.has(key)) out.set(key, value);
  }
  return out;
}

async function parseWarc(b: Uint8Array, compressed: boolean, fileBytes: number): Promise<Model> {
  const findings: Finding[] = [];
  const records: Record[] = [];
  let digestsChecked = 0;
  let digestFailures = 0;
  const text = latin1(b);

  const versionMatch = /^WARC\/(\d+\.\d+)/u.exec(text);
  if (versionMatch === null)
    throw new ToolError(
      'That file is not a WARC archive.',
      'A WARC file must begin with a WARC/1.0 version line.',
    );
  const version = versionMatch[1]!;

  // The file may start with a file header block (no WARC-Type) before records.
  let at = 0;
  let fileHeader = new Map<string, string>();
  const firstEnd = indexOfCrLfCrLf(b, 0, Math.min(b.length, MAX_HEADER_BYTES));
  if (firstEnd === -1)
    throw new ToolError(
      'That WARC file has no complete header block.',
      `No header terminator was found in the first ${MAX_HEADER_BYTES} bytes.`,
    );

  const firstBlock = parseHeaderBlock(text.slice(0, firstEnd));
  const firstIsRecord = firstBlock.has('warc-type');
  if (firstIsRecord) {
    at = 0;
  } else {
    fileHeader = firstBlock;
    at = firstEnd + 4;
  }

  let index = 0;
  while (at < b.length) {
    // Tolerate a single trailing CRLF between records, as the spec allows.
    while (at + 1 < b.length && b[at] === 0x0d && b[at + 1] === 0x0a) at += 2;
    if (at >= b.length) break;

    const remaining = b.length - at;
    if (remaining < 10) {
      findings.push({
        severity: 'warn',
        kind: 'trailing-bytes',
        detail: `${remaining} unexplained byte(s) at the end of the file (offset ${at}).`,
      });
      break;
    }
    if (!text.startsWith('WARC/', at)) {
      findings.push({
        severity: 'error',
        kind: 'lost-sync',
        detail: `Expected a record at byte ${at} but found "${text.slice(at, at + 24).split('\r\n')[0]}".`,
      });
      break;
    }

    const headerEnd = indexOfCrLfCrLf(b, at, Math.min(b.length, at + MAX_HEADER_BYTES));
    if (headerEnd === -1) {
      findings.push({
        severity: 'error',
        kind: 'unterminated-header',
        detail: `The record header starting at byte ${at} has no CRLFCRLF terminator.`,
      });
      break;
    }
    const headerBytes = headerEnd + 4 - at;
    const fields = parseHeaderBlock(text.slice(at, headerEnd));
    const clenRaw = fields.get('content-length');
    const contentLength = clenRaw === undefined ? NaN : Number(clenRaw);

    if (clenRaw === undefined || !Number.isFinite(contentLength) || contentLength < 0) {
      findings.push({
        severity: 'error',
        kind: 'bad-content-length',
        detail: `The record at byte ${at} has Content-Length "${clenRaw ?? '(missing)'}", which is not a byte count.`,
      });
      break;
    }

    const bodyStart = headerEnd + 4;
    if (bodyStart + contentLength > b.length) {
      findings.push({
        severity: 'error',
        kind: 'truncated-record',
        detail: `The record at byte ${at} declares ${contentLength} content bytes, but only ${b.length - bodyStart} remain.`,
      });
      break;
    }

    // Trailing CRLFCRLF is required; accept a short tail at EOF as a warning.
    const trailerAt = bodyStart + contentLength;
    const hasTrailer =
      trailerAt + 4 <= b.length &&
      b[trailerAt] === 0x0d &&
      b[trailerAt + 1] === 0x0a &&
      b[trailerAt + 2] === 0x0d &&
      b[trailerAt + 3] === 0x0a;
    const total = headerBytes + contentLength + (hasTrailer ? 4 : 0);
    if (!hasTrailer) {
      // The spec requires two CRLFs after every content block, including the
      // last record. A record ending flush at EOF is a truncated archive.
      findings.push({
        severity: 'warn',
        kind: 'missing-record-trailer',
        detail: `The record at byte ${at} is not followed by the required CRLFCRLF.`,
      });
    }

    // Verify the declared block digest against the content bytes on disk.
    const blockDigest = fields.get('warc-block-digest');
    if (blockDigest !== undefined) {
      const body = b.subarray(bodyStart, bodyStart + contentLength);
      const verdict = await digestMatches(blockDigest, body);
      digestsChecked += verdict.checked ? 1 : 0;
      if (verdict.checked && !verdict.matches) {
        digestFailures += 1;
        findings.push({
          severity: 'error',
          kind: 'block-digest-mismatch',
          detail: `The record at byte ${at}: ${verdict.detail}.`,
        });
      } else if (!verdict.checked) {
        findings.push({
          severity: 'info',
          kind: 'block-digest-unchecked',
          detail: `The record at byte ${at}: ${verdict.detail}`,
        });
      }
    }

    // For response/revisit records the content block is an HTTP message.
    const type = (fields.get('warc-type') ?? 'unknown').toLowerCase();
    let httpStatus: string | null = null;
    if (type === 'response' || type === 'revisit') {
      const head = latin1(b.subarray(bodyStart, Math.min(trailerAt, bodyStart + 2048)));
      const statusMatch = /^HTTP\/\d\.\d\s+(\d{3})(?:\s+(.*))?$/u.exec(head.split(/\r?\n/u)[0] ?? '');
      if (statusMatch !== null)
        httpStatus = statusMatch[2] ? `${statusMatch[1]} ${statusMatch[2].trim()}` : statusMatch[1]!;
      else
        findings.push({
          severity: 'warn',
          kind: 'response-without-status',
          detail: `The ${type} record at byte ${at} does not begin with an HTTP status line.`,
        });
    }

    records.push({
      index,
      offset: at,
      total,
      headerBytes,
      type,
      uri: fields.get('target-uri') ?? fields.get('warc-target-uri') ?? '—',
      date: fields.get('warc-date') ?? '—',
      ip: fields.get('warc-ip-address') ?? '—',
      contentType: fields.get('content-type') ?? '—',
      contentLength,
      recordId: fields.get('warc-record-id') ?? '—',
      httpStatus,
      ok: true,
    });
    index += 1;
    if (records.length > MAX_ROWS * 4) {
      findings.push({
        severity: 'info',
        kind: 'stopped-early',
        detail: `Stopped after ${records.length} records to keep memory bounded.`,
      });
      break;
    }
    at = bodyStart + contentLength + (hasTrailer ? 4 : 0);
  }

  if (records.length === 0 && findings.length === 0)
    findings.push({
      severity: 'warn',
      kind: 'no-records',
      detail: 'The file has a WARC header but no records.',
    });

  // --- Aggregate checks ---------------------------------------------------
  const typeCounts = new Map<string, number>();
  for (const record of records)
    typeCounts.set(record.type, (typeCounts.get(record.type) ?? 0) + 1);

  const uriCounts = new Map<string, number>();
  for (const record of records) {
    if (record.uri === '—') continue;
    uriCounts.set(record.uri, (uriCounts.get(record.uri) ?? 0) + 1);
  }
  const duplicateUris = [...uriCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([uri, count]) => ({ uri, count }))
    .sort((a, b) => b.count - a.count);

  if (!compressed && fileBytes > 1024 * 1024)
    findings.push({
      severity: 'info',
      kind: 'uncompressed-large',
      detail: `This archive is ${(fileBytes / (1024 * 1024)).toFixed(1)} MiB uncompressed; WARC files are normally stored with gzip.`,
    });

  if (records.length > 0 && !typeCounts.has('warcinfo'))
    findings.push({
      severity: 'info',
      kind: 'no-warcinfo',
      detail: 'No warcinfo record: the archive does not describe how it was captured.',
    });

  for (const record of records) {
    if (record.contentType.toLowerCase().includes('gzip'))
      findings.push({
        severity: 'info',
        kind: 'compressed-content',
        detail: `The record at byte ${record.offset} stores gzip-compressed content; the inspector does not inflate record bodies.`,
      });
  }

  return {
    version,
    compressed,
    fileBytes,
    decodedBytes: b.length,
    fileHeader,
    records,
    findings,
    duplicateUris,
    typeCounts,
    digestsChecked,
    digestFailures,
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const errors = m.findings.filter((f) => f.severity === 'error').length;
  const warns = m.findings.filter((f) => f.severity === 'warn').length;
  const types = [...m.typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type} ${count}`)
    .join(', ');
  const rows: string[][] = [
    ['WARC version', m.version],
    ['Compressed', m.compressed ? 'yes (gzip)' : 'no'],
    ['File size', formatBytes(m.fileBytes)],
    ['Decoded size', formatBytes(m.decodedBytes)],
    ['Records', String(m.records.length)],
    ['Record types', types === '' ? '—' : types],
    ['Distinct target URIs', String(new Set(m.records.map((r) => r.uri).filter((u) => u !== '—')).size)],
    ['Duplicate URIs', String(m.duplicateUris.length)],
    [
      'Block digests',
      m.digestsChecked === 0
        ? 'none declared'
        : `${m.digestsChecked} verified, ${m.digestFailures} mismatch`,
    ],
    [
      'Findings',
      `${errors} error, ${warns} warning, ${m.findings.length - errors - warns} note`,
    ],
  ];
  for (const [key, value] of m.fileHeader) {
    if (key === 'software-info' || key === 'format' || key === 'filename')
      rows.push([`Header: ${key}`, value]);
  }
  return { headers: ['Property', 'Value'], rows };
}

function tableRecords(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.records.slice(0, max) : [];
  return {
    headers: ['#', 'Offset', 'Type', 'Length', 'Target URI', 'Date', 'Content type'],
    rows: shown.map((r) => [
      String(r.index),
      String(r.offset),
      r.type,
      formatBytes(r.total),
      r.uri,
      r.date,
      r.contentType,
    ]),
  };
}

function tableUris(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const counts = new Map<string, number>();
  for (const record of m.records) {
    if (record.uri === '—') continue;
    counts.set(record.uri, (counts.get(record.uri) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = max > 0 ? entries.slice(0, max) : [];
  return {
    headers: ['Target URI', 'Records', 'Duplicate'],
    rows: shown.map(([uri, count]) => [uri, String(count), count > 1 ? 'yes' : 'no']),
  };
}

function tableResponses(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const responses = m.records.filter((r) => r.type === 'response' || r.type === 'revisit');
  const shown = max > 0 ? responses.slice(0, max) : [];
  if (responses.length === 0)
    return {
      headers: ['#', 'Offset', 'Status', 'Target URI', 'Body bytes'],
      rows: [['—', '—', 'No response records in this archive', '—', '—']],
    };
  return {
    headers: ['#', 'Offset', 'Status', 'Target URI', 'Body bytes'],
    rows: shown.map((r) => [
      String(r.index),
      String(r.offset),
      r.httpStatus ?? '—',
      r.uri,
      formatBytes(r.contentLength),
    ]),
  };
}

function tableFindings(m: Model): { headers: string[]; rows: string[][] } {
  if (m.findings.length === 0)
    return {
      headers: ['Finding', 'Severity', 'Detail'],
      rows: [['none', 'INFO', 'Every record boundary matched its declared Content-Length.']],
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
    throw new ToolError('No archive was provided.', 'Choose a .warc or .warc.gz file to inspect.');

  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES)
    throw new ToolError(
      'That file is larger than 64 MB.',
      'The archive is decompressed in memory before parsing.',
    );

  const raw = new Uint8Array(await source.arrayBuffer());
  const isGzip = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b;

  let bytes: Uint8Array = raw;
  if (isGzip) {
    // Copy into a fresh ArrayBuffer-backed view so the buffer type stays concrete.
    const inflated = await gunzip(raw);
    bytes = new Uint8Array(inflated.length);
    bytes.set(inflated);
    if (bytes.length > MAX_DECOMPRESSED)
      throw new ToolError(
        'That archive expands past the 256 MB limit.',
        `The gzip stream decodes to ${formatBytes(bytes.length)}.`,
      );
  }

  const model = await parseWarc(bytes, isGzip, source.size);

  let table: { headers: string[]; rows: string[][] };
  switch (format) {
    case 'records':
      table = tableRecords(model, maxRows);
      break;
    case 'uris':
      table = tableUris(model, maxRows);
      break;
    case 'responses':
      table = tableResponses(model, maxRows);
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
      `WARC ${model.version}: ${model.records.length} record(s), ` +
        `${formatBytes(model.decodedBytes)} decoded, ${errors} error(s).`,
    ],
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: {
      records: model.records.length,
      findings: model.findings.length,
      decodedBytes: model.decodedBytes,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;