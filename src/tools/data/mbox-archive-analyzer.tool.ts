import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mbox-archive-analyzer.meta';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_MESSAGES = 5000;
const MAX_ROWS = 2000;
const MAX_FINDINGS = 300;
const MAX_MIME_DEPTH = 8;
const MAX_PARTS = 200;
const LARGE_ATTACHMENT = 5 * 1024 * 1024;
const CLIP = 100;

const UTF8 = new TextDecoder('utf-8', { fatal: false });
const ENCODER = new TextEncoder();

const clip = (value: string, max = CLIP): string => {
  const flat = value.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

const formatBytes = (value: number): string => {
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(value < 10 * 1024 ? 1 : 0) + ' KB';
  return (value / (1024 * 1024)).toFixed(2) + ' MB';
};

const byteAt = (bytes: Uint8Array, index: number): number => bytes[index] ?? 0;

/** True when the bytes at `offset` begin the mbox From_ separator line. */
const startsWithFrom = (bytes: Uint8Array, offset: number): boolean =>
  byteAt(bytes, offset) === 70 &&
  byteAt(bytes, offset + 1) === 114 &&
  byteAt(bytes, offset + 2) === 111 &&
  byteAt(bytes, offset + 3) === 109 &&
  byteAt(bytes, offset + 4) === 32;

const indexOfLf = (bytes: Uint8Array, from: number): number => {
  for (let index = from; index < bytes.length; index += 1) {
    if (bytes[index] === 10) return index;
  }
  return -1;
};

interface RawMessage {
  index: number;
  line: number;
  start: number;
  stop: number;
  contentStart: number;
  envelope: string;
  separatedByBlank: boolean;
}

interface SplitResult {
  messages: RawMessage[];
  total: number;
  preamble: number;
  crlf: boolean;
  endsWithNewline: boolean;
  newlines: number;
}

/**
 * Splits the archive the way Python's mailbox module does: a line beginning with "From " starts a
 * message, and the previous message ends before the blank line that precedes it, or exactly at the
 * separator when there is no blank line. A blank line only counts when it is a bare "\n", so CRLF
 * archives are split the same way the reference implementation splits them.
 */
function splitArchive(bytes: Uint8Array): SplitResult {
  const starts: number[] = [];
  const stops: number[] = [];
  const lines: number[] = [];
  const blanks: boolean[] = [];
  let lastWasEmpty = false;
  let newlines = 0;
  let crlf = false;
  let position = 0;

  while (position < bytes.length) {
    const newline = indexOfLf(bytes, position);
    const terminated = newline >= 0;
    const contentEnd = terminated ? newline : bytes.length;
    if (terminated) newlines += 1;
    const carriage = contentEnd > position && byteAt(bytes, contentEnd - 1) === 13;
    if (carriage) crlf = true;
    const blank = position === contentEnd && !carriage;

    if (startsWithFrom(bytes, position)) {
      if (stops.length < starts.length) {
        stops.push(lastWasEmpty ? position - 1 : position);
        blanks.push(lastWasEmpty);
      }
      starts.push(position);
      lines.push(newlines + 1);
      lastWasEmpty = false;
    } else {
      lastWasEmpty = blank;
    }
    position = terminated ? contentEnd + 1 : bytes.length;
  }

  if (stops.length < starts.length) {
    stops.push(lastWasEmpty ? bytes.length - 1 : bytes.length);
    blanks.push(lastWasEmpty);
  }

  const messages: RawMessage[] = [];
  for (let index = 0; index < starts.length && index < MAX_MESSAGES; index += 1) {
    const start = starts[index] ?? 0;
    const stop = Math.max(start, stops[index] ?? bytes.length);
    const newline = indexOfLf(bytes, start);
    const envelopeEnd = newline >= 0 && newline < stop ? newline : stop;
    const envelope = UTF8.decode(bytes.subarray(start, envelopeEnd)).replace(/\r$/u, '');
    const contentStart = Math.min(stop, envelopeEnd + 1);
    messages.push({
      index: index + 1,
      line: lines[index] ?? 1,
      start,
      stop,
      contentStart,
      envelope,
      separatedByBlank: blanks[index] ?? false,
    });
  }
  const preamble = starts.length > 0 ? (starts[0] ?? 0) : bytes.length;
  return {
    messages,
    total: starts.length,
    preamble,
    crlf,
    endsWithNewline: bytes.length > 0 && byteAt(bytes, bytes.length - 1) === 10,
    newlines,
  };
}

/** Removes the mboxrd escape a reader strips: a body line with one or more '>' before "From ". */
function unescapeFrom(line: string): string {
  const match = /^(>+)From /u.exec(line);
  return match === null ? line : line.slice(1);
}

const isEscapedFrom = (line: string): boolean => /^>+From /u.test(line);

interface Header {
  key: string;
  value: string;
  line: number;
}

interface HeaderBlock {
  headers: Header[];
  bad: { line: number; text: string }[];
  bodyStart: number;
}

/** Unfolds a header block, keeping the offset at which the body begins. */
function readHeaders(text: string, firstLine: number): HeaderBlock {
  const lines = text.split('\n');
  const headers: Header[] = [];
  const bad: { line: number; text: string }[] = [];
  let current: Header | null = null;
  let bodyStart = lines.length;
  let inBody = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').replace(/\r$/u, '');
    if (inBody) continue;
    if (line.trim() === '') {
      bodyStart = index + 1;
      inBody = true;
      continue;
    }
    if (/^[ \t]/u.test(line) && current !== null) {
      current.value = current.value + ' ' + line.trim();
      continue;
    }
    const colon = line.indexOf(':');
    if (colon <= 0) {
      bad.push({ line: firstLine + index, text: clip(line) });
      inBody = true;
      bodyStart = index + 1;
      current = null;
      continue;
    }
    current = {
      key: line.slice(0, colon).trim(),
      value: line.slice(colon + 1).trim(),
      line: firstLine + index,
    };
    headers.push(current);
  }
  if (!inBody) bodyStart = lines.length;
  return { headers, bad, bodyStart };
}

const headerValue = (headers: Header[], key: string): string =>
  headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value ?? '';

/** Decodes RFC 2047 encoded words in a header value. */
function decodeWords(value: string): { text: string; failed: number; words: number } {
  let failed = 0;
  let words = 0;
  const text = value.replace(
    /=\?([^?\s]+)\?([BbQq])\?([^?]*)\?=/gu,
    (whole: string, charset: string, mode: string, payload: string) => {
      words += 1;
      try {
        let bytes: Uint8Array<ArrayBuffer>;
        if (mode === 'B' || mode === 'b') {
          const cleaned = payload.replace(/\s+/gu, '');
          if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(cleaned) || cleaned.length % 4 === 1) {
            failed += 1;
            return whole;
          }
          const binary = atob(cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4));
          bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1)
            bytes[index] = binary.charCodeAt(index);
        } else {
          const qp = payload
            .replace(/_/gu, ' ')
            .replace(/=([0-9A-Fa-f]{2})/gu, (_m, hex: string) =>
              String.fromCharCode(Number.parseInt(hex, 16)),
            );
          bytes = ENCODER.encode(qp);
        }
        return new TextDecoder(labelFor(charset), { fatal: false }).decode(bytes);
      } catch {
        failed += 1;
        return whole;
      }
    },
  );
  return { text, failed, words };
}

const CHARSETS: Record<string, string> = {
  'utf-8': 'utf-8',
  utf8: 'utf-8',
  'us-ascii': 'utf-8',
  ascii: 'utf-8',
  'iso-8859-1': 'iso-8859-1',
  latin1: 'iso-8859-1',
  'latin-1': 'iso-8859-1',
  'windows-1252': 'windows-1252',
  cp1252: 'windows-1252',
  'iso-8859-15': 'iso-8859-15',
  'koi8-r': 'koi8-r',
};

const labelFor = (charset: string): string => CHARSETS[charset.trim().toLowerCase()] ?? 'utf-8';

interface ParsedType {
  type: string;
  sub: string;
  params: Record<string, string>;
  raw: string;
}

function parseContentType(value: string): ParsedType {
  if (value.trim() === '') return { type: 'text', sub: 'plain', params: {}, raw: 'text/plain' };
  const segments = value.split(';');
  const [type = 'text', sub = 'plain'] = (segments[0] ?? 'text/plain')
    .trim()
    .toLowerCase()
    .split('/');
  const params: Record<string, string> = {};
  for (const segment of segments.slice(1)) {
    const equals = segment.indexOf('=');
    if (equals < 0) continue;
    const key = segment.slice(0, equals).trim().toLowerCase();
    let setting = segment.slice(equals + 1).trim();
    if (setting.startsWith('"') && setting.endsWith('"') && setting.length > 1)
      setting = setting.slice(1, -1);
    if (key === 'filename' || key === 'name') {
      const decoded = decodeWords(setting).text;
      params[key] = decoded;
    } else {
      params[key] = setting;
    }
  }
  return { type: type.trim(), sub: sub.trim(), params, raw: (type + '/' + sub).trim() };
}

const base64Bytes = (text: string): number => {
  const cleaned = text.replace(/[^A-Za-z0-9+/=]/gu, '');
  const padding = (cleaned.match(/=+$/u)?.[0] ?? '').length;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
};

const quotedPrintableBytes = (text: string): number => {
  const withoutSoftBreaks = text.replace(/=\r?\n/gu, '');
  const hex = (withoutSoftBreaks.match(/=[0-9A-Fa-f]{2}/gu) ?? []).length;
  return Math.max(0, withoutSoftBreaks.length - hex * 2);
};

const decodeBase64Text = (text: string): string => {
  const cleaned = text.replace(/[^A-Za-z0-9+/=]/gu, '');
  try {
    return atob(cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4));
  } catch {
    return '';
  }
};

const decodeQuotedPrintable = (text: string, charset: string): string => {
  const bytes: number[] = [];
  const withoutSoftBreaks = text.replace(/=\r?\n/gu, '');
  for (let index = 0; index < withoutSoftBreaks.length; index += 1) {
    const character = withoutSoftBreaks[index] ?? '';
    if (character === '=' && index + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.slice(index + 1, index + 3);
      if (/^[0-9A-Fa-f]{2}$/u.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        index += 2;
        continue;
      }
    }
    const encoded = ENCODER.encode(character);
    for (const byte of encoded) bytes.push(byte);
  }
  return new TextDecoder(labelFor(charset), { fatal: false }).decode(Uint8Array.from(bytes));
};

interface Part {
  message: number;
  level: number;
  type: string;
  sub: string;
  filename: string;
  encoding: string;
  disposition: string;
  size: number;
  charset: string;
  body: string;
}

interface MimeResult {
  parts: Part[];
  text: string;
  boundaryMissing: boolean;
  badBase64: boolean;
  depthExceeded: boolean;
  partCap: boolean;
}

/** Splits a multipart body on its boundary lines. */
function splitOnBoundary(
  body: string,
  boundary: string,
): { parts: string[]; found: number; closed: boolean } {
  const parts: string[] = [];
  const lines = body.split('\n');
  let current: string[] | null = null;
  let found = 0;
  let closed = false;
  for (const line of lines) {
    const trimmed = line.replace(/\r$/u, '');
    if (trimmed === '--' + boundary || trimmed === '--' + boundary + '--') {
      if (trimmed.endsWith('--')) closed = true;
      if (current !== null) parts.push(current.join('\n'));
      current = [];
      found += 1;
      if (closed) break;
      continue;
    }
    if (current !== null) current.push(line);
  }
  if (current !== null && !closed) parts.push(current.join('\n'));
  return { parts, found, closed };
}

function walkMime(
  message: number,
  level: number,
  contentType: string,
  transferRaw: string,
  rawBody: string,
  parts: Part[],
  state: MimeResult,
): string {
  if (level > MAX_MIME_DEPTH) {
    state.depthExceeded = true;
    return '';
  }
  if (parts.length >= MAX_PARTS) {
    state.partCap = true;
    return '';
  }
  const parsed = parseContentType(contentType);
  if (parsed.type === 'multipart') {
    const boundary = parsed.params.boundary ?? '';
    if (boundary === '') {
      state.boundaryMissing = true;
      return '';
    }
    const split = splitOnBoundary(rawBody, boundary);
    if (split.found === 0) {
      state.boundaryMissing = true;
      return '';
    }
    for (const part of split.parts) {
      if (parts.length >= MAX_PARTS) {
        state.partCap = true;
        break;
      }
      const inner = readHeaders(part, 0);
      const innerType = headerValue(inner.headers, 'Content-Type') || 'text/plain';
      const innerTransfer = (
        headerValue(inner.headers, 'Content-Transfer-Encoding') || '7bit'
      ).toLowerCase();
      const disposition = headerValue(inner.headers, 'Content-Disposition');
      const innerBody = part.split('\n').slice(inner.bodyStart).join('\n').replace(/\r$/u, '');
      const innerParsed = parseContentType(innerType);
      const filename =
        innerParsed.params.filename ?? parseContentType(disposition).params.filename ?? '';
      const innerDisposition = (disposition.split(';')[0] ?? '').trim().toLowerCase();
      const charset = innerParsed.params.charset ?? 'utf-8';
      const decodedSize =
        innerTransfer === 'base64'
          ? base64Bytes(innerBody)
          : innerTransfer === 'quoted-printable'
            ? quotedPrintableBytes(innerBody)
            : ENCODER.encode(innerBody).length;
      parts.push({
        message,
        level,
        type: innerParsed.type,
        sub: innerParsed.sub,
        filename,
        encoding: innerTransfer,
        disposition: innerDisposition,
        size: decodedSize,
        charset,
        body: innerBody,
      });
      if (innerParsed.type === 'multipart') {
        walkMime(message, level + 1, innerType, innerTransfer, innerBody, parts, state);
      }
    }
    return '';
  }

  const transfer = transferRaw.trim().toLowerCase() || '7bit';
  const disposition = '';
  const charset = parsed.params.charset ?? 'utf-8';
  const decodedSize =
    transfer === 'base64'
      ? base64Bytes(rawBody)
      : transfer === 'quoted-printable'
        ? quotedPrintableBytes(rawBody)
        : ENCODER.encode(rawBody).length;
  parts.push({
    message,
    level,
    type: parsed.type,
    sub: parsed.sub,
    filename: parsed.params.filename ?? '',
    encoding: transfer,
    disposition,
    size: decodedSize,
    charset,
    body: rawBody,
  });
  if (parsed.type === 'text') {
    return decodedSize === 0 ? '' : decodeQuotedPrintable(rawBody, charset);
  }
  return '';
}

interface MessageInfo {
  index: number;
  line: number;
  envelope: string;
  envelopeSender: string;
  envelopeDate: string;
  bytes: number;
  from: string;
  fromName: string;
  fromAddress: string;
  fromDomain: string;
  to: string;
  subject: string;
  date: string;
  dateIso: string;
  messageId: string;
  inReplyTo: string;
  flags: string;
  headers: Header[];
  parts: Part[];
  text: string;
  textLines: number;
  attachments: Part[];
  escapedLines: number;
  separateByBlank: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Parses an RFC 5322 date into an ISO string, or null when it does not look like one. */
function parseDate(value: string): string | null {
  if (value.trim() === '') return null;
  const match =
    /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|[A-Z]{2,4}|UT|GMT)?/u.exec(
      value,
    );
  if (match === null) return null;
  const day = Number.parseInt(match[1] ?? '', 10);
  const month = MONTHS.indexOf((match[2] ?? '').toLowerCase());
  const year = Number.parseInt(match[3] ?? '', 10);
  const hour = Number.parseInt(match[4] ?? '0', 10);
  const minute = Number.parseInt(match[5] ?? '0', 10);
  const second = Number.parseInt(match[6] ?? '0', 10);
  if (month < 0 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 60) return null;
  const offset = match[7] ?? '';
  const zones: Record<string, string> = {
    UT: '+0000',
    GMT: '+0000',
    UTC: '+0000',
    EST: '-0500',
    EDT: '-0400',
    CST: '-0600',
    CDT: '-0500',
    MST: '-0700',
    MDT: '-0600',
    PST: '-0800',
    PDT: '-0700',
    CET: '+0100',
    CEST: '+0200',
  };
  let zone = '+0000';
  if (/^[+-]\d{4}$/u.test(offset)) zone = offset;
  else if (zones[offset.toUpperCase()] !== undefined) zone = zones[offset.toUpperCase()] ?? '+0000';
  return (
    String(year).padStart(4, '0') +
    '-' +
    String(month + 1).padStart(2, '0') +
    '-' +
    String(day).padStart(2, '0') +
    'T' +
    String(hour).padStart(2, '0') +
    ':' +
    String(minute).padStart(2, '0') +
    ':' +
    String(second).padStart(2, '0') +
    zone.slice(0, 3) +
    ':' +
    zone.slice(3, 5)
  );
}

function parseAddress(value: string): { name: string; address: string; domain: string } {
  const decoded = decodeWords(value).text;
  const angled = /<([^>]*)>/u.exec(decoded);
  const address = (angled?.[1] ?? decoded).trim().toLowerCase();
  const name = angled === null ? '' : decoded.slice(0, angled.index).replace(/["']/gu, '').trim();
  return {
    name,
    address,
    domain: address.includes('@') ? address.slice(address.lastIndexOf('@') + 1) : '',
  };
}

/** Reads the Status and X-Status headers the way mail readers track read/replied state. */
function readFlags(headers: Header[]): string {
  const status = headerValue(headers, 'Status').replace(/\s+/gu, '');
  const xstatus = headerValue(headers, 'X-Status').replace(/\s+/gu, '');
  const names: Record<string, string> = {
    R: 'read',
    O: 'old',
    A: 'answered',
    F: 'flagged',
    D: 'deleted',
    T: 'draft',
    N: 'new',
  };
  const seen: string[] = [];
  for (const character of status + xstatus) {
    const name = names[character.toUpperCase()];
    if (name !== undefined && !seen.includes(name)) seen.push(name);
  }
  return seen.join(', ');
}

function countBodyLines(text: string): number {
  if (text === '') return 0;
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  return trimmed === '' ? 0 : trimmed.split('\n').length;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const top = Math.max(3, Math.min(50, Number(options.top ?? 10) || 10));

  const source = (input.files ?? [])[0];
  let bytes: Uint8Array<ArrayBuffer>;
  let sourceLabel: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES)
      throw new ToolError(
        'That file is larger than 16 MB.',
        'Split the archive and analyze one part at a time.',
      );
    bytes = new Uint8Array(await source.arrayBuffer());
    sourceLabel = source.name === '' ? 'uploaded file' : source.name;
  } else {
    const text = String(input.text ?? '');
    if (text.trim() === '')
      throw new ToolError('No archive was provided.', 'Drop an mbox file or paste its text.');
    if (text.length > MAX_BYTES) throw new ToolError('That is more than 16 MB of input.');
    bytes = ENCODER.encode(text);
    sourceLabel = 'pasted text';
  }

  const split = splitArchive(bytes);
  if (split.messages.length === 0) {
    throw new ToolError(
      'No mbox separator was found.',
      'An mbox archive needs a line beginning with "From " before each message. A single .eml file can be inspected with the Email Header Analyzer instead.',
    );
  }

  const findings: { level: 'error' | 'warning' | 'note'; problem: string; detail: string }[] = [];
  const push = (level: 'error' | 'warning' | 'note', problem: string, detail: string): void => {
    if (findings.length < MAX_FINDINGS) findings.push({ level, problem, detail });
  };

  const messages: MessageInfo[] = [];
  const ids = new Map<string, number[]>();
  let escapedTotal = 0;
  let nonUtf8Headers = 0;
  let fragileStarts = 0;

  for (const raw of split.messages) {
    const content = bytes.subarray(raw.contentStart, raw.stop);
    const headerText = UTF8.decode(content);
    const headerBlock = readHeaders(headerText, raw.line + 1);
    const bodyText = headerText.split('\n').slice(headerBlock.bodyStart).join('\n');

    if (content.length === 0) {
      push(
        'error',
        'A message block is empty',
        'Message ' + raw.index + ' at line ' + raw.line + ' has a From_ line but nothing after it.',
      );
    } else if (headerBlock.headers.length === 0) {
      push(
        'error',
        'A message has no headers at all',
        'Message ' +
          raw.index +
          ' at line ' +
          raw.line +
          ' has no line with a "Key: value" header, so no reader can show it.',
      );
    }
    for (const bad of headerBlock.bad) {
      if (headerBlock.headers.length > 0) {
        push(
          'warning',
          'A header line is not a header',
          'Line ' +
            bad.line +
            ' reads "' +
            bad.text +
            '". If this was meant to be the body, a blank line between the headers and the body is missing.',
        );
      }
    }

    const dateValue = decodeWords(headerValue(headerBlock.headers, 'Date')).text;
    const dateIso = parseDate(dateValue) ?? '';
    const fromValue = decodeWords(headerValue(headerBlock.headers, 'From')).text;
    const address = parseAddress(fromValue);
    const subjectValue = decodeWords(headerValue(headerBlock.headers, 'Subject')).text;
    const toValue = decodeWords(headerValue(headerBlock.headers, 'To')).text;
    const messageId =
      headerValue(headerBlock.headers, 'Message-ID') ||
      headerValue(headerBlock.headers, 'Message-Id');
    const inReplyTo = headerValue(headerBlock.headers, 'In-Reply-To');
    if (/[\uFFFD]/u.test(headerText)) nonUtf8Headers += 1;
    if (!raw.separatedByBlank && messages.length > 0) fragileStarts += 1;

    if (headerValue(headerBlock.headers, 'From') === '') {
      push(
        'warning',
        'A message has no From header',
        'Message ' + raw.index + ' cannot be attributed to a sender.',
      );
    }
    if (dateValue === '') {
      push(
        'warning',
        'A message has no Date header',
        'Message ' + raw.index + ' has no date, so its place in the timeline is unknown.',
      );
    } else if (dateIso === '') {
      push(
        'warning',
        'A Date header does not parse',
        'Message ' +
          raw.index +
          ' says "' +
          clip(dateValue, 60) +
          '", which is not an RFC 5322 date.',
      );
    }
    if (subjectValue === '') {
      push(
        'warning',
        'A message has no Subject header',
        'Message ' + raw.index + ' is listed by sender and date only.',
      );
    }

    let escaped = 0;
    const bodyLines = bodyText.split('\n');
    for (const line of bodyLines) {
      const flat = line.replace(/\r$/u, '');
      if (isEscapedFrom(flat)) escaped += 1;
    }
    escapedTotal += escaped;
    const unescapedBody = bodyLines
      .map((line) => unescapeFrom(line.replace(/\r$/u, '')))
      .join('\n');

    const mime: MimeResult = {
      parts: [],
      text: '',
      boundaryMissing: false,
      badBase64: false,
      depthExceeded: false,
      partCap: false,
    };
    const contentType = headerValue(headerBlock.headers, 'Content-Type') || 'text/plain';
    const topType = parseContentType(contentType);
    const topTransfer = (
      headerValue(headerBlock.headers, 'Content-Transfer-Encoding') || ''
    ).toLowerCase();
    let text = '';
    if (topType.type === 'multipart') {
      text = walkMime(raw.index, 0, contentType, topTransfer, unescapedBody, mime.parts, mime);
    } else {
      const decoded =
        topTransfer === 'base64'
          ? decodeBase64Text(unescapedBody)
          : topTransfer === 'quoted-printable'
            ? decodeQuotedPrintable(unescapedBody, topType.params.charset ?? 'utf-8')
            : unescapedBody;
      text = decoded;
      mime.parts.push({
        message: raw.index,
        level: 0,
        type: topType.type,
        sub: topType.sub,
        filename: topType.params.filename ?? '',
        encoding: topTransfer === '' ? '7bit' : topTransfer,
        disposition: '',
        size: ENCODER.encode(unescapedBody).length,
        charset: topType.params.charset ?? 'utf-8',
        body: unescapedBody,
      });
    }
    // Prefer the first text part without a filename as the readable body.
    const bodyPart = mime.parts.find(
      (part) => part.type === 'text' && part.filename === '' && part.encoding !== 'base64',
    );
    if (bodyPart !== undefined) {
      text =
        bodyPart.encoding === 'quoted-printable'
          ? decodeQuotedPrintable(bodyPart.body, bodyPart.charset)
          : bodyPart.body;
    }
    if (mime.boundaryMissing) {
      push(
        'warning',
        'A multipart message declares a boundary that never appears',
        'Message ' +
          raw.index +
          ' claims ' +
          clip(contentType, 60) +
          ' but its body has no such boundary line, so the parts cannot be listed.',
      );
    }
    if (mime.depthExceeded) {
      push(
        'note',
        'MIME nesting is deeper than ' + MAX_MIME_DEPTH + ' levels',
        'Message ' + raw.index + ' was not expanded further.',
      );
    }
    if (mime.partCap) {
      push(
        'note',
        'A message has more than ' + MAX_PARTS + ' MIME parts',
        'Message ' + raw.index + ' lists only the first ' + MAX_PARTS + ' parts.',
      );
    }
    for (const part of mime.parts) {
      if (part.encoding === 'base64' && /[^A-Za-z0-9+/=\s]/u.test(part.body)) {
        push(
          'warning',
          'A base64 payload has characters outside base64',
          'Message ' +
            raw.index +
            ', part ' +
            clip(part.filename || part.type + '/' + part.sub, 40) +
            ' contains text that base64 does not allow, so its decoded size may be wrong.',
        );
      }
      if (part.filename !== '' && part.size > LARGE_ATTACHMENT) {
        push(
          'note',
          'A large attachment: ' + clip(part.filename, 40),
          'Message ' +
            raw.index +
            ' carries ' +
            formatBytes(part.size) +
            ', which is usually what makes an archive too big to open.',
        );
      }
    }

    const attachments = mime.parts.filter(
      (part) => part.filename !== '' || (part.disposition === 'attachment' && part.level > 0),
    );
    if (messageId !== '') {
      const list = ids.get(messageId);
      if (list === undefined) ids.set(messageId, [raw.index]);
      else list.push(raw.index);
    }

    messages.push({
      index: raw.index,
      line: raw.line,
      envelope: raw.envelope,
      envelopeSender: raw.envelope.slice(5).split(/\s+/u)[0] ?? '',
      envelopeDate: raw.envelope.slice(5).trim(),
      bytes: Math.max(0, raw.stop - raw.contentStart),
      from: fromValue,
      fromName: address.name,
      fromAddress: address.address,
      fromDomain: address.domain,
      to: toValue,
      subject: subjectValue,
      date: dateValue,
      dateIso,
      messageId,
      inReplyTo,
      flags: readFlags(headerBlock.headers),
      headers: headerBlock.headers,
      parts: mime.parts,
      text,
      textLines: countBodyLines(text),
      attachments,
      escapedLines: escaped,
      separateByBlank: raw.separatedByBlank,
    });
  }

  for (const [id, list] of ids) {
    if (list.length > 1) {
      push(
        'warning',
        'Duplicate Message-ID',
        id +
          ' appears in messages ' +
          list.join(', ') +
          '. Two copies of one message, or a broken client, both look like this.',
      );
    }
  }
  const known = new Set(ids.keys());
  for (const message of messages) {
    for (const parent of message.inReplyTo.split(/\s+/u).filter((part) => part !== '')) {
      if (!known.has(parent)) {
        push(
          'note',
          'A reply references a parent outside this archive',
          'Message ' +
            message.index +
            ' replies to ' +
            clip(parent, 60) +
            ', which is not in this file, so the thread cannot be completed here.',
        );
        break;
      }
    }
  }
  if (escapedTotal > 0) {
    push(
      'note',
      escapedTotal + ' body line(s) use mboxrd escaping',
      'Lines like ">From the desk" are stored escaped; the reader shows them as "From the desk". An archive that escapes them and one that does not look nearly identical.',
    );
  }
  if (split.crlf) {
    push(
      'note',
      'The archive uses CRLF line endings',
      'The From_ separator is still found, but a reader that expects a bare blank line may join two messages together.',
    );
  }
  if (fragileStarts > 0) {
    push(
      'note',
      fragileStarts + ' message(s) start without a blank line before them',
      'The previous message ends exactly where the next From_ line begins. Most readers cope, but this is where archives break when a body line begins with "From ".',
    );
  }
  if (split.preamble > 0) {
    const preamble = UTF8.decode(bytes.subarray(0, Math.min(split.preamble, 200))).trim();
    if (preamble !== '') {
      push(
        'note',
        'Text appears before the first From_ line',
        clip(preamble, 80) + ' — a reader ignores this preamble.',
      );
    }
  }
  if (!split.endsWithNewline) {
    push(
      'note',
      'The file does not end with a newline',
      'Some tools append their next message directly to the last line if the archive is extended.',
    );
  }
  if (nonUtf8Headers > 0) {
    push(
      'note',
      nonUtf8Headers + ' message header block(s) are not valid UTF-8',
      'The bytes were replaced while reading. A charset-aware reader may show the original text.',
    );
  }
  if (split.total > MAX_MESSAGES) {
    push(
      'note',
      'The archive holds more than ' + MAX_MESSAGES + ' messages',
      'Only the first ' + MAX_MESSAGES + ' were analyzed.',
    );
  }

  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  const notes = findings.filter((finding) => finding.level === 'note').length;
  const withDates = messages
    .filter((message) => message.dateIso !== '')
    .sort((a, b) => (a.dateIso < b.dateIso ? -1 : 1));
  const attachmentParts = messages.flatMap((message) => message.attachments);
  const attachmentBytes = attachmentParts.reduce((total, part) => total + part.size, 0);
  const senders = new Map<
    string,
    { messages: number; bytes: number; newest: string; name: string }
  >();
  for (const message of messages) {
    const key = message.fromAddress === '' ? '(no sender)' : message.fromAddress;
    const entry = senders.get(key) ?? { messages: 0, bytes: 0, newest: '', name: message.fromName };
    entry.messages += 1;
    entry.bytes += message.bytes;
    if (message.dateIso > entry.newest) entry.newest = message.dateIso;
    if (entry.name === '' && message.fromName !== '') entry.name = message.fromName;
    senders.set(key, entry);
  }

  const resultNotes: string[] = [];
  const resultWarnings: string[] = [];
  if (errors > 0) resultWarnings.push(errors + ' message(s) could not be read as mail.');
  if (split.total > MAX_MESSAGES)
    resultNotes.push(
      'Only the first ' + MAX_MESSAGES + ' of ' + split.total + ' messages were analyzed.',
    );
  if (findings.length >= MAX_FINDINGS)
    resultNotes.push('Only the first ' + MAX_FINDINGS + ' findings are shown.');

  const stats: Record<string, string | number> = {
    bytes: bytes.length,
    messages: messages.length,
    attachments: attachmentParts.length,
    senders: senders.size,
    findings: findings.length,
    errors,
    warnings,
    notes,
  };

  if (format === 'messages') {
    const rows = messages
      .slice(0, MAX_ROWS)
      .map((message) => [
        String(message.index),
        clip(message.from === '' ? message.envelopeSender : message.from, 40),
        clip(message.to, 34),
        message.dateIso === ''
          ? clip(message.date, 30) || '(no date)'
          : message.dateIso.slice(0, 16).replace('T', ' '),
        clip(message.subject, 46) || '(no subject)',
        formatBytes(message.bytes),
        message.attachments.length === 0 ? '-' : String(message.attachments.length),
        message.flags === '' ? '-' : message.flags,
      ]);
    if (messages.length > rows.length)
      resultNotes.push('Only the first ' + MAX_ROWS + ' messages are listed.');
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'From', 'To', 'Date', 'Subject', 'Size', 'Attach', 'Flags'],
          rows: rows.length === 0 ? [['-', '-', '-', '-', '(no messages)', '-', '-', '-']] : rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'senders') {
    const ranked = [...senders.entries()]
      .sort((a, b) => b[1].messages - a[1].messages || (a[0] < b[0] ? -1 : 1))
      .slice(0, top);
    const rows = ranked.map(([address, entry], index) => [
      String(index + 1),
      entry.name === '' ? address : entry.name + ' <' + address + '>',
      String(entry.messages),
      formatBytes(entry.bytes),
      ((entry.messages / messages.length) * 100).toFixed(1) + '%',
      entry.newest === '' ? '-' : entry.newest.slice(0, 16).replace('T', ' '),
    ]);
    if (ranked.length < senders.size)
      resultNotes.push('Showing the top ' + ranked.length + ' of ' + senders.size + ' senders.');
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Sender', 'Messages', 'Bytes', 'Share', 'Newest'],
          rows: rows.length === 0 ? [['-', '(no senders)', '-', '-', '-', '-']] : rows,
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  if (format === 'attachments') {
    const ranked = [...attachmentParts].sort((a, b) => b.size - a.size).slice(0, top);
    const rows = ranked.map((part, index) => [
      String(index + 1),
      '#' + part.message,
      clip(part.filename, 46) || '(unnamed)',
      part.type + '/' + part.sub,
      part.encoding,
      formatBytes(part.size),
    ]);
    if (ranked.length < attachmentParts.length)
      resultNotes.push(
        'Showing the ' + ranked.length + ' largest of ' + attachmentParts.length + ' attachments.',
      );
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'Message', 'Filename', 'Type', 'Encoding', 'Size'],
          rows: rows.length === 0 ? [['-', '-', '(no attachments)', '-', '-', '-']] : rows,
        }),
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
              ? [
                  [
                    'ok',
                    'Nothing to flag',
                    'Every message has the headers a reader needs and no archive-level problem was found.',
                  ],
                ]
              : findings.map((finding) => [finding.level, finding.problem, finding.detail]),
        }),
        render: 'table',
      },
      notes: resultNotes,
      warnings: resultWarnings,
      stats,
    };
  }

  const subjectCounts = new Map<string, number>();
  for (const message of messages) {
    const base = message.subject
      .replace(/^(re|fwd?|aw|sv):\s*/iu, '')
      .trim()
      .toLowerCase();
    if (base !== '') subjectCounts.set(base, (subjectCounts.get(base) ?? 0) + 1);
  }
  const threads = [...subjectCounts.values()].filter((count) => count > 1).length;
  const summaryRows: string[][] = [
    ['Source', sourceLabel],
    ['Bytes', formatBytes(bytes.length) + ' (' + bytes.length + ')'],
    ['Messages', String(messages.length)],
    [
      'Preamble',
      split.preamble === 0 ? 'none' : formatBytes(split.preamble) + ' before the first message',
    ],
    ['Line endings', split.crlf ? 'CRLF' : 'LF'],
    [
      'Date range',
      withDates.length === 0
        ? 'no message carries a parseable date'
        : (withDates[0]?.dateIso.slice(0, 10) ?? '') +
          ' to ' +
          (withDates[withDates.length - 1]?.dateIso.slice(0, 10) ?? ''),
    ],
    ['Unique senders', String(senders.size)],
    ['Unique Message-IDs', String(ids.size)],
    [
      'Subject threads',
      threads === 0
        ? 'none with a shared subject'
        : String(threads) + ' subject(s) used more than once',
    ],
    [
      'Messages with attachments',
      String(messages.filter((message) => message.attachments.length > 0).length),
    ],
    [
      'Attachments',
      attachmentParts.length === 0
        ? 'none'
        : attachmentParts.length + ' (' + formatBytes(attachmentBytes) + ')',
    ],
    [
      'Largest message',
      formatBytes(messages.reduce((largest, message) => Math.max(largest, message.bytes), 0)),
    ],
    [
      'Body text',
      formatBytes(
        messages.reduce((total, message) => total + ENCODER.encode(message.text).length, 0),
      ) +
        ' in ' +
        messages.reduce((total, message) => total + message.textLines, 0) +
        ' lines',
    ],
    ['Escaped From_ lines', String(escapedTotal)],
    [
      'Flagged as read',
      String(messages.filter((message) => message.flags.includes('read')).length) +
        ' read, ' +
        String(messages.filter((message) => message.flags.includes('answered')).length) +
        ' answered',
    ],
    ['Findings', errors + ' error, ' + warnings + ' warning, ' + notes + ' note'],
  ];
  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Item', 'Value'], rows: summaryRows }),
      render: 'table',
    },
    notes: resultNotes,
    warnings: resultWarnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
