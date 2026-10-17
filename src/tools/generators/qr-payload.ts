/**
 * Pure classification + parsing of payloads found in a scanned code.
 *
 * Worker-safe and test-friendly: no DOM, no network, no browser-only globals
 * beyond `TextDecoder` (only used for quoted-printable vCards, and guarded).
 * The file `run()` and the camera panel both import this module, so a code is
 * interpreted identically however it was captured.
 *
 * Nothing here ever navigates: the caller decides which (if any) action to
 * offer. Link schemes are allow-listed so a hostile code cannot produce a
 * `javascript:`/`data:` link that a UI might treat as safe.
 */

/** Content families the scanner understands. */
export type PayloadKind =
  'url' | 'wifi' | 'vcard' | 'email' | 'phone' | 'sms' | 'geo' | 'otp' | 'text';

export interface PayloadField {
  label: string;
  value: string;
}

export interface ParsedPayload {
  kind: PayloadKind;
  /** Short human label for the content family, e.g. 'Wi-Fi network'. */
  typeLabel: string;
  /** The exact decoded bytes, untouched. */
  raw: string;
  /** Structured facts shown as a table / contact card. */
  fields: PayloadField[];
  /** A link that is safe to hand to the browser, when the code has one. */
  href?: string;
  /** True when `href` is present and worth offering as an "Open" action. */
  canOpen: boolean;
  /** Verb for the open action, e.g. 'Open link' / 'Call'. */
  openLabel?: string;
  /** Non-fatal observations (e.g. a scheme we refuse to open). */
  warnings: string[];
  /** One-line summary used in reports and live results. */
  summary: string;
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

/** First `n` characters of `text`, with a single-line preview. */
export function preview(text: string, n = 96): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

/** Human-friendly Wi-Fi security label. */
function securityLabel(security: string): string {
  const t = security.trim().toUpperCase();
  if (t === '' || t === 'NOPASS' || t === 'NONE') return 'Open (no password)';
  if (t === 'WEP') return 'WEP (legacy, insecure)';
  if (t === 'WPA') return 'WPA / WPA2 / WPA3';
  if (t === 'WPA2') return 'WPA2';
  if (t === 'WPA3' || t === 'SAE') return 'WPA3';
  return t;
}

/** Decode a `=XX` quoted-printable string, tolerating soft line breaks. */
export function decodeQuotedPrintable(input: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (ch === '=') {
      const pair = input.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(pair)) {
        bytes.push(parseInt(pair, 16));
        i += 2;
        continue;
      }
      // Soft break (`=` at end of line) or a stray `=` — drop it.
      continue;
    }
    bytes.push(ch.charCodeAt(0) & 0xff);
  }
  const arr = new Uint8Array(bytes);
  if (typeof TextDecoder === 'function') {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(arr);
    } catch {
      /* fall through */
    }
  }
  return String.fromCharCode(...arr);
}

/* -------------------------------------------------------------------------- */
/*  Links                                                                     */
/* -------------------------------------------------------------------------- */

/** Schemes a browser/OS can be trusted to handle from a scanned code. */
const OPENABLE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'sms', 'geo']);

/** Schemes that look like links but must never be offered as one. */
const DANGEROUS_SCHEMES = new Set([
  'javascript',
  'data',
  'vbscript',
  'file',
  'blob',
  'filesystem',
  'about',
]);

const BARE_DOMAIN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/\S*)?$/i;
const EMAIL_RE =
  /^[^\s@<>()[\],;:"]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const PHONE_RE = /^\+?[\d][\d\s().-]{6,}[-\d]$/;

export interface LinkInfo {
  /** Safe, normalised href — present only for allow-listed schemes. */
  href?: string;
  scheme?: string;
  /** True when we had to assume `https://` because the code had no scheme. */
  assumedScheme: boolean;
  /** True when the text *looks* like a link but uses a blocked scheme. */
  blockedScheme?: string;
}

/**
 * Interpret `raw` as a link. Returns an href only for schemes in the allow-list;
 * `javascript:`, `data:` and friends are reported as `blockedScheme` so the UI
 * can tell the user why it refuses to open them.
 */
export function interpretLink(raw: string): LinkInfo {
  const text = raw.trim();
  if (!text) return { assumedScheme: false };

  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    const scheme = text.slice(0, text.indexOf(':')).toLowerCase();
    if (DANGEROUS_SCHEMES.has(scheme)) {
      return { scheme, assumedScheme: false, blockedScheme: scheme };
    }
    if (!OPENABLE_SCHEMES.has(scheme)) {
      return { scheme, assumedScheme: false, blockedScheme: scheme };
    }
    if (scheme === 'http' || scheme === 'https') {
      try {
        const url = new URL(text);
        return { href: url.href, scheme, assumedScheme: false };
      } catch {
        return { scheme, assumedScheme: false, blockedScheme: scheme };
      }
    }
    // mailto:/tel:/sms:/geo: — keep the author's spelling after the scheme.
    const rest = text.slice(scheme.length + 1);
    if (!rest || [...rest].some((c) => c.charCodeAt(0) < 32)) {
      return { scheme, assumedScheme: false, blockedScheme: scheme };
    }
    return { href: `${scheme}:${rest}`, scheme, assumedScheme: false };
  }

  if (/^www\./i.test(text) && BARE_DOMAIN.test(text)) {
    return { href: `https://${text}`, scheme: 'https', assumedScheme: true };
  }
  if (
    BARE_DOMAIN.test(text) &&
    /\.(com|net|org|io|dev|app|co|edu|gov|info|biz|me|xyz)(\/|$)/i.test(text)
  ) {
    return { href: `https://${text}`, scheme: 'https', assumedScheme: true };
  }
  return { assumedScheme: false };
}

/* -------------------------------------------------------------------------- */
/*  Wi-Fi                                                                     */
/* -------------------------------------------------------------------------- */

export interface WifiPayload {
  ssid: string;
  /** Raw `T:` value, e.g. `WPA`, `WEP`, `nopass` or `''`. */
  security: string;
  securityLabel: string;
  password: string;
  hidden: boolean;
  /** Every `KEY:value` pair, in order, for anything we don't model. */
  pairs: [string, string][];
}

/** Split `KEY:value;…` pairs, honouring the Wi-Fi QR escape rules. */
function splitWifiPairs(body: string): [string, string][] {
  const pairs: [string, string][] = [];
  let key = '';
  let value = '';
  let inValue = false;
  let escaped = false;

  for (const ch of body) {
    if (escaped) {
      if (inValue) value += ch;
      else key += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inValue && ch === ':') {
      inValue = true;
      continue;
    }
    if (inValue && ch === ';') {
      pairs.push([key, value]);
      key = '';
      value = '';
      inValue = false;
      continue;
    }
    if (inValue) value += ch;
    else key += ch;
  }
  if (key !== '' || value !== '') pairs.push([key, value]);
  return pairs.filter(([k, v]) => !(k === '' && v === ''));
}

/** Parse a `WIFI:` QR payload. Returns null when it is not a Wi-Fi payload. */
export function parseWifi(raw: string): WifiPayload | null {
  const m = /^\s*WIFI:/i.exec(raw);
  if (!m) return null;
  const pairs = splitWifiPairs(raw.slice(m[0].length));
  if (pairs.length === 0) return null;
  const lookup = (k: string) => pairs.find(([key]) => key.toUpperCase() === k)?.[1];

  const security = lookup('T') ?? '';
  const password = lookup('P') ?? '';
  const hidden = /^(true|1|yes)$/i.test(lookup('H') ?? '');

  return {
    ssid: lookup('S') ?? '',
    security,
    securityLabel: securityLabel(security),
    password,
    hidden,
    pairs,
  };
}

/* -------------------------------------------------------------------------- */
/*  vCard                                                                     */
/* -------------------------------------------------------------------------- */

export interface VCardPayload {
  fullName?: string;
  organization?: string;
  emails: string[];
  phones: string[];
  urls: string[];
  fields: PayloadField[];
}

/** Unfold RFC 6350 folded lines (continuations start with a space or tab). */
function unfoldVCard(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Split a property line into its name+params and value at the first real `:`. */
function splitPropertyLine(line: string): [string, string] | null {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) return [line.slice(0, i), line.slice(i + 1)];
  }
  return null;
}

function splitParams(left: string): { name: string; params: string[] } {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  for (const c of left) {
    if (c === '"') {
      quoted = !quoted;
      current += c;
      continue;
    }
    if (c === ';' && !quoted) {
      parts.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  parts.push(current);

  const rawName = parts.shift() ?? '';
  // Apple groups properties as `item1.EMAIL`; the group is not the property name.
  const name = (rawName.includes('.') ? rawName.slice(rawName.lastIndexOf('.') + 1) : rawName)
    .trim()
    .toUpperCase();
  return { name, params: parts.map((p) => p.trim()).filter(Boolean) };
}

const unescapeVCard = (s: string) =>
  s
    .replace(/\\[nN]/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');

/** Join structured (`A;B;C`) component lists, skipping empties. */
const joinComponents = (value: string, sep = ' ') =>
  value
    .split(/(?<!\\);/)
    .map((p) => unescapeVCard(p.trim()))
    .filter(Boolean)
    .join(sep);

/** Parse a `BEGIN:VCARD … END:VCARD` payload. Returns null when it is not one. */
export function parseVCard(raw: string): VCardPayload | null {
  if (!/BEGIN:VCARD/i.test(raw)) return null;
  const lines = unfoldVCard(raw);

  const collected = new Map<string, string[]>();
  for (const line of lines) {
    if (/^(BEGIN|END):VCARD/i.test(line)) continue;
    const split = splitPropertyLine(line);
    if (!split) continue;
    const { name, params } = splitParams(split[0]);
    if (!name) continue;
    let value = split[1];
    if (params.some((p) => /^ENCODING=QUOTED-PRINTABLE$/i.test(p))) {
      value = decodeQuotedPrintable(value);
    }
    const list = collected.get(name) ?? [];
    list.push(value);
    collected.set(name, list);
  }
  if (collected.size === 0) return null;

  const one = (key: string) =>
    collected.has(key) ? unescapeVCard(collected.get(key)![0]!) : undefined;
  const many = (key: string) => (collected.get(key) ?? []).map(unescapeVCard).filter(Boolean);

  const structuredName = one('N');
  let fullName = one('FN');
  if (!fullName && structuredName) {
    const [family = '', given = ''] = structuredName.split(/(?<!\\);/);
    fullName = [given, family]
      .map((p) => unescapeVCard(p.trim()))
      .filter(Boolean)
      .join(' ');
  }

  const fields: PayloadField[] = [];
  if (fullName) fields.push({ label: 'Name', value: fullName });
  if (structuredName)
    fields.push({ label: 'Structured name', value: joinComponents(structuredName) });
  const org = one('ORG');
  if (org) fields.push({ label: 'Organization', value: joinComponents(org) });
  const title = one('TITLE');
  if (title) fields.push({ label: 'Job title', value: title });
  const role = one('ROLE');
  if (role) fields.push({ label: 'Role', value: role });

  const emails = many('EMAIL');
  for (const e of emails) fields.push({ label: 'Email', value: e });
  const phones = many('TEL');
  for (const p of phones) fields.push({ label: 'Phone', value: p });
  const urls = many('URL');
  for (const u of urls) fields.push({ label: 'Website', value: u });
  for (const adr of many('ADR')) {
    fields.push({ label: 'Address', value: joinComponents(adr, ', ') });
  }
  const bday = one('BDAY');
  if (bday) fields.push({ label: 'Birthday', value: bday });
  const note = one('NOTE');
  if (note) fields.push({ label: 'Note', value: note });
  const nickname = one('NICKNAME');
  if (nickname) fields.push({ label: 'Nickname', value: nickname });

  return {
    fullName: fullName || org || undefined,
    organization: org ? joinComponents(org) : undefined,
    emails,
    phones,
    urls,
    fields,
  };
}

/* -------------------------------------------------------------------------- */
/*  Email / phone / SMS / geo / OTP                                           */
/* -------------------------------------------------------------------------- */

export interface EmailPayload {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

const splitAddresses = (s: string) =>
  s
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);

/** Parse `mailto:` or the older `MATMSG:` payload. Returns null when neither. */
export function parseEmail(raw: string): EmailPayload | null {
  const text = raw.trim();
  const matmsg = /^MATMSG:/i.exec(text);
  if (matmsg) {
    const body = text.slice(matmsg[0].length);
    const get = (key: string) => {
      const m = new RegExp(`(?:^|;)${key}:([^;]*)`, 'i').exec(body);
      return m ? m[1]!.trim() : '';
    };
    const to = get('TO');
    if (!to) return null;
    return { to: splitAddresses(to), cc: [], subject: get('SUB'), body: get('BODY') };
  }
  const mailto = /^mailto:/i.exec(text);
  if (!mailto) return null;
  const rest = text.slice(mailto[0].length);
  const q = rest.indexOf('?');
  const addressPart = q === -1 ? rest : rest.slice(0, q);
  const params = new URLSearchParams(q === -1 ? '' : rest.slice(q + 1));
  const to = splitAddresses(decodeURIComponent(addressPart));
  const cc = splitAddresses(params.get('cc') ?? '');
  return {
    to,
    cc,
    subject: params.get('subject') ?? '',
    body: params.get('body') ?? '',
  };
}

export interface SmsPayload {
  to: string;
  body: string;
}

/** Parse `SMSTO:` / `sms:` / `smsto:` payloads. Returns null when not one. */
export function parseSms(raw: string): SmsPayload | null {
  const text = raw.trim();
  const smsto = /^SMSTO:/i.exec(text);
  if (smsto) {
    const [to = '', ...rest] = text.slice(smsto[0].length).split(':');
    return { to: to.trim(), body: rest.join(':') };
  }
  const sms = /^(?:sms|smsto):/i.exec(text);
  if (!sms) return null;
  const rest = text.slice(sms[0].length);
  const q = rest.indexOf('?');
  if (q === -1) {
    const [to = '', ...more] = rest.split(',');
    return { to: to.trim(), body: more.join(',') };
  }
  const params = new URLSearchParams(rest.slice(q + 1));
  return { to: rest.slice(0, q).trim(), body: params.get('body') ?? '' };
}

export interface GeoPayload {
  lat?: string;
  lon?: string;
  altitude?: string;
  query?: string;
  zoom?: string;
}

/** Parse `geo:lat,lon[,alt][?q=…&z=…]`. Returns null when it is not a geo URI. */
export function parseGeo(raw: string): GeoPayload | null {
  const m = /^geo:/i.exec(raw.trim());
  if (!m) return null;
  const rest = raw.trim().slice(m[0].length);
  const [coords = '', queryPart = ''] = rest.split('?');
  const [lat, lon, altitude] = coords.split(',');
  const params = new URLSearchParams(queryPart);
  const q = params.get('q') ?? undefined;
  if (!lat && !lon && !q) return null;
  return {
    lat: lat?.trim() || undefined,
    lon: lon?.trim() || undefined,
    altitude: altitude?.trim() || undefined,
    query: q,
    zoom: params.get('z') ?? undefined,
  };
}

export interface OtpPayload {
  type: string;
  issuer: string;
  account: string;
  secret: string;
  digits: string;
  period: string;
  algorithm: string;
}

/** Parse an `otpauth://` one-time-password setup URI. Returns null when not one. */
export function parseOtp(raw: string): OtpPayload | null {
  const m = /^otpauth:\/\//i.exec(raw.trim());
  if (!m) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const params = url.searchParams;
  const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const [issuerFromLabel, accountFromLabel] = label.includes(':')
    ? [label.slice(0, label.indexOf(':')).trim(), label.slice(label.indexOf(':') + 1).trim()]
    : ['', label];
  return {
    type: url.hostname.toLowerCase(),
    issuer: params.get('issuer') ?? issuerFromLabel,
    account: accountFromLabel,
    secret: params.get('secret') ?? '',
    digits: params.get('digits') ?? '6',
    period: params.get('period') ?? '30',
    algorithm: params.get('algorithm') ?? 'SHA1',
  };
}

/* -------------------------------------------------------------------------- */
/*  Classification                                                            */
/* -------------------------------------------------------------------------- */

const TYPE_LABELS: Record<PayloadKind, string> = {
  url: 'URL',
  wifi: 'Wi-Fi network',
  vcard: 'Contact card (vCard)',
  email: 'Email address',
  phone: 'Phone number',
  sms: 'SMS message',
  geo: 'Location',
  otp: 'One-time-password setup',
  text: 'Plain text',
};

function urlPayload(raw: string): ParsedPayload {
  const link = interpretLink(raw);
  const warnings: string[] = [];
  if (link.blockedScheme) {
    warnings.push(
      `Refused to make this a link: the "${link.blockedScheme}:" scheme is not safe to open.`,
    );
  }
  if (link.assumedScheme) {
    warnings.push('The code had no scheme, so it is opened as an https:// link.');
  }
  const fields: PayloadField[] = [];
  if (link.href) {
    fields.push({ label: 'Link', value: link.href });
    try {
      const u = new URL(link.href);
      if (u.hostname) fields.push({ label: 'Host', value: u.hostname });
      if (u.pathname && u.pathname !== '/') fields.push({ label: 'Path', value: u.pathname });
    } catch {
      /* not an absolute URL (mailto: etc.) */
    }
  } else {
    fields.push({ label: 'Text', value: raw.trim() });
  }
  return {
    kind: 'url',
    typeLabel: TYPE_LABELS.url,
    raw,
    fields,
    href: link.href,
    canOpen: Boolean(link.href),
    openLabel: 'Open link',
    warnings,
    summary: link.href ?? preview(raw),
  };
}

/**
 * Classify a decoded payload and pull out the fields a user cares about.
 * Never throws — unknown content becomes `text`.
 */
export function classifyPayload(raw: string): ParsedPayload {
  const text = raw.trim();

  const wifi = parseWifi(text);
  if (wifi) {
    const fields: PayloadField[] = [
      { label: 'SSID', value: wifi.ssid || '(none)' },
      { label: 'Security', value: wifi.securityLabel },
    ];
    if (wifi.password) fields.push({ label: 'Password', value: wifi.password });
    if (wifi.hidden) fields.push({ label: 'Hidden network', value: 'Yes' });
    for (const [key, value] of wifi.pairs) {
      const upper = key.toUpperCase();
      if (['T', 'S', 'P', 'H'].includes(upper)) continue;
      fields.push({ label: `Wi-Fi ${upper}`, value });
    }
    const warnings =
      wifi.password === '' && !/^(nopass|none|)$/i.test(wifi.security.trim())
        ? ['This code contains no password — you may be prompted for it.']
        : [];
    return {
      kind: 'wifi',
      typeLabel: TYPE_LABELS.wifi,
      raw,
      fields,
      canOpen: false,
      warnings,
      summary: `SSID "${wifi.ssid}" · ${wifi.securityLabel}${wifi.hidden ? ' · hidden' : ''}`,
    };
  }

  const card = parseVCard(raw);
  if (card) {
    const bits = [card.fullName, card.emails[0], card.phones[0]].filter(Boolean);
    return {
      kind: 'vcard',
      typeLabel: TYPE_LABELS.vcard,
      raw,
      fields: card.fields,
      canOpen: false,
      warnings: [],
      summary: bits.length ? bits.join(' · ') : 'Contact card',
    };
  }

  const otp = parseOtp(text);
  if (otp) {
    return {
      kind: 'otp',
      typeLabel: TYPE_LABELS.otp,
      raw,
      fields: [
        { label: 'Type', value: otp.type.toUpperCase() },
        { label: 'Issuer', value: otp.issuer || '(none)' },
        { label: 'Account', value: otp.account || '(none)' },
        { label: 'Secret', value: otp.secret },
        { label: 'Digits', value: otp.digits },
        { label: 'Period (s)', value: otp.period },
        { label: 'Algorithm', value: otp.algorithm },
      ],
      canOpen: false,
      warnings: ['A setup code contains a shared secret — treat it like a password.'],
      summary: `${otp.type.toUpperCase()} · ${[otp.issuer, otp.account].filter(Boolean).join(' · ')}`,
    };
  }

  const email = parseEmail(text);
  if (email) {
    const fields: PayloadField[] = [];
    if (email.to.length) fields.push({ label: 'To', value: email.to.join(', ') });
    if (email.cc.length) fields.push({ label: 'Cc', value: email.cc.join(', ') });
    if (email.subject) fields.push({ label: 'Subject', value: email.subject });
    if (email.body) fields.push({ label: 'Body', value: email.body });
    const href = email.to.length ? `mailto:${email.to.join(',')}` : undefined;
    return {
      kind: 'email',
      typeLabel: TYPE_LABELS.email,
      raw,
      fields,
      href,
      canOpen: Boolean(href),
      openLabel: 'Compose email',
      warnings: [],
      summary: `to ${email.to.join(', ')}${email.subject ? ` · ${email.subject}` : ''}`,
    };
  }

  const sms = parseSms(text);
  if (sms) {
    const fields: PayloadField[] = [{ label: 'To', value: sms.to || '(none)' }];
    if (sms.body) fields.push({ label: 'Message', value: sms.body });
    const href = sms.to ? `sms:${sms.to}` : undefined;
    return {
      kind: 'sms',
      typeLabel: TYPE_LABELS.sms,
      raw,
      fields,
      href,
      canOpen: Boolean(href),
      openLabel: 'Send SMS',
      warnings: [],
      summary: `to ${sms.to}${sms.body ? ` · ${preview(sms.body, 40)}` : ''}`,
    };
  }

  const phone = /^tel:/i.exec(text);
  if (phone) {
    const number = text.slice(phone[0].length).split(';')[0]!.trim();
    return {
      kind: 'phone',
      typeLabel: TYPE_LABELS.phone,
      raw,
      fields: [{ label: 'Number', value: number }],
      href: number ? `tel:${number}` : undefined,
      canOpen: Boolean(number),
      openLabel: 'Call number',
      warnings: [],
      summary: number,
    };
  }

  const geo = parseGeo(text);
  if (geo) {
    const fields: PayloadField[] = [];
    if (geo.lat && geo.lon) fields.push({ label: 'Coordinates', value: `${geo.lat}, ${geo.lon}` });
    if (geo.altitude) fields.push({ label: 'Altitude', value: geo.altitude });
    if (geo.query) fields.push({ label: 'Place', value: geo.query });
    if (geo.zoom) fields.push({ label: 'Zoom', value: geo.zoom });
    const href = `geo:${[geo.lat, geo.lon].filter(Boolean).join(',')}${
      geo.query ? `?q=${encodeURIComponent(geo.query)}` : ''
    }`;
    return {
      kind: 'geo',
      typeLabel: TYPE_LABELS.geo,
      raw,
      fields,
      href,
      canOpen: true,
      openLabel: 'Open in maps',
      warnings: [],
      summary: geo.query ?? [geo.lat, geo.lon].filter(Boolean).join(', '),
    };
  }

  // Explicit schemes — including ones we refuse to open (javascript:, data: …),
  // which still need to be reported as a URL with a warning.
  const direct = interpretLink(text);
  if (direct.scheme) return urlPayload(raw);

  if (EMAIL_RE.test(text)) {
    return {
      kind: 'email',
      typeLabel: TYPE_LABELS.email,
      raw,
      fields: [{ label: 'To', value: text }],
      href: `mailto:${text}`,
      canOpen: true,
      openLabel: 'Compose email',
      warnings: [],
      summary: text,
    };
  }

  if (PHONE_RE.test(text) && /^\+/.test(text)) {
    const number = text.replace(/[^\d+]/g, '');
    return {
      kind: 'phone',
      typeLabel: TYPE_LABELS.phone,
      raw,
      fields: [{ label: 'Number', value: number }],
      href: `tel:${number}`,
      canOpen: true,
      openLabel: 'Call number',
      warnings: ['The code is bare digits — treated as a phone number.'],
      summary: number,
    };
  }

  // Scheme-less domains/`www.` hosts — a very common QR payload.
  if (direct.href) return urlPayload(raw);

  return {
    kind: 'text',
    typeLabel: TYPE_LABELS.text,
    raw,
    fields: text ? [{ label: 'Text', value: text }] : [],
    canOpen: false,
    warnings: [],
    summary: preview(raw) || '(empty)',
  };
}

/* -------------------------------------------------------------------------- */
/*  Actions                                                                   */
/* -------------------------------------------------------------------------- */

export interface PayloadAction {
  id: 'open' | 'copy' | 'copy-password' | 'copy-card' | 'copy-secret' | 'email' | 'call';
  label: string;
  /** Navigable target for `open`/`email`/`call`. */
  href?: string;
  /** Text the copy actions place on the clipboard. */
  value?: string;
}

/**
 * The concrete actions a decoded payload supports. Ordered most-useful first.
 * URL actions are only produced when `href` passed the scheme allow-list, so a
 * `javascript:` code can never turn into an "Open" button.
 */
export function payloadActions(p: ParsedPayload): PayloadAction[] {
  const actions: PayloadAction[] = [];
  if (p.canOpen && p.href) {
    actions.push({ id: 'open', label: p.openLabel ?? 'Open', href: p.href });
  }
  switch (p.kind) {
    case 'wifi': {
      const wifi = parseWifi(p.raw);
      if (wifi?.password) {
        actions.push({ id: 'copy-password', label: 'Copy password', value: wifi.password });
      }
      if (wifi?.ssid) actions.push({ id: 'copy', label: 'Copy network name', value: wifi.ssid });
      break;
    }
    case 'vcard': {
      const card = parseVCard(p.raw);
      actions.push({ id: 'copy-card', label: 'Copy vCard', value: p.raw.trim() });
      if (card?.emails[0]) {
        actions.push({ id: 'email', label: 'Email contact', href: `mailto:${card.emails[0]}` });
      }
      if (card?.phones[0]) {
        actions.push({ id: 'call', label: 'Call contact', href: `tel:${card.phones[0]}` });
      }
      break;
    }
    case 'email': {
      const email = parseEmail(p.raw);
      const first = email?.to[0];
      if (first) actions.push({ id: 'copy', label: 'Copy address', value: first });
      break;
    }
    case 'phone': {
      const number = p.fields.find((f) => f.label === 'Number')?.value ?? p.raw;
      actions.push({ id: 'copy', label: 'Copy number', value: number });
      break;
    }
    case 'sms': {
      const sms = parseSms(p.raw);
      if (sms?.to) actions.push({ id: 'copy', label: 'Copy number', value: sms.to });
      break;
    }
    case 'geo': {
      const geo = parseGeo(p.raw);
      if (geo?.lat && geo.lon) {
        actions.push({ id: 'copy', label: 'Copy coordinates', value: `${geo.lat},${geo.lon}` });
      }
      break;
    }
    case 'otp': {
      const otp = parseOtp(p.raw);
      if (otp?.secret) actions.push({ id: 'copy-secret', label: 'Copy secret', value: otp.secret });
      actions.push({ id: 'copy', label: 'Copy setup URI', value: p.raw.trim() });
      break;
    }
    default: {
      actions.push({ id: 'copy', label: 'Copy text', value: p.raw });
      break;
    }
  }
  if (!actions.some((a) => a.id === 'copy' || a.id === 'copy-card')) {
    actions.push({ id: 'copy', label: 'Copy raw payload', value: p.raw });
  }
  return actions;
}
