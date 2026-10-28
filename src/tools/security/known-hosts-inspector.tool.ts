import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './known-hosts-inspector.meta';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAX_BYTES = 8 * 1024 * 1024;

function base64Decode(s: string): Uint8Array<ArrayBufferLike> {
  const clean = s.replace(/\s+/g, '');
  if (!clean || clean.length % 4 === 1) throw new ToolError('Unrecognized base64 key data.');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    if (ch === '=') break;
    const v = B64.indexOf(ch);
    if (v === -1) throw new ToolError('The key contains characters outside the base64 alphabet.');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function base64Encode(bytes: Uint8Array, pad = false): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? (pad ? '=' : '') : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? (pad ? '=' : '') : B64[c & 63];
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function hexBytesToColon(s: string): string {
  return s.replace(/(..)(?=.)/g, '$1:');
}

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_K: number[] = [];
for (let i = 0; i < 64; i++) MD5_K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);

function md5(input: Uint8Array): string {
  const len = input.length;
  const bitLenLo = ((len * 8) % 4294967296) >>> 0;
  const bitLenHi = Math.floor((len * 8) / 4294967296) >>> 0;
  const paddedLen = (((len + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLen);
  msg.set(input);
  msg[len] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(paddedLen - 8, bitLenLo, true);
  view.setUint32(paddedLen - 4, bitLenHi, true);
  let A0 = 0x67452301,
    B0 = 0xefcdab89,
    C0 = 0x98badcfe,
    D0 = 0x10325476;
  const work = new DataView(msg.buffer);
  for (let off = 0; off < paddedLen; off += 64) {
    let A = A0,
      B = B0,
      C = C0,
      D = D0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + MD5_K[i]! + work.getUint32(off + g * 4, true)) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << MD5_S[i]!) | (F >>> (32 - MD5_S[i]!)))) >>> 0;
    }
    A0 = (A0 + A) >>> 0;
    B0 = (B0 + B) >>> 0;
    C0 = (C0 + C) >>> 0;
    D0 = (D0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  new DataView(out.buffer).setUint32(0, A0, true);
  new DataView(out.buffer).setUint32(4, B0, true);
  new DataView(out.buffer).setUint32(8, C0, true);
  new DataView(out.buffer).setUint32(12, D0, true);
  return toHex(out);
}

function readU32(b: Uint8Array, off: number): number {
  if (off + 4 > b.length) throw new ToolError('Malformed SSH key blob.');
  return ((b[off]! << 24) | (b[off + 1]! << 16) | (b[off + 2]! << 8) | b[off + 3]!) >>> 0;
}

function readString(b: Uint8Array, off: number): { value: Uint8Array; next: number } {
  const len = readU32(b, off);
  const start = off + 4;
  if (len + start > b.length) throw new ToolError('Malformed SSH key blob.');
  return { value: b.subarray(start, start + len), next: start + len };
}

function parseBlob(blob: Uint8Array): { type: string; bits: number | null } {
  const typeStr = readString(blob, 0).value;
  const type = new TextDecoder().decode(typeStr);
  let cursor = 4 + typeStr.length;
  let bits: number | null = null;
  try {
    if (type === 'ssh-rsa') {
      const e = readString(blob, cursor);
      cursor = e.next;
      const n = readString(blob, cursor);
      bits = bigIntBits(n.value);
    } else if (type === 'ssh-ed25519') {
      bits = 256;
    } else if (type === 'ssh-dss') {
      const p = readString(blob, cursor);
      bits = bigIntBits(p.value);
    } else if (type.startsWith('ecdsa-sha2-')) {
      const curve = readString(blob, cursor).value;
      const name = new TextDecoder().decode(curve);
      cursor += 4 + curve.length;
      readString(blob, cursor);
      bits = name.includes('384') ? 384 : name.includes('521') ? 521 : 256;
    } else if (type.startsWith('sk-ecdsa-sha2-')) {
      readString(blob, cursor);
      cursor += 4;
      const curve = readString(blob, cursor).value;
      readString(blob, cursor);
      bits = new TextDecoder().decode(curve).includes('384') ? 384 : 256;
    }
  } catch {
    /* parse issues are ignored for bit size; type is authoritative */
  }
  return { type, bits };
}

function bigIntBits(bytes: Uint8Array): number {
  let start = 0;
  while (start < bytes.length && bytes[start] === 0) start++;
  const remaining = bytes.length - start;
  if (remaining === 0) return 0;
  let lead = 0;
  let x = bytes[start]!;
  while (x < 128) {
    x <<= 1;
    lead++;
  }
  return remaining * 8 - lead;
}

async function sha256Digest(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return base64Encode(new Uint8Array(hash));
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, message as BufferSource);
  return base64Encode(new Uint8Array(sig));
}

function globMatch(pattern: string, host: string): boolean {
  if (pattern === host) return true;
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`, 'i').test(host);
}

function parseHostPattern(rawPattern: string): { patterns: string[]; isNegation: boolean; hasPort: boolean; original: string } {
  const isNegation = rawPattern.startsWith('!');
  const pattern = isNegation ? rawPattern.slice(1) : rawPattern;
  let hasPort = false;
  let patterns: string[] = [];

  if (pattern.startsWith('[')) {
    const closeBracket = pattern.indexOf(']');
    if (closeBracket > 0) {
      const hostPart = pattern.slice(1, closeBracket);
      const rest = pattern.slice(closeBracket + 1);
      if (rest.startsWith(':')) {
        hasPort = true;
      }
      patterns = hostPart.split(',');
    } else {
      patterns = [pattern];
    }
  } else {
    patterns = pattern.split(',');
  }

  return { patterns, isNegation, hasPort, original: rawPattern };
}

interface ParsedEntry {
  lineNumber: number;
  rawLine: string;
  isHashed: boolean;
  hostPattern: string;
  keyType: string;
  keyBlob: Uint8Array;
  keyB64: string;
  comment: string;
  sha256Fp: string;
  md5Fp: string;
  bits: number | null;
  isNegation: boolean;
  isWildcard: boolean;
  malformed: boolean;
  malformedReason?: string;
}

async function parseKnownHosts(text: string): Promise<{
  entries: ParsedEntry[];
  findings: { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[];
}> {
  const entries: ParsedEntry[] = [];
  const findings: { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[] = [];
  const lines = text.split(/\r?\n/u);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const lineNumber = i + 1;
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    const hostPattern = parts[0] ?? '';
    const keyType = parts[1] ?? '';
    const keyB64 = parts[2] ?? '';
    const comment = parts.slice(3).join(' ');

    if (parts.length < 3) {
      entries.push({
        lineNumber,
        rawLine,
        isHashed: false,
        hostPattern,
        keyType,
        keyBlob: new Uint8Array(0),
        keyB64,
        comment,
        sha256Fp: '',
        md5Fp: '',
        bits: null,
        isNegation: false,
        isWildcard: false,
        malformed: true,
        malformedReason: 'Too few fields (expected: hostpattern keytype base64blob)',
      });
      findings.push({
        kind: 'malformed-line',
        severity: 'error',
        detail: `Line ${lineNumber}: Too few fields — expected "hostpattern keytype base64blob"`,
      });
      continue;
    }

    const parsedPattern = parseHostPattern(hostPattern);
    const isHashed = hostPattern.startsWith('|1|');
    let keyBlob = new Uint8Array(0);
    let sha256Fp = '';
    let md5Fp = '';
    let bits: number | null = null;
    let malformed = false;
    let malformedReason = '';

    try {
      keyBlob = base64Decode(keyB64);
      sha256Fp = `SHA256:${await sha256Digest(keyBlob)}`;
      md5Fp = `MD5:${hexBytesToColon(md5(keyBlob))}`;
      const parsed = parseBlob(keyBlob);
      bits = parsed.bits;
      if (parsed.type !== keyType) {
        findings.push({
          kind: 'key-type-mismatch',
          severity: 'warn',
          detail: `Line ${lineNumber}: column says "${keyType}" but the blob encodes "${parsed.type}".`,
        });
      }
    } catch (e) {
      malformed = true;
      malformedReason = e instanceof Error ? e.message : 'Failed to parse key blob';
      keyBlob = new Uint8Array(0);
      findings.push({
        kind: 'malformed-line',
        severity: 'error',
        detail: `Line ${lineNumber}: ${malformedReason}`,
      });
    }

    const isWildcard = parsedPattern.patterns.some((p) => p.includes('*') || p.includes('?'));

    if (isHashed) {
      findings.push({
        kind: 'hashed-entry',
        severity: 'info',
        detail: `Line ${lineNumber}: Hashed host entry (|1|salt|hash|)`,
      });
    }
    if (parsedPattern.isNegation) {
      findings.push({
        kind: 'negation-entry',
        severity: 'info',
        detail: `Line ${lineNumber}: Negation entry (!${parsedPattern.patterns.join(',')})`,
      });
    }
    if (isWildcard) {
      findings.push({
        kind: 'wildcard-pattern',
        severity: 'info',
        detail: `Line ${lineNumber}: Wildcard pattern (${hostPattern})`,
      });
    }

    entries.push({
      lineNumber,
      rawLine,
      isHashed,
      hostPattern,
      keyType,
      keyBlob,
      keyB64,
      comment,
      sha256Fp,
      md5Fp,
      bits,
      isNegation: parsedPattern.isNegation,
      isWildcard,
      malformed,
      malformedReason: malformed ? malformedReason : undefined,
    });
  }

  return { entries, findings };
}

function computeHostKeyChanges(entries: ParsedEntry[]): { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[] {
  const findings: { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[] = [];
  const hostToFingerprints = new Map<string, Set<string>>();

  for (const entry of entries) {
    if (entry.malformed || entry.isHashed || entry.isNegation) continue;
    const patterns = parseHostPattern(entry.hostPattern).patterns;
    for (const pattern of patterns) {
      if (!hostToFingerprints.has(pattern)) {
        hostToFingerprints.set(pattern, new Set());
      }
      hostToFingerprints.get(pattern)!.add(entry.sha256Fp);
    }
  }

  for (const [host, fps] of hostToFingerprints) {
    if (fps.size > 1) {
      findings.push({
        kind: 'host-key-change',
        severity: 'warn',
        detail: `Host "${host}" has ${fps.size} different keys: ${Array.from(fps).map((f) => f.slice(0, 43)).join(', ')}`,
      });
    }
  }

  return findings;
}

function computeDuplicateKeys(entries: ParsedEntry[]): { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[] {
  const findings: { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[] = [];
  const seen = new Map<string, number[]>();
  for (const entry of entries) {
    if (entry.malformed || entry.isNegation) continue;
    const key = entry.sha256Fp + '|' + entry.hostPattern;
    const lines = seen.get(key) ?? [];
    lines.push(entry.lineNumber);
    seen.set(key, lines);
  }
  for (const [key, lines] of seen) {
    if (lines.length > 1) {
      findings.push({
        kind: 'duplicate-key',
        severity: 'info',
        detail:
          'The same key is listed ' + lines.length + 'x for ' + key.split('|')[1] + ': lines ' + lines.join(', ') + '.',
      });
    }
  }
  return findings;
}

function computeKeyReuse(entries: ParsedEntry[]): { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[] {
  const findings: { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[] = [];
  const keyToHosts = new Map<string, Set<string>>();

  for (const entry of entries) {
    if (entry.malformed || entry.isNegation) continue;
    const patterns = parseHostPattern(entry.hostPattern).patterns;
    for (const pattern of patterns) {
      if (!keyToHosts.has(entry.sha256Fp)) {
        keyToHosts.set(entry.sha256Fp, new Set());
      }
      keyToHosts.get(entry.sha256Fp)!.add(pattern);
    }
  }

  for (const [fp, hosts] of keyToHosts) {
    if (hosts.size > 10) {
      findings.push({
        kind: 'key-reused-widely',
        severity: 'warn',
        detail: `Key ${fp.slice(0, 43)} used for ${hosts.size} host patterns: ${Array.from(hosts).slice(0, 5).join(', ')}${hosts.size > 5 ? '...' : ''}`,
      });
    }
  }

  return findings;
}

async function resolveHashedEntry(hostPattern: string, targetHost: string): Promise<boolean> {
  if (!hostPattern.startsWith('|1|')) return false;
  const parts = hostPattern.split('|');
  if (parts.length < 4) return false;
  const saltB64 = parts[2] ?? '';
  const hashB64 = parts[3] ?? '';
  try {
    const salt = base64Decode(saltB64);
    const computedHash = await hmacSha1(salt, new TextEncoder().encode(targetHost));
    const stored = base64Decode(hashB64);
    return computedHash === base64Encode(stored);
  } catch {
    return false;
  }
}

function matchesHost(entry: ParsedEntry, targetHost: string): boolean {
  if (entry.isNegation) return false;
  if (entry.malformed) return false;

  if (entry.isHashed) {
    return false;
  }

  const { patterns } = parseHostPattern(entry.hostPattern);
  return patterns.some((p) => globMatch(p, targetHost));
}

function formatSummary(
  entries: ParsedEntry[],
  findings: { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[]
): { headers: string[]; rows: string[][] } {
  const total = entries.length;
  const plaintext = entries.filter((e) => !e.isHashed && !e.malformed).length;
  const hashed = entries.filter((e) => e.isHashed).length;
  const malformed = entries.filter((e) => e.malformed).length;
  const negations = entries.filter((e) => e.isNegation).length;
  const wildcards = entries.filter((e) => e.isWildcard).length;
  const uniqueKeys = new Set(entries.filter((e) => !e.malformed).map((e) => e.sha256Fp)).size;
  const hostKeyChanges = findings.filter((f) => f.kind === 'host-key-change').length;
  const keyReuse = findings.filter((f) => f.kind === 'key-reused-widely').length;

  return {
    headers: ['Metric', 'Count'],
    rows: [
      ['Total entries', String(total)],
      ['Plaintext entries', String(plaintext)],
      ['Hashed entries (|1|)', String(hashed)],
      ['Malformed lines', String(malformed)],
      ['Negation entries (!)', String(negations)],
      ['Wildcard patterns', String(wildcards)],
      ['Unique host keys', String(uniqueKeys)],
      ['Host-key change findings', String(hostKeyChanges)],
      ['Key reused widely findings', String(keyReuse)],
      ['Total findings', String(findings.length)],
    ],
  };
}

function formatEntries(entries: ParsedEntry[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Line', 'Type', 'Host Pattern / Hash', 'Key Type', 'SHA256 Fingerprint', 'MD5 Fingerprint', 'Bits', 'Comment'],
    rows: entries.map((e) => [
      String(e.lineNumber),
      e.isHashed ? 'Hashed (|1|)' : e.isNegation ? 'Negation (!)' : e.malformed ? 'Malformed' : 'Plaintext',
      e.isHashed ? e.hostPattern.slice(0, 60) + (e.hostPattern.length > 60 ? '...' : '') : e.hostPattern,
      e.keyType,
      e.sha256Fp || '—',
      e.md5Fp || '—',
      e.bits !== null ? String(e.bits) : '—',
      e.comment || '—',
    ]),
  };
}

function formatKeys(entries: ParsedEntry[]): { headers: string[]; rows: string[][] } {
  const keyMap = new Map<
    string,
    { type: string; bits: number | null; hosts: Set<string>; sampleB64: string }
  >();

  for (const e of entries) {
    if (e.malformed || e.isNegation) continue;
    const patterns = parseHostPattern(e.hostPattern).patterns;
    const key = e.sha256Fp;
    if (!keyMap.has(key)) {
      keyMap.set(key, { type: e.keyType, bits: e.bits, hosts: new Set(), sampleB64: e.keyB64 });
    }
    for (const p of patterns) {
      keyMap.get(key)!.hosts.add(p);
    }
  }

  return {
    headers: ['SHA256 Fingerprint', 'Key Type', 'Bits', 'Host Count', 'Host Patterns'],
    rows: Array.from(keyMap.entries())
      .sort((a, b) => b[1].hosts.size - a[1].hosts.size)
      .map(([fp, info]) => [
        fp,
        info.type,
        info.bits !== null ? String(info.bits) : '—',
        String(info.hosts.size),
        Array.from(info.hosts).slice(0, 5).join(', ') + (info.hosts.size > 5 ? '...' : ''),
      ]),
  };
}

async function formatLookup(
  entries: ParsedEntry[],
  targetHost: string
): Promise<{ headers: string[]; rows: string[][] }> {
  if (!targetHost) {
    return {
      headers: ['Message'],
      rows: [['Enter a hostname in the "Hostname to resolve" option to see matching entries.']],
    };
  }

  const matches: ParsedEntry[] = [];

  for (const e of entries) {
    if (e.malformed || e.isNegation) continue;
    if (e.isHashed) {
      const matchesHash = await resolveHashedEntry(e.hostPattern, targetHost);
      if (matchesHash) matches.push(e);
    } else if (matchesHost(e, targetHost)) {
      matches.push(e);
    }
  }

  if (matches.length === 0) {
    return {
      headers: ['Result'],
      rows: [[`No entries match "${targetHost}".`]],
    };
  }

  return {
    headers: ['Line', 'Type', 'Host Pattern / Hash', 'Key Type', 'SHA256 Fingerprint', 'Bits'],
    rows: matches.map((e) => [
      String(e.lineNumber),
      e.isHashed ? 'Hashed (|1|)' : 'Plaintext',
      e.isHashed ? e.hostPattern.slice(0, 60) + (e.hostPattern.length > 60 ? '...' : '') : e.hostPattern,
      e.keyType,
      e.sha256Fp || '—',
      e.bits !== null ? String(e.bits) : '—',
    ]),
  };
}

function formatFindings(
  findings: { kind: string; severity: 'error' | 'warn' | 'info'; detail: string }[]
): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Kind', 'Severity', 'Detail'],
    rows: findings.map((f) => [f.kind, f.severity.toUpperCase(), f.detail]),
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const host = String(options.host ?? '').trim();
  const warnings: string[] = [];

  const source = (input.files ?? [])[0];
  let text: string;
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES)
      throw new ToolError(
        'That file is larger than 8 MB.',
        'A known_hosts file is normally a few kilobytes.',
      );
    text = new TextDecoder('utf-8', { fatal: false }).decode(
      new Uint8Array(await source.arrayBuffer()),
    );
  } else {
    text = String(input.text ?? '');
  }
  if (!text.trim()) {
    return {
      outputs: [],
      report: {
        output: JSON.stringify({ headers: ['Message'], rows: [['Paste your ~/.ssh/known_hosts file to analyze it.']] }),
        render: 'table',
      },
      notes: ['Paste your ~/.ssh/known_hosts file into the input area.'],
    };
  }

  const { entries, findings: initialFindings } = await parseKnownHosts(text);
  const hostKeyFindings = computeHostKeyChanges(entries);
  const keyReuseFindings = computeKeyReuse(entries);
  const duplicateFindings = computeDuplicateKeys(entries);
  const allFindings = [...initialFindings, ...hostKeyFindings, ...keyReuseFindings, ...duplicateFindings];
  let reportOutput: { headers: string[]; rows: string[][] };
  let notes: string[] = [];
  switch (format) {
    case 'summary':
      reportOutput = formatSummary(entries, allFindings);
      notes = [`Analyzed ${entries.length} entries from known_hosts file.`];
      break;
    case 'entries':
      reportOutput = formatEntries(entries);
      notes = [`${entries.length} entries parsed.`];
      break;
    case 'keys':
      reportOutput = formatKeys(entries);
      notes = [`${new Set(entries.filter((e) => !e.malformed).map((e) => e.sha256Fp)).size} unique keys found.`];
      break;
    case 'lookup':
      reportOutput = await formatLookup(entries, host);
      notes = host ? [`Lookup for "${host}".`] : ['No hostname specified for lookup.'];
      break;
    case 'findings':
      reportOutput = formatFindings(allFindings);
      notes = [`${allFindings.length} findings reported.`];
      break;
    default:
      reportOutput = formatSummary(entries, allFindings);
      notes = [`Unknown format "${format}", showing summary.`];
      warnings.push(`Unknown view "${format}" — showing the summary instead.`);
  }

  return {
    outputs: [],
    report: {
      output: JSON.stringify(reportOutput),
      render: 'table',
    },
    notes,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: {
      entries: entries.length,
      findings: allFindings.length,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;