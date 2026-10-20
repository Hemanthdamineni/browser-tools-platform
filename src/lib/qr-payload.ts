/**
 * Classify a decoded barcode payload into what a person actually wants to do
 * with it: follow a link, join a Wi-Fi network, save a contact, or copy text.
 *
 * Pure and dependency-free — the same code runs in the tool worker, on the main
 * thread (camera island) and in unit tests. Classification never opens, follows
 * or sends anything; it only describes what was found.
 */

export type PayloadKind = 'url' | 'wifi' | 'vcard' | 'text';

/** Short human label per payload kind — shared by the report and the actions UI. */
export const PAYLOAD_KIND_LABELS: Record<PayloadKind, string> = {
  url: 'URL',
  wifi: 'Wi-Fi',
  vcard: 'Contact',
  text: 'Text',
};

/** Schemes the UI is allowed to offer as an "Open" action. */
const OPENABLE_SCHEMES = new Set([
  'http',
  'https',
  'mailto',
  'tel',
  'sms',
  'smsto',
  'mms',
  'geo',
  'otpauth',
  'bitcoin',
  'ftp',
  'ftps',
  'webcal',
  'urn',
  'irc',
  'ircs',
  'xmpp',
  'matrix',
  'sip',
  'callto',
  'magnet',
]);

/** Schemes that must never become a clickable link. */
const DANGEROUS_SCHEMES = new Set([
  'javascript',
  'data',
  'vbscript',
  'file',
  'blob',
  'about',
  'chrome',
  'jar',
  'view-source',
]);

export interface UrlPayload {
  kind: 'url';
  /** The payload exactly as decoded. */
  raw: string;
  /** Normalised URL (or URI) to open or copy. */
  url: string;
  scheme: string;
  /** Host, when the URI has an authority. */
  host?: string;
  /** True when the payload was a bare domain and `https://` was assumed. */
  assumedScheme: boolean;
  /** False for schemes the tool refuses to turn into a link. */
  openable: boolean;
  /** Extra context (unsafe or unrecognised scheme). */
  notice?: string;
}

export interface WifiPayload {
  kind: 'wifi';
  raw: string;
  ssid: string;
  /** `'nopass'`, `'WEP'`, `'WPA'`-ish as given, or `''` when absent. */
  security: string;
  password: string;
  /** True when the payload carried a (non-empty) password field. */
  hasPassword: boolean;
  hidden: boolean;
}

export interface VCardField {
  /** Property name, upper-case (e.g. `TEL`). */
  property: string;
  /** Friendly label for display (e.g. `Phone`). */
  label: string;
  /** Value as it should be shown. */
  value: string;
  /** Value ready to be re-emitted in a vCard (escaped, structured `;` kept). */
  rawValue: string;
  /** vCard `TYPE` parameters, if any (e.g. `['WORK', 'VOICE']`). */
  types: string[];
}

export interface VCardCard {
  /** Display name: `FN`, or built from the `N` components. */
  name: string;
  fields: VCardField[];
  emails: string[];
  phones: string[];
  urls: string[];
  /** Property names present in the payload that this parser does not carry over. */
  ignored: string[];
  /** File-name-safe stem derived from the name, e.g. `ada-lovelace`. */
  stem: string;
}

export interface VCardPayload {
  kind: 'vcard';
  raw: string;
  cards: VCardCard[];
}

export interface TextPayload {
  kind: 'text';
  raw: string;
  text: string;
  /** Set when the payload looked like something we deliberately did not classify. */
  notice?: string;
}

export type QrPayload = UrlPayload | WifiPayload | VCardPayload | TextPayload;

/* -------------------------------------------------------------------------- */
/*  Classification                                                            */
/* -------------------------------------------------------------------------- */

const WIFI_PREFIX = /^\s*wifi:/i;
const VCARD_PREFIX = /^\s*BEGIN:VCARD/i;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
/** A single "word" that looks like a host: `example.com`, `www.x.co/path?q=1`. */
const BARE_DOMAIN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d{2,5})?(?:[/?#][^\s]*)?$/i;

/** Describe a decoded payload. Never throws — anything unknown is plain text. */
export function classifyPayload(raw: string): QrPayload {
  const text = raw.trim();

  if (VCARD_PREFIX.test(raw)) {
    const cards = parseVCards(raw);
    if (cards.length) return { kind: 'vcard', raw, cards };
    return { kind: 'text', raw, text, notice: 'This looks like a vCard but no fields could be read.' };
  }

  if (WIFI_PREFIX.test(raw)) {
    const wifi = parseWifi(raw);
    if (wifi.ssid || wifi.password) return wifi;
    return {
      kind: 'text',
      raw,
      text,
      notice: 'This looks like a Wi-Fi join string but carries no network name.',
    };
  }

  const schemeMatch = SCHEME.exec(text);
  if (schemeMatch) {
    const scheme = schemeMatch[1]!.toLowerCase();
    if (DANGEROUS_SCHEMES.has(scheme)) {
      return {
        kind: 'text',
        raw,
        text,
        notice: `This payload uses a "${scheme}:" link, which this tool will not open.`,
      };
    }
    const openable = OPENABLE_SCHEMES.has(scheme);
    return {
      kind: 'url',
      raw,
      url: text,
      scheme,
      host: hostOf(text),
      assumedScheme: false,
      openable,
      notice: openable ? undefined : `"${scheme}:" is not a scheme browsers open from a link.`,
    };
  }

  if (BARE_DOMAIN.test(text)) {
    const url = `https://${text}`;
    return {
      kind: 'url',
      raw,
      url,
      scheme: 'https',
      host: hostOf(url),
      assumedScheme: true,
      openable: true,
    };
  }

  return { kind: 'text', raw, text };
}

function hostOf(uri: string): string | undefined {
  try {
    return new URL(uri).host || undefined;
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/*  Wi-Fi join strings:  WIFI:T:WPA;S:SSID;P:password;H:true;;                */
/* -------------------------------------------------------------------------- */

/**
 * Parse a `WIFI:` join string. Values may escape `\;`, `\,`, `\:`, `\"` and
 * `\\`; field order is arbitrary and unknown fields are ignored.
 */
export function parseWifi(raw: string): WifiPayload {
  const body = raw.replace(WIFI_PREFIX, '');
  const fields = new Map<string, string>();

  let key = '';
  let value = '';
  let inValue = false;
  let escaped = false;
  const commit = () => {
    const k = key.trim().toUpperCase();
    if (k && !fields.has(k)) fields.set(k, value);
    key = '';
    value = '';
    inValue = false;
  };

  for (const ch of body) {
    if (escaped) {
      if (inValue) value += ch;
      else key += ch;
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (!inValue && ch === ':') {
      inValue = true;
    } else if (ch === ';') {
      commit();
    } else if (inValue) {
      value += ch;
    } else {
      key += ch;
    }
  }
  commit();

  const ssid = fields.get('S') ?? '';
  const security = normalizeSecurity(fields.get('T') ?? '');
  const password = fields.get('P') ?? '';
  return {
    kind: 'wifi',
    raw,
    ssid,
    security,
    password,
    hasPassword: fields.has('P') && password.length > 0,
    hidden: /^(true|1)$/i.test((fields.get('H') ?? '').trim()),
  };
}

function normalizeSecurity(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^nopass$/i.test(v)) return 'nopass';
  if (/^wep$/i.test(v)) return 'WEP';
  return v.toUpperCase();
}

/* -------------------------------------------------------------------------- */
/*  vCards                                                                     */
/* -------------------------------------------------------------------------- */

const KNOWN_PROPERTIES: Record<string, string> = {
  FN: 'Name',
  N: 'Structured name',
  NICKNAME: 'Nickname',
  ORG: 'Organisation',
  TITLE: 'Title',
  ROLE: 'Role',
  TEL: 'Phone',
  EMAIL: 'Email',
  URL: 'Website',
  ADR: 'Address',
  BDAY: 'Birthday',
  IMPP: 'Instant message',
  NOTE: 'Note',
  UID: 'UID',
};

interface ParsedProperty {
  name: string;
  params: Record<string, string>;
  types: string[];
  /** Raw value text between `:` and end of line (line-unfolded, QP-decoded). */
  raw: string;
}

/** Split lines, joining RFC 6350 "folded" continuation lines. */
function unfoldLines(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split(/\r\n|\r|\n/)) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Split `head` on `;` while honouring double-quoted parameter values. */
function splitUnquoted(input: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (const ch of input) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
    } else if (ch === sep && !inQuotes) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function parseProperty(line: string): ParsedProperty | null {
  const segments = splitUnquoted(line, ':');
  if (segments.length < 2) return null;
  const head = segments.shift()!;
  // A value may legally contain ':' — everything after the first one is the value.
  const valueField = segments.join(':');

  const headParts = splitUnquoted(head, ';');
  let name = (headParts.shift() ?? '').trim().toUpperCase();
  const groupDot = name.indexOf('.');
  if (groupDot > 0) name = name.slice(groupDot + 1); // `item1.TEL` → `TEL`
  if (!name) return null;

  const params: Record<string, string> = {};
  const types: string[] = [];
  for (const part of headParts) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      const bare = part.trim().toUpperCase();
      if (bare) types.push(bare); // vCard 2.1 shorthand: `TEL;WORK;VOICE:…`
      continue;
    }
    const key = part.slice(0, eq).trim().toUpperCase();
    const val = part.slice(eq + 1).trim().replace(/^"|"$/g, '');
    params[key] = val;
    if (key === 'TYPE') {
      for (const t of val.split(',')) {
        const trimmed = t.trim().toUpperCase();
        if (trimmed) types.push(trimmed);
      }
    }
  }

  return { name, params, types, raw: decodePropertyValue(valueField, params) };
}

/** Decode QUOTED-PRINTABLE; backslash escapes are handled per property kind. */
function decodePropertyValue(value: string, params: Record<string, string>): string {
  const encoding = (params.ENCODING ?? '').toUpperCase();
  if (encoding === 'QUOTED-PRINTABLE' || /=[0-9A-Fa-f]{2}/.test(value)) {
    return decodeQuotedPrintable(value);
  }
  return value;
}

/** Decode `=XX` escapes (UTF-8 aware). A lone trailing `=` is a soft break. */
export function decodeQuotedPrintable(input: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (ch === '=') {
      const hex = input.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
      // A soft line break (`=` + CRLF) joins the next line; drop both.
      if (input[i + 1] === '\r' && input[i + 2] === '\n') {
        i += 2;
        continue;
      }
      if (input[i + 1] === '\n') {
        i += 1;
        continue;
      }
      continue; // stray '='
    }
    const code = ch.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else bytes.push(...new TextEncoder().encode(ch));
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return String.fromCharCode(...bytes);
  }
}

/** Turn `\n`, `\,`, `\;` and `\\` escapes into the characters they stand for. */
export function unescapeVCardText(input: string): string {
  let out = '';
  let escaped = false;
  for (const ch of input) {
    if (escaped) {
      out += ch === 'n' || ch === 'N' ? '\n' : ch;
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else {
      out += ch;
    }
  }
  if (escaped) out += '\\';
  return out;
}

function escapeVCardText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/** Split an N/ADR-style structured value on unescaped `;`. */
function splitStructured(raw: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let escaped = false;
  for (const ch of raw) {
    if (escaped) {
      cur += '\\' + ch;
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === ';') {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (escaped) cur += '\\';
  parts.push(cur);
  return parts.map(unescapeVCardText);
}

const STRUCTURED = new Set(['N', 'ADR']);

/** Parse every vCard in a payload. Unterminated blocks are read leniently. */
export function parseVCards(raw: string): VCardCard[] {
  const lines = unfoldLines(raw);
  const cards: VCardCard[] = [];
  let current: ParsedProperty[] | null = null;

  const flush = () => {
    if (current && current.length) cards.push(buildCard(current));
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (upper === 'BEGIN:VCARD') {
      current = [];
      continue;
    }
    if (upper === 'END:VCARD') {
      flush();
      continue;
    }
    if (!current) continue; // ignore chatter outside a card
    if (!trimmed) continue;
    const prop = parseProperty(trimmed);
    if (prop) current.push(prop);
  }
  flush();
  return cards;
}

function buildCard(properties: ParsedProperty[]): VCardCard {
  const fields: VCardField[] = [];
  const emails: string[] = [];
  const phones: string[] = [];
  const urls: string[] = [];
  const ignored: string[] = [];
  let structuredName: string | undefined;
  let formattedName: string | undefined;

  for (const prop of properties) {
    const label = KNOWN_PROPERTIES[prop.name];
    if (!label) {
      if (prop.name !== 'VERSION' && !ignored.includes(prop.name)) ignored.push(prop.name);
      continue;
    }

    const parts = STRUCTURED.has(prop.name) ? splitStructured(prop.raw) : undefined;
    const value = parts ? parts.filter(Boolean).join(', ') : unescapeVCardText(prop.raw);
    const rawValue = parts ? parts.map(escapeVCardText).join(';') : escapeVCardText(value);
    if (!value && prop.name !== 'N' && prop.name !== 'FN') continue;

    if (prop.name === 'N') structuredName = value;
    if (prop.name === 'FN') formattedName = value;
    if (prop.name === 'EMAIL' && value) emails.push(value);
    if (prop.name === 'TEL' && value) phones.push(value);
    if (prop.name === 'URL' && value) urls.push(value);

    fields.push({
      property: prop.name,
      label,
      value,
      rawValue,
      types: prop.types,
    });
  }

  // N is family;given;additional;prefix;suffix — read it back for a friendly name.
  const nMatch = properties.find((p) => p.name === 'N');
  const fromN = nMatch ? nameFromN(splitStructured(nMatch.raw)) : '';
  const name = formattedName || fromN || structuredName || '';

  fields.sort((a, b) => orderOf(a.property) - orderOf(b.property) || a.property.localeCompare(b.property));

  return { name, fields, emails, phones, urls, ignored, stem: vcardStem(name) };
}

function orderOf(property: string): number {
  const order = Object.keys(KNOWN_PROPERTIES);
  const i = order.indexOf(property);
  return i === -1 ? order.length : i;
}

function nameFromN(parts: string[]): string {
  const [family = '', given = '', additional = '', prefix = '', suffix = ''] = parts;
  return [prefix, given, additional, family, suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** File-name-safe stem for a rebuilt `.vcf`. */
export function vcardStem(name: string): string {
  const stem = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return stem || 'contact';
}

/** Rebuild a clean vCard 3.0 document from the fields we understood. */
export function buildVCard(card: VCardCard): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (!card.fields.some((f) => f.property === 'N')) {
    lines.push(`N:${escapeVCardText(card.name)};;;;`);
  }
  if (!card.fields.some((f) => f.property === 'FN')) {
    lines.push(`FN:${escapeVCardText(card.name)}`);
  }
  for (const field of card.fields) {
    const types = field.types.length ? `;TYPE=${field.types.join(',')}` : '';
    lines.push(`${field.property}${types}:${field.rawValue}`);
  }
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

/**
 * One-line summary of a payload for reports and stats — the raw text for plain
 * payloads, the key fact for Wi-Fi and contacts.
 */
export function payloadHeadline(payload: QrPayload): string {
  switch (payload.kind) {
    case 'url':
      return payload.url;
    case 'wifi':
      return payload.ssid || '(network name missing)';
    case 'vcard':
      return payload.cards.map((c) => c.name || '(unnamed contact)').join(', ');
    case 'text':
      return payload.text;
  }
}
