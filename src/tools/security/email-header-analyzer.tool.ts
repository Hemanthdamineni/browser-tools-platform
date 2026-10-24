import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './email-header-analyzer.meta';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_HEADERS = 2000;
const MAX_DETAIL = 300;

interface Header {
  name: string;
  value: string;
}

interface Address {
  role: string;
  name: string;
  address: string;
}

interface Hop {
  from: string;
  by: string;
  protocol: string;
  id: string;
  recipient: string;
  time: number | null;
}

interface AuthRow {
  mechanism: string;
  result: string;
  source: string;
  detail: string;
}

const FAILING = new Set(['fail', 'softfail', 'hardfail', 'permerror', 'temperror', 'policy', 'reject', 'quarantine']);
const VERDICTS = new Set(['pass', 'fail', 'neutral', 'none', 'softfail', 'temperror', 'permerror', 'policy', 'hardfail', 'quarantine', 'reject']);

const ADDRESS_HEADERS = ['from', 'sender', 'reply-to', 'return-path', 'to', 'cc', 'bcc', 'delivered-to', 'errors-to'];

function parseHeaderBlock(text: string): { headers: Header[]; bodyLines: number; quoted: boolean } {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const headers: Header[] = [];
  let current: Header | null = null;
  let bodyLines = 0;
  let inBody = false;
  let quoted = false;

  for (const rawLine of lines) {
    // Forwarded headers often arrive prefixed with ">". Strip the quote marker,
    // then decide whether what remains is a new header or a folded continuation.
    const quotePrefix = /^[ \t]*>+[ \t]?/u;
    const hadQuote = quotePrefix.test(rawLine);
    if (hadQuote) quoted = true;
    const content = rawLine.replace(quotePrefix, '');
    const looksLikeHeader = /^[!-9;-~]+:/u.test(content.trim());
    const isContinuation = !looksLikeHeader && (hadQuote || /^[ \t]/u.test(rawLine));

    if (inBody) {
      if (content.trim() !== '') bodyLines += 1;
      continue;
    }
    if (current !== null && isContinuation) {
      current.value = (current.value + ' ' + content.trim()).trim();
      continue;
    }
    if (content.trim() === '') {
      if (headers.length > 0) inBody = true;
      continue;
    }
    const match = /^([!-9;-~]+):[ \t]?([\s\S]*)$/u.exec(content.trim());
    if (match === null) {
      inBody = true;
      bodyLines += 1;
      continue;
    }
    current = { name: (match[1] ?? '').toLowerCase(), value: (match[2] ?? '').trim() };
    headers.push(current);
  }
  return { headers, bodyLines, quoted };
}

function bytesToString(bytes: Uint8Array, charset: string): string {
  const label = charset.trim().toLowerCase();
  const normalized =
    label === '' || label === 'us-ascii' || label === 'ascii' || label === 'utf8'
      ? 'utf-8'
      : label === 'latin1'
        ? 'iso-8859-1'
        : label;
  try {
    return new TextDecoder(normalized).decode(bytes);
  } catch {
    return new TextDecoder('iso-8859-1').decode(bytes);
  }
}

function decodeWord(charset: string, encoding: string, payload: string): string | null {
  try {
    if (encoding.toUpperCase() === 'B') {
      const binary = atob(payload.replace(/\s+/gu, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytesToString(bytes, charset);
    }
    const bytes: number[] = [];
    const text = payload.replace(/_/gu, ' ');
    for (let i = 0; i < text.length; i += 1) {
      const character = text.charAt(i);
      if (character === '=' && /^[0-9a-f]{2}$/iu.test(text.slice(i + 1, i + 3))) {
        bytes.push(Number.parseInt(text.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(character.charCodeAt(0) & 0xff);
      }
    }
    return bytesToString(new Uint8Array(bytes), charset);
  } catch {
    return null;
  }
}

/** Decode RFC 2047 encoded-words; whitespace between two of them is dropped. */
function decodeEncodedWords(value: string, enabled: boolean): string {
  if (!enabled) return value;
  const re = /=\?([^?\s]+)\?([bBqQ])\?([^?]*)\?=/gu;
  let out = '';
  let lastIndex = 0;
  let previousWasWord = false;
  let match = re.exec(value);

  while (match !== null) {
    const between = value.slice(lastIndex, match.index);
    const decoded = decodeWord(match[1] ?? '', match[2] ?? 'B', match[3] ?? '');
    if (decoded === null) {
      out += between + match[0];
      previousWasWord = false;
    } else {
      if (!(previousWasWord && between.trim() === '')) out += between;
      out += decoded;
      previousWasWord = true;
    }
    lastIndex = re.lastIndex;
    match = re.exec(value);
  }
  return out + value.slice(lastIndex);
}

function splitAddressList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (!quoted) {
      if (character === '<' || character === '(') depth += 1;
      else if (character === '>' || character === ')') depth = Math.max(0, depth - 1);
      else if ((character === ',' || character === ';') && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += character;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

function parseAddresses(value: string): { name: string; address: string }[] {
  const out: { name: string; address: string }[] = [];
  for (const part of splitAddressList(value)) {
    const angled = /^([\s\S]*)<([^>]+)>\s*$/u.exec(part);
    if (angled !== null) {
      const name = (angled[1] ?? '').trim().replace(/^"|"$/gu, '').trim();
      const address = (angled[2] ?? '').trim();
      if (/^[^\s@]+@[^\s@]+$/u.test(address)) out.push({ name, address });
      continue;
    }
    const bare = part.replace(/^"|"$/gu, '').trim();
    if (/^[^\s@]+@[^\s@]+$/u.test(bare)) out.push({ name: '', address: bare });
  }
  return out;
}

function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  return at === -1 ? '' : address.slice(at + 1).replace(/[>.,;]+$/u, '').toLowerCase();
}

function parseHop(value: string): Hop {
  const text = value.replace(/\s+/gu, ' ').trim();
  const semi = text.lastIndexOf(';');
  const stamp = semi === -1 ? NaN : Date.parse(text.slice(semi + 1).trim());
  const from = /\bfrom\s+([^\s;(]+)/iu.exec(text);
  const ip = /\[([0-9a-f:.]{3,45})\]/iu.exec(text);
  const by = /\bby\s+([^\s;(]+)/iu.exec(text);
  const protocol = /\bwith\s+([^\s;]+)/iu.exec(text);
  const id = /\bid\s+([^\s;]+)/iu.exec(text);
  const recipient = /\bfor\s+<?([^\s;>]+)/iu.exec(text);
  return {
    from: (from?.[1] ?? '') + (ip === null ? '' : ' [' + (ip[1] ?? '') + ']'),
    by: by?.[1] ?? '',
    protocol: protocol?.[1] ?? '',
    id: id?.[1] ?? '',
    recipient: recipient?.[1] ?? '',
    time: Number.isNaN(stamp) ? null : stamp,
  };
}

function parseAuthHeader(name: string, value: string): AuthRow[] {
  const text = value.replace(/\s+/gu, ' ').trim();
  if (name === 'received-spf') {
    const result = (/^([a-z]+)/iu.exec(text)?.[1] ?? '').toLowerCase();
    return [{ mechanism: 'spf', result, source: 'Received-SPF', detail: text.slice(0, MAX_DETAIL) }];
  }

  const segments = text
    .split(';')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');
  if (name === 'arc-authentication-results' && /^i=\d+$/iu.test(segments[0] ?? '')) segments.shift();

  const source = segments[0] ?? '';
  const rows: AuthRow[] = [];
  for (const segment of segments.slice(1)) {
    const pair = /^([a-z][a-z0-9-]*)\s*=\s*([a-z][a-z0-9]*)/iu.exec(segment);
    if (pair === null) continue;
    const mechanism = (pair[1] ?? '').toLowerCase();
    const result = (pair[2] ?? '').toLowerCase();
    if (!VERDICTS.has(result)) continue;
    rows.push({
      mechanism,
      result,
      source,
      detail: segment.slice(pair[0].length).trim().slice(0, MAX_DETAIL),
    });
  }
  return rows;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'n/a';
  const sign = seconds < 0 ? '-' : '';
  const total = Math.round(Math.abs(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return sign + hours + 'h ' + minutes + 'm ' + secs + 's';
  if (minutes > 0) return sign + minutes + 'm ' + secs + 's';
  return sign + secs + 's';
}

const clip = (value: string): string =>
  value.length > MAX_DETAIL ? value.slice(0, MAX_DETAIL - 1) + '…' : value;

const iso = (time: number | null): string => (time === null ? 'n/a' : new Date(time).toISOString());

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = String(o.format ?? 'overview');
  const decodeWords = o.decodeWords !== false;

  const file = input.files[0];
  let text: string;
  if (file !== undefined) {
    if (file.size === 0) throw new ToolError('That file is empty.');
    if (file.size > MAX_BYTES) throw new ToolError('That file is larger than 5 MB.', 'Paste just the header block.');
    text = await file.text();
  } else {
    text = String(input.text ?? '');
  }
  if (text.trim() === '') {
    throw new ToolError('No email headers found.', 'Paste a message header block, or drop an .eml file.');
  }
  if (text.length > MAX_BYTES) {
    throw new ToolError('That is more than 5 MB of headers.', 'Paste just the header block.');
  }

  const parsed = parseHeaderBlock(text);
  let headers = parsed.headers;
  const notes: string[] = [];
  const warnings: string[] = [];

  if (headers.length === 0) {
    throw new ToolError(
      'No email headers found.',
      'The text does not start with any "Name: value" lines.',
    );
  }
  if (headers.length > MAX_HEADERS) {
    notes.push('Only the first ' + MAX_HEADERS + ' headers were read (' + headers.length + ' present).');
    headers = headers.slice(0, MAX_HEADERS);
  }

  const valuesOf = (name: string): string[] =>
    headers.filter((header) => header.name === name).map((header) => header.value);
  const firstOf = (name: string): string => valuesOf(name)[0] ?? '';
  const show = (value: string): string => decodeEncodedWords(value, decodeWords);

  const received = valuesOf('received');
  const hops = received.map((value) => parseHop(value));
  const chronological = [...hops].reverse();

  const authRows: AuthRow[] = [];
  for (const header of headers) {
    if (
      header.name === 'authentication-results' ||
      header.name === 'arc-authentication-results' ||
      header.name === 'received-spf'
    ) {
      authRows.push(...parseAuthHeader(header.name, header.value));
    }
  }
  const authFailures = authRows.filter((row) => FAILING.has(row.result));

  const addresses: Address[] = [];
  for (const name of ADDRESS_HEADERS) {
    for (const value of valuesOf(name)) {
      for (const entry of parseAddresses(value)) {
        addresses.push({ role: name, name: show(entry.name), address: entry.address });
      }
    }
  }
  const addressDomains = new Map<string, string>();
  for (const entry of addresses) {
    if (!addressDomains.has(entry.address)) addressDomains.set(entry.address, domainOf(entry.address));
  }

  const fromDomain = domainOf(parseAddresses(firstOf('from'))[0]?.address ?? '');
  const returnDomain = domainOf(parseAddresses(firstOf('return-path'))[0]?.address ?? '');
  const replyDomain = domainOf(parseAddresses(firstOf('reply-to'))[0]?.address ?? '');

  const dateRaw = firstOf('date');
  const dateValue = dateRaw === '' ? NaN : Date.parse(dateRaw);
  const firstHopTime = chronological.find((hop) => hop.time !== null)?.time ?? null;
  const lastHopTime = [...chronological].reverse().find((hop) => hop.time !== null)?.time ?? null;
  const transit =
    firstHopTime !== null && lastHopTime !== null ? (lastHopTime - firstHopTime) / 1000 : null;

  /* ------------------------------- diagnostics ------------------------------ */

  for (const row of authFailures) {
    warnings.push(row.mechanism.toUpperCase() + ' reported "' + row.result + '" from ' + (row.source || 'an unnamed server') + '.');
  }
  if (fromDomain !== '' && returnDomain !== '' && fromDomain !== returnDomain) {
    warnings.push('From domain (' + fromDomain + ') differs from Return-Path domain (' + returnDomain + '); this is normal for mailing lists but also common in spoofing.');
  }
  if (dateRaw !== '' && Number.isNaN(dateValue)) {
    warnings.push('The Date header could not be parsed as a date.');
  }
  for (let i = 1; i < chronological.length; i += 1) {
    const previous = chronological[i - 1]?.time ?? null;
    const current = chronological[i]?.time ?? null;
    if (previous !== null && current !== null && current < previous) {
      warnings.push(
        'Hop ' + (i + 1) + ' is timestamped before hop ' + i + ', so a clock is out of step or the chain was altered.',
      );
    }
  }
  const spamFlag = firstOf('x-spam-flag');
  if (/^yes/iu.test(spamFlag)) warnings.push('X-Spam-Flag says this message was classified as spam.');

  const knownMailHeaders = headers.some((header) =>
    ['from', 'to', 'subject', 'date', 'received', 'return-path'].includes(header.name),
  );
  if (!knownMailHeaders) {
    warnings.push('No From, To, Subject, Date or Received header was found, so this may not be an email.');
  }

  if (parsed.quoted) notes.push('Lines beginning with ">" were unquoted before reading.');
  if (parsed.bodyLines > 0) {
    notes.push('Body content after the blank line was ignored (' + parsed.bodyLines + ' non-empty line(s)).');
  }
  if (authRows.length === 0) notes.push('No Authentication-Results, ARC-Authentication-Results or Received-SPF header was present.');
  if (hops.length > 1) notes.push('Received headers are listed newest first; the hop table is in delivery order, oldest first.');
  if (replyDomain !== '' && fromDomain !== '' && replyDomain !== fromDomain) {
    notes.push('Reply-To uses ' + replyDomain + ' while From uses ' + fromDomain + '.');
  }

  const stats: Record<string, string | number> = {
    headers: headers.length,
    hops: hops.length,
    addresses: addresses.length,
    authChecks: authRows.length,
    authFailures: authFailures.length,
    transit: transit === null ? 'n/a' : formatDuration(transit),
  };

  /* ---------------------------------- views -------------------------------- */

  if (format === 'hops') {
    const rows = chronological.map((hop, index) => {
      const previous = index === 0 ? null : (chronological[index - 1]?.time ?? null);
      const delay =
        previous === null || hop.time === null ? (index === 0 ? '-' : 'n/a') : formatDuration((hop.time - previous) / 1000);
      return [
        String(index + 1),
        hop.from || 'n/a',
        hop.by || 'n/a',
        hop.protocol || 'n/a',
        iso(hop.time),
        delay,
      ];
    });
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['#', 'From', 'By', 'Protocol', 'Timestamp', 'Delay'],
          rows,
        }),
        render: 'table',
      },
      notes,
      warnings,
      stats,
    };
  }

  if (format === 'auth') {
    const rows =
      authRows.length === 0
        ? [['-', 'none', '-', 'No authentication results were found in these headers.']]
        : authRows.map((row) => [row.mechanism, row.result, row.source || 'n/a', row.detail]);
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['Mechanism', 'Result', 'Source', 'Detail'], rows }),
        render: 'table',
      },
      notes,
      warnings,
      stats,
    };
  }

  if (format === 'addresses') {
    const seen = new Set<string>();
    const rows: string[][] = [];
    for (const entry of addresses) {
      const key = entry.role + '|' + entry.address;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push([entry.role, entry.name, entry.address, domainOf(entry.address)]);
    }
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['Header', 'Name', 'Address', 'Domain'], rows }),
        render: 'table',
      },
      notes,
      warnings,
      stats,
    };
  }

  if (format === 'raw') {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({
          headers: ['Header', 'Value'],
          rows: headers.map((header) => [header.name, clip(header.value)]),
        }),
        render: 'table',
      },
      notes,
      warnings,
      stats,
    };
  }

  const authSummary =
    authRows.length === 0
      ? 'none found'
      : [...new Set(authRows.map((row) => row.mechanism.toUpperCase() + ' ' + row.result))].join(', ');

  const rows: string[][] = [
    ['From', show(firstOf('from')) || 'n/a'],
    ['To', show(firstOf('to')) || 'n/a'],
  ];
  if (firstOf('cc') !== '') rows.push(['Cc', show(firstOf('cc'))]);
  if (firstOf('reply-to') !== '') rows.push(['Reply-To', show(firstOf('reply-to'))]);
  if (firstOf('return-path') !== '') rows.push(['Return-Path', show(firstOf('return-path'))]);
  rows.push(['Subject', show(firstOf('subject')) || 'n/a']);
  rows.push(['Date', Number.isNaN(dateValue) ? dateRaw || 'n/a' : new Date(dateValue).toISOString()]);
  rows.push(['Message-ID', firstOf('message-id') || 'n/a']);
  rows.push(['Headers', String(headers.length)]);
  rows.push(['Received hops', String(hops.length)]);
  if (firstHopTime !== null) rows.push(['First hop', iso(firstHopTime)]);
  if (lastHopTime !== null) rows.push(['Last hop', iso(lastHopTime)]);
  rows.push(['Transit time', transit === null ? 'n/a' : formatDuration(transit)]);
  if (!Number.isNaN(dateValue) && lastHopTime !== null) {
    rows.push(['Date vs last hop', formatDuration((dateValue - lastHopTime) / 1000)]);
  }
  rows.push(['Authentication', authSummary]);
  if (firstOf('x-spam-score') !== '') rows.push(['Spam score', firstOf('x-spam-score')]);
  else if (firstOf('x-spam-status') !== '') rows.push(['Spam score', clip(firstOf('x-spam-status'))]);
  if (spamFlag !== '') rows.push(['Spam flag', spamFlag]);
  if (firstOf('x-ms-exchange-organization-scl') !== '') {
    rows.push(['Spam confidence level', firstOf('x-ms-exchange-organization-scl')]);
  }
  rows.push(['Distinct domains', String(new Set([...addressDomains.values()].filter((d) => d !== '')).size)]);

  return {
    outputs: [],
    report: {
      output: JSON.stringify({ headers: ['Item', 'Value'], rows }),
      render: 'table',
    },
    notes,
    warnings,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
