import { describe, expect, it } from 'vitest';
import {
  buildVCard,
  classifyPayload,
  decodeQuotedPrintable,
  parseVCards,
  parseWifi,
  payloadHeadline,
  unescapeVCardText,
  vcardStem,
  type UrlPayload,
  type WifiPayload,
} from './qr-payload';

const url = (raw: string) => classifyPayload(raw) as UrlPayload;
const wifi = (raw: string) => classifyPayload(raw) as WifiPayload;

describe('classifyPayload', () => {
  it('keeps http and https URLs verbatim', () => {
    const p = url('https://example.com/path?a=1#frag');
    expect(p.kind).toBe('url');
    expect(p.url).toBe('https://example.com/path?a=1#frag');
    expect(p.scheme).toBe('https');
    expect(p.host).toBe('example.com');
    expect(p.openable).toBe(true);
    expect(p.assumedScheme).toBe(false);
  });

  it('handles non-http schemes browsers can open', () => {
    for (const [raw, scheme] of [
      ['mailto:ada@example.com', 'mailto'],
      ['tel:+441234567', 'tel'],
      ['geo:51.5,-0.1', 'geo'],
      ['otpauth://totp/Acme?secret=ABC', 'otpauth'],
    ] as const) {
      const p = url(raw);
      expect(p.scheme).toBe(scheme);
      expect(p.openable).toBe(true);
    }
  });

  it('assumes https for a bare domain', () => {
    const p = url('example.com/pricing');
    expect(p.kind).toBe('url');
    expect(p.url).toBe('https://example.com/pricing');
    expect(p.assumedScheme).toBe(true);
    expect(p.openable).toBe(true);
  });

  it('does not treat prose containing a domain as a link', () => {
    const p = classifyPayload('visit example.com for details');
    expect(p.kind).toBe('text');
  });

  it('refuses to linkify dangerous schemes', () => {
    for (const raw of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:msgbox']) {
      const p = classifyPayload(raw);
      expect(p.kind).toBe('text');
      expect(p.notice).toMatch(/will not open/);
    }
  });

  it('classifies unknown schemes as non-openable URIs', () => {
    const p = url('myapp://open?id=1');
    expect(p.kind).toBe('url');
    expect(p.openable).toBe(false);
    expect(p.notice).toMatch(/myapp/);
  });

  it('classifies plain text, keeping raw whitespace but trimming the text', () => {
    const p = classifyPayload('  hello world\n');
    expect(p.kind).toBe('text');
    expect(p.text).toBe('hello world');
    expect(p.raw).toBe('  hello world\n');
  });

  it('keeps Unicode intact', () => {
    const p = classifyPayload('héllo wörld ✅ 日本語');
    expect(p.kind).toBe('text');
    expect(p.text).toBe('héllo wörld ✅ 日本語');
  });

  it('treats an empty payload as empty text', () => {
    const p = classifyPayload('');
    expect(p.kind).toBe('text');
    expect(p.text).toBe('');
  });

  it('labels payload kinds for the UI', () => {
    expect(payloadHeadline(url('example.com'))).toBe('https://example.com');
    expect(payloadHeadline(wifi('WIFI:S:Home;;'))).toBe('Home');
  });
});

describe('parseWifi', () => {
  it('parses a typical join string', () => {
    const p = wifi('WIFI:T:WPA;S:HomeNet;P:s3cret;H:false;;');
    expect(p.kind).toBe('wifi');
    expect(p.ssid).toBe('HomeNet');
    expect(p.security).toBe('WPA');
    expect(p.password).toBe('s3cret');
    expect(p.hasPassword).toBe(true);
    expect(p.hidden).toBe(false);
  });

  it('accepts lowercase, out-of-order and missing fields', () => {
    const p = wifi('wifi:S:Café WiFi;T:nopass;;');
    expect(p.ssid).toBe('Café WiFi');
    expect(p.security).toBe('nopass');
    expect(p.hasPassword).toBe(false);
    expect(p.hidden).toBe(false);
  });

  it('marks hidden networks', () => {
    expect(wifi('WIFI:T:WPA;S:Stealth;P:x;H:true;;').hidden).toBe(true);
  });

  it('honours escaped separators and backslashes', () => {
    const p = wifi('WIFI:T:WPA;S:My\\;Net\\,1;P:pa\\:ss\\\\word;;');
    expect(p.ssid).toBe('My;Net,1');
    expect(p.password).toBe('pa:ss\\word');
  });

  it('normalises WEP and keeps multi-part security strings', () => {
    expect(wifi('WIFI:T:wep;S:Old;P:abc;;').security).toBe('WEP');
    expect(wifi('WIFI:T:WPA2-EAP;S:Corp;;').security).toBe('WPA2-EAP');
  });

  it('falls back to text when there is nothing to join', () => {
    const p = classifyPayload('WIFI:');
    expect(p.kind).toBe('text');
    expect(p.notice).toMatch(/no network name/i);
  });
});

describe('parseVCards', () => {
  const card = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Lovelace;Ada;;Countess;',
    'FN:Ada Lovelace',
    'ORG:Analytical Engines',
    'TITLE:Mathematician',
    'TEL;TYPE=WORK,VOICE:+44 20 7946 0000',
    'EMAIL;TYPE=WORK:ada@example.com',
    'URL:https://example.com/ada',
    'ADR;TYPE=HOME:;;12 Mill Lane;London;;EC1;UK',
    'NOTE:Met at the symposium\\, briefly',
    'END:VCARD',
  ].join('\r\n');

  it('parses a card into ordered display fields', () => {
    const cards = parseVCards(card);
    expect(cards).toHaveLength(1);
    const c = cards[0]!;
    expect(c.name).toBe('Ada Lovelace');
    expect(c.emails).toEqual(['ada@example.com']);
    expect(c.phones).toEqual(['+44 20 7946 0000']);
    expect(c.urls).toEqual(['https://example.com/ada']);
    const properties = c.fields.map((f) => f.property);
    expect(properties).toEqual([
      'FN',
      'N',
      'ORG',
      'TITLE',
      'TEL',
      'EMAIL',
      'URL',
      'ADR',
      'NOTE',
    ]);
    const note = c.fields.find((f) => f.property === 'NOTE')!;
    expect(note.value).toBe('Met at the symposium, briefly');
    const adr = c.fields.find((f) => f.property === 'ADR')!;
    expect(adr.value).toBe('12 Mill Lane, London, EC1, UK');
    const tel = c.fields.find((f) => f.property === 'TEL')!;
    expect(tel.types).toEqual(['WORK', 'VOICE']);
    expect(c.stem).toBe('ada-lovelace');
  });

  it('derives a name from N when FN is missing', () => {
    const c = parseVCards('BEGIN:VCARD\nN:Müller;Jörg;;Dr.;\nEND:VCARD')[0]!;
    expect(c.name).toBe('Dr. Jörg Müller');
  });

  it('joins folded continuation lines', () => {
    const c = parseVCards('BEGIN:VCARD\nFN:Ada\nNOTE:first part\n second part\nEND:VCARD')[0]!;
    expect(c.fields.find((f) => f.property === 'NOTE')!.value).toBe('first partsecond part');
  });

  it('reads QUOTED-PRINTABLE values as UTF-8', () => {
    const c = parseVCards(
      'BEGIN:VCARD\nFN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=4A=C3=B6rg M=C3=BCller\nEND:VCARD',
    )[0]!;
    expect(c.name).toBe('Jörg Müller');
  });

  it('handles property groups and repeated cards', () => {
    const cards = parseVCards(
      [
        'BEGIN:VCARD',
        'FN:One',
        'item1.TEL:+1',
        'END:VCARD',
        'BEGIN:VCARD',
        'FN:Two',
        'PHOTO;ENCODING=b:AAAA',
        'END:VCARD',
      ].join('\n'),
    );
    expect(cards.map((c) => c.name)).toEqual(['One', 'Two']);
    expect(cards[0]!.phones).toEqual(['+1']);
    expect(cards[1]!.ignored).toContain('PHOTO');
  });

  it('reads an unterminated card leniently', () => {
    const cards = parseVCards('BEGIN:VCARD\nFN:Half Written\nTEL:555');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.name).toBe('Half Written');
  });

  it('returns nothing for a vCard header with no properties', () => {
    expect(parseVCards('BEGIN:VCARD\nEND:VCARD')).toEqual([]);
    expect(classifyPayload('BEGIN:VCARD\nEND:VCARD').kind).toBe('text');
  });
});

describe('buildVCard', () => {
  it('round-trips through parseVCards with CRLF line endings', () => {
    const original =
      'BEGIN:VCARD\nFN:Ada Lovelace\nN:Lovelace;Ada;;;\nEMAIL;TYPE=WORK:ada@example.com\nTEL:+441234\nEND:VCARD';
    const card = parseVCards(original)[0]!;
    const rebuilt = buildVCard(card);
    expect(rebuilt.startsWith('BEGIN:VCARD\r\n')).toBe(true);
    expect(rebuilt.endsWith('END:VCARD\r\n')).toBe(true);

    const again = parseVCards(rebuilt)[0]!;
    expect(again.name).toBe('Ada Lovelace');
    expect(again.emails).toEqual(['ada@example.com']);
    expect(again.phones).toEqual(['+441234']);
  });

  it('escapes separators so values survive a round trip', () => {
    const card = parseVCards('BEGIN:VCARD\nFN:Semi;colon\\, comma\nEND:VCARD')[0]!;
    const rebuilt = buildVCard(card);
    expect(rebuilt).toContain('FN:Semi\\;colon\\, comma');
    expect(parseVCards(rebuilt)[0]!.name).toBe('Semi;colon, comma');
  });

  it('synthesises N and FN lines when the card had neither', () => {
    const card = parseVCards('BEGIN:VCARD\nTEL:555\nEND:VCARD')[0]!;
    const rebuilt = buildVCard(card);
    expect(rebuilt).toContain('FN:');
    expect(rebuilt).toContain('N:');
  });
});

describe('small helpers', () => {
  it('makes file-name-safe stems', () => {
    expect(vcardStem('Ada Lovelace')).toBe('ada-lovelace');
    expect(vcardStem('Jörg Müller')).toBe('jorg-muller');
    expect(vcardStem('!!!')).toBe('contact');
    expect(vcardStem('')).toBe('contact');
  });

  it('decodes quoted-printable bytes', () => {
    expect(decodeQuotedPrintable('=48=65=6C=6C=6F')).toBe('Hello');
    expect(decodeQuotedPrintable('A=C3=A9B')).toBe('AéB');
    expect(decodeQuotedPrintable('soft=\nbreak')).toBe('softbreak');
  });

  it('unescapes vCard text escapes', () => {
    expect(unescapeVCardText('a\\, b\\; c\\nd')).toBe('a, b; c\nd');
    expect(unescapeVCardText('trailing\\')).toBe('trailing\\');
  });
});
