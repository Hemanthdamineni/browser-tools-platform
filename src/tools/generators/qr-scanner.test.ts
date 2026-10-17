import { describe, it, expect, afterEach } from 'vitest';
import qrcode from 'qrcode-generator';
import { installImageMock, makeFile } from '../image/image-mock';
import tool from './qr-scanner.tool';
import {
  classifyPayload,
  parseEmail,
  parseGeo,
  parseOtp,
  parseSms,
  parseVCard,
  parseWifi,
  payloadActions,
  preview,
} from './qr-payload';
import {
  CAMERA_MAX_EDGE,
  describeCameraError,
  detectCodes,
  detectCodesInRgba,
  nativeDetectorAvailable,
  rasterizeToRgba,
  type RgbaImage,
} from './qr-decode';
import { summariseCodes, type CodeSummary } from './qr-scanner.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const WIFI = 'WIFI:T:WPA;S:Cafe\\;Nerd;P:p\\:a\\;ss;H:true;;';
const VCARD = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'N:Lovelace;Ada;;;',
  'FN:Ada Lovelace',
  'ORG:Analytical Engines',
  'TITLE:Mathematician',
  'EMAIL;TYPE=INTERNET:ada@example.com',
  'TEL;TYPE=CELL:+44 20 7946 0000',
  'ADR;TYPE=HOME:;;12 St James Sq;London;;SW1Y 4LE;UK',
  'END:VCARD',
].join('\r\n');

/** Render a real QR code into an RGBA buffer — no canvas required. */
function qrRaster(
  payload: string,
  {
    scale = 6,
    margin = 8,
    invert = false,
    ecc = 'M',
  }: { scale?: number; margin?: number; invert?: boolean; ecc?: 'L' | 'M' | 'Q' | 'H' } = {},
): RgbaImage {
  const qr = qrcode(0, ecc);
  qr.addData(payload);
  qr.make();
  const count = qr.getModuleCount();
  const size = (count + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  const background = invert ? 0 : 255;
  const foreground = invert ? 255 : 0;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = background;
    data[i + 1] = background;
    data[i + 2] = background;
    data[i + 3] = 255;
  }
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = ((row + margin) * scale + y) * size + ((col + margin) * scale + x);
          const o = px * 4;
          data[o] = foreground;
          data[o + 1] = foreground;
          data[o + 2] = foreground;
          data[o + 3] = 255;
        }
      }
    }
  }
  return { data, width: size, height: size };
}

interface FakeBarcode {
  rawValue: string;
  format: string;
}
interface FakeDetectorConfig {
  codes?: FakeBarcode[];
  supported?: string[];
  /** Constructor throws when handed a format list (bad-format robustness). */
  throwOnFormats?: boolean;
}

const restorers: (() => void)[] = [];
afterEach(() => {
  while (restorers.length) restorers.pop()!();
});

function install<T>(key: string, value: T): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  restorers.push(() => {
    if (original) Object.defineProperty(globalThis, key, original);
    else delete (globalThis as Record<string, unknown>)[key];
  });
}

/** Fake BarcodeDetector; records the format list each instance was built with. */
function installBarcodeDetector(config: FakeDetectorConfig = {}): { formats: (string[] | null)[] } {
  const formats: (string[] | null)[] = [];
  class FakeDetector {
    static async getSupportedFormats(): Promise<string[]> {
      return config.supported ?? ['qr_code', 'ean_13'];
    }
    constructor(options?: { formats?: string[] }) {
      if (config.throwOnFormats && options?.formats) throw new TypeError('unsupported format');
      formats.push(options?.formats ?? null);
    }
    async detect(): Promise<FakeBarcode[]> {
      return config.codes ?? [];
    }
  }
  install('BarcodeDetector', FakeDetector);
  return { formats };
}

/** Fake OffscreenCanvas returning a prepared raster from getImageData(). */
function installRasterCanvas(raster: RgbaImage): void {
  class FakeOffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(): unknown {
      return {
        drawImage: () => undefined,
        getImageData: () => ({ data: raster.data, width: raster.width, height: raster.height }),
      };
    }
  }
  install('OffscreenCanvas', FakeOffscreenCanvas);
}

const runTool = (files: File[], options: Record<string, string | number | boolean> = {}) =>
  tool.run({ files, options });

/* -------------------------------------------------------------------------- */
/*  Payload classification                                                    */
/* -------------------------------------------------------------------------- */

describe('classifyPayload — links', () => {
  it('recognises HTTPS URLs and normalises them', () => {
    const p = classifyPayload('https://example.com/a?b=1');
    expect(p.kind).toBe('url');
    expect(p.canOpen).toBe(true);
    expect(p.href).toBe('https://example.com/a?b=1');
    expect(p.fields).toContainEqual({ label: 'Host', value: 'example.com' });
  });

  it('assumes https:// for a scheme-less domain and says so', () => {
    const p = classifyPayload('example.com/docs');
    expect(p.kind).toBe('url');
    expect(p.href).toBe('https://example.com/docs');
    expect(p.warnings.join(' ')).toMatch(/no scheme/i);
  });

  it('refuses to make javascript: and data: links openable', () => {
    for (const raw of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:msgbox(1)']) {
      const p = classifyPayload(raw);
      expect(p.kind).toBe('url');
      expect(p.canOpen).toBe(false);
      expect(p.href).toBeUndefined();
      expect(p.warnings.join(' ')).toMatch(/not safe to open/i);
    }
    expect(
      payloadActions(classifyPayload('javascript:alert(1)')).some((a) => a.id === 'open'),
    ).toBe(false);
  });

  it('keeps an unknown-but-harmless scheme out of the open list', () => {
    const p = classifyPayload('ftp://files.example.com/x.zip');
    expect(p.canOpen).toBe(false);
    expect(p.warnings.join(' ')).toMatch(/ftp/);
  });
});

describe('classifyPayload — Wi-Fi', () => {
  it('parses escapes, hidden flag and security', () => {
    const wifi = parseWifi(WIFI);
    expect(wifi).not.toBeNull();
    expect(wifi!.ssid).toBe('Cafe;Nerd');
    expect(wifi!.password).toBe('p:a;ss');
    expect(wifi!.security).toBe('WPA');
    expect(wifi!.securityLabel).toBe('WPA / WPA2 / WPA3');
    expect(wifi!.hidden).toBe(true);
  });

  it('does not treat a non-Wi-Fi payload as Wi-Fi', () => {
    expect(parseWifi('https://example.com')).toBeNull();
    expect(parseWifi('WIFI:')).toBeNull();
  });

  it('flags an open network and offers no password action', () => {
    const p = classifyPayload('WIFI:T:nopass;S:FreeWiFi;;');
    expect(p.kind).toBe('wifi');
    expect(p.fields).toContainEqual({ label: 'Security', value: 'Open (no password)' });
    const actions = payloadActions(p);
    expect(actions.some((a) => a.id === 'copy-password')).toBe(false);
    expect(actions.find((a) => a.id === 'copy')?.value).toBe('FreeWiFi');
  });

  it('offers a copy-password action for a protected network', () => {
    const actions = payloadActions(classifyPayload(WIFI));
    expect(actions.find((a) => a.id === 'copy-password')?.value).toBe('p:a;ss');
    expect(actions.some((a) => a.label === 'Copy network name')).toBe(true);
  });
});

describe('classifyPayload — vCard', () => {
  it('extracts contact fields and a summary', () => {
    const card = parseVCard(VCARD);
    expect(card).not.toBeNull();
    expect(card!.fullName).toBe('Ada Lovelace');
    expect(card!.emails).toEqual(['ada@example.com']);
    expect(card!.phones).toEqual(['+44 20 7946 0000']);
    const labels = card!.fields.map((f) => f.label);
    for (const label of ['Name', 'Organization', 'Job title', 'Email', 'Phone', 'Address']) {
      expect(labels).toContain(label);
    }
    const p = classifyPayload(VCARD);
    expect(p.kind).toBe('vcard');
    expect(p.summary).toContain('Ada Lovelace');
    expect(p.canOpen).toBe(false);
  });

  it('decodes a vCard 2.1 quoted-printable email', () => {
    const card = parseVCard(
      [
        'BEGIN:VCARD',
        'VERSION:2.1',
        'FN:Grace Hopper',
        'EMAIL;ENCODING=QUOTED-PRINTABLE:grace=40navy.mil',
        'END:VCARD',
      ].join('\r\n'),
    );
    expect(card!.emails).toEqual(['grace@navy.mil']);
  });

  it('does not treat arbitrary text as a vCard', () => {
    expect(parseVCard('hello world')).toBeNull();
  });
});

describe('classifyPayload — email, phone, SMS, geo, OTP, text', () => {
  it('parses mailto: with subject and body', () => {
    const mail = parseEmail('mailto:a@b.io?subject=Hi%20there&body=Hello');
    expect(mail).toEqual({ to: ['a@b.io'], cc: [], subject: 'Hi there', body: 'Hello' });
    const p = classifyPayload('mailto:a@b.io?subject=Hi');
    expect(p.kind).toBe('email');
    expect(p.href).toBe('mailto:a@b.io');
    expect(payloadActions(p).some((a) => a.id === 'open')).toBe(true);
  });

  it('parses MATMSG and bare addresses as email', () => {
    expect(parseEmail('MATMSG:TO:a@b.io;SUB:Hey;BODY:Yo;;')).toEqual({
      to: ['a@b.io'],
      cc: [],
      subject: 'Hey',
      body: 'Yo',
    });
    const bare = classifyPayload('ada@example.com');
    expect(bare.kind).toBe('email');
    expect(bare.href).toBe('mailto:ada@example.com');
  });

  it('parses tel: and a bare +number as phone', () => {
    const p = classifyPayload('tel:+15551234567');
    expect(p.kind).toBe('phone');
    expect(p.href).toBe('tel:+15551234567');
    expect(payloadActions(p).find((a) => a.id === 'copy')?.value).toBe('+15551234567');

    const bare = classifyPayload('+31 6 1234 5678');
    expect(bare.kind).toBe('phone');
    expect(bare.href).toBe('tel:+31612345678');
  });

  it('parses SMSTO:, sms: query form and comma form', () => {
    expect(parseSms('SMSTO:+15551234:See you at 5')).toEqual({
      to: '+15551234',
      body: 'See you at 5',
    });
    expect(parseSms('sms:+15551234?body=hi')).toEqual({ to: '+15551234', body: 'hi' });
    expect(parseSms('sms:+15551234,+15559999')).toEqual({
      to: '+15551234',
      body: '+15559999',
    });
    const p = classifyPayload('smsto:+15551234:hi');
    expect(p.kind).toBe('sms');
    expect(p.href).toBe('sms:+15551234');
  });

  it('parses geo coordinates and a place query', () => {
    expect(parseGeo('geo:52.3702,4.8952,10?z=15')).toMatchObject({
      lat: '52.3702',
      lon: '4.8952',
      zoom: '15',
    });
    const place = classifyPayload('geo:0,0?q=Amsterdam+Centraal');
    expect(place.kind).toBe('geo');
    expect(place.fields).toContainEqual({ label: 'Place', value: 'Amsterdam Centraal' });
    expect(place.canOpen).toBe(true);
    expect(parseGeo('https://example.com')).toBeNull();
  });

  it('parses an otpauth setup URI and warns about the secret', () => {
    const otp = parseOtp(
      'otpauth://totp/GitHub:ada?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6',
    );
    expect(otp).toMatchObject({
      type: 'totp',
      issuer: 'GitHub',
      account: 'ada',
      secret: 'JBSWY3DPEHPK3PXP',
      digits: '6',
      period: '30',
    });
    const p = classifyPayload('otpauth://totp/GitHub:ada?secret=JBSWY3DPEHPK3PXP');
    expect(p.kind).toBe('otp');
    expect(p.warnings.join(' ')).toMatch(/shared secret/i);
    expect(payloadActions(p).find((a) => a.id === 'copy-secret')?.value).toBe('JBSWY3DPEHPK3PXP');
    expect(parseOtp('https://example.com')).toBeNull();
  });

  it('falls back to plain text for anything else, including empty payloads', () => {
    const p = classifyPayload('Hello, world!');
    expect(p.kind).toBe('text');
    expect(p.summary).toBe('Hello, world!');
    expect(payloadActions(p)).toEqual([{ id: 'copy', label: 'Copy text', value: 'Hello, world!' }]);

    const empty = classifyPayload('   ');
    expect(empty.kind).toBe('text');
    expect(empty.summary).toBe('(empty)');
    expect(empty.fields).toEqual([]);
  });

  it('preview() collapses whitespace and truncates', () => {
    expect(preview('a\n\nb   c')).toBe('a b c');
    expect(preview('x'.repeat(50), 10)).toBe('xxxxxxxxx…');
  });
});

/* -------------------------------------------------------------------------- */
/*  Decode pipeline                                                           */
/* -------------------------------------------------------------------------- */

describe('decode pipeline', () => {
  it('decodes a real QR raster with the fallback decoder', async () => {
    const raw = 'https://example.com/scanned?x=1';
    const outcome = await detectCodesInRgba(qrRaster(raw));
    expect(outcome.nativeAvailable).toBe(false);
    expect(outcome.backend).toBe('fallback');
    expect(outcome.codes).toHaveLength(1);
    expect(outcome.codes[0]!.raw).toBe(raw);
    expect(outcome.codes[0]!.format).toBe('qr_code');
    expect(classifyPayload(outcome.codes[0]!.raw).kind).toBe('url');
  });

  it('decodes a Wi-Fi payload end to end', async () => {
    const outcome = await detectCodesInRgba(qrRaster(WIFI));
    expect(outcome.codes[0]!.raw).toBe(WIFI);
    expect(classifyPayload(outcome.codes[0]!.raw).kind).toBe('wifi');
  });

  it('reads inverted (light-on-dark) codes when inversion is enabled', async () => {
    const raw = 'https://example.com/inverted';
    const enabled = await detectCodesInRgba(qrRaster(raw, { invert: true }), { invert: true });
    expect(enabled.codes.map((c) => c.raw)).toEqual([raw]);

    const disabled = await detectCodesInRgba(qrRaster(raw, { invert: true }), { invert: false });
    expect(disabled.codes).toHaveLength(0);
  });

  it('returns nothing for a raster with no code in it', async () => {
    const blank: RgbaImage = {
      data: new Uint8ClampedArray(64 * 64 * 4).fill(255),
      width: 64,
      height: 64,
    };
    const outcome = await detectCodesInRgba(blank);
    expect(outcome.codes).toEqual([]);
    expect(outcome.backend).toBe('none');
  });

  it('prefers the native detector and returns every code it reports', async () => {
    const fake = installBarcodeDetector({
      supported: ['qr_code', 'ean_13'],
      codes: [
        { rawValue: 'https://example.com', format: 'qr_code' },
        { rawValue: '4006381333931', format: 'ean_13' },
      ],
    });
    const outcome = await detectCodes(
      { width: 10, height: 10 },
      { formats: ['qr_code', 'ean_13', 'itf'] },
    );
    expect(outcome.backend).toBe('native');
    expect(outcome.nativeAvailable).toBe(true);
    expect(outcome.codes.map((c) => c.raw)).toEqual(['https://example.com', '4006381333931']);
    // Requested formats are filtered down to what the platform actually supports.
    expect(fake.formats).toEqual([['qr_code', 'ean_13']]);
  });

  it('survives a detector that rejects a format list', async () => {
    const fake = installBarcodeDetector({
      throwOnFormats: true,
      codes: [{ rawValue: 'hello', format: 'qr_code' }],
    });
    const outcome = await detectCodes({ width: 10, height: 10 });
    expect(outcome.codes[0]!.raw).toBe('hello');
    // First attempt with formats throws, so it retries with no options.
    expect(fake.formats).toEqual([null]);
  });

  it('falls back to the software decoder when the native detector finds nothing', async () => {
    const raw = 'https://example.com/fallback';
    installBarcodeDetector({ codes: [] });
    installRasterCanvas(qrRaster(raw));
    const outcome = await detectCodes({ width: 400, height: 400 }, { maxEdge: CAMERA_MAX_EDGE });
    expect(outcome.nativeAvailable).toBe(true);
    expect(outcome.backend).toBe('fallback');
    expect(outcome.codes[0]!.raw).toBe(raw);
  });

  it('explains itself when no decoder is usable and the fallback is off', async () => {
    expect(nativeDetectorAvailable()).toBe(false);
    await expect(detectCodes({ width: 10, height: 10 }, { tryFallback: false })).rejects.toThrow(
      /no built-in barcode detector/i,
    );
  });

  it('rejects a source with no readable dimensions', () => {
    expect(() => rasterizeToRgba({ width: 0, height: 0 })).toThrow(/no readable dimensions/i);
    expect(() => rasterizeToRgba({})).toThrow(/no readable dimensions/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  Camera error mapping                                                      */
/* -------------------------------------------------------------------------- */

describe('describeCameraError', () => {
  it('maps permission denial to actionable guidance', () => {
    const err = describeCameraError(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    expect(err.message).toMatch(/permission was denied/i);
    expect(err.hint).toMatch(/address bar/i);
    expect(err.hint).toMatch(/scan an image below/i);
  });

  it('maps missing hardware, busy hardware and insecure pages', () => {
    expect(describeCameraError({ name: 'NotFoundError' }).message).toMatch(/no camera was found/i);
    expect(describeCameraError({ name: 'NotReadableError' }).message).toMatch(/already in use/i);
    expect(describeCameraError({ name: 'TypeError' }).message).toMatch(/does not expose a camera/i);
    const blocked = describeCameraError({ name: 'SecurityError' });
    expect(blocked.message).toMatch(/blocked/i);
    expect(blocked.hint).toMatch(/secure/i);
    expect(blocked.hint).toMatch(/https/i);
  });

  it('never returns an empty message for an unknown failure', () => {
    const err = describeCameraError({ name: 'WeirdError', message: 'boom' });
    expect(err.message).toBe('boom');
    expect(err.hint).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/*  Tool run()                                                                */
/* -------------------------------------------------------------------------- */

describe('qr-scanner run()', () => {
  it('requires at least one file', async () => {
    await expect(runTool([])).rejects.toThrow(/choose an image/i);
  });

  it('rejects non-image files', async () => {
    await expect(runTool([makeFile('notes.txt', 'text/plain', 10)])).rejects.toThrow(
      /is not an image/i,
    );
  });

  it('rejects an empty file', async () => {
    await expect(runTool([makeFile('empty.png', 'image/png', 0)])).rejects.toThrow(/is empty/i);
  });

  it('rejects an image above the byte limit instead of crashing', async () => {
    const huge = makeFile('huge.png', 'image/png', 26 * 1024 * 1024);
    await expect(runTool([huge])).rejects.toThrow(/too large to scan/i);
  });

  it('reports a friendly error when no code is present', async () => {
    const image = installImageMock({ width: 120, height: 120 });
    restorers.push(() => image.restore());
    installBarcodeDetector({ codes: [] });
    await expect(runTool([makeFile('blank.png')], { tryFallback: false })).rejects.toThrow(
      /no code found/i,
    );
  });

  it('reports a friendly error for an oversized bitmap', async () => {
    const image = installImageMock({ width: 12_000, height: 12_000 });
    restorers.push(() => image.restore());
    await expect(runTool([makeFile('poster.png')])).rejects.toThrow(/too large to scan safely/i);
  });

  it('builds a table report from a native multi-code result', async () => {
    const image = installImageMock({ width: 800, height: 600 });
    restorers.push(() => image.restore());
    installBarcodeDetector({
      codes: [
        { rawValue: 'https://example.com/a', format: 'qr_code' },
        { rawValue: WIFI, format: 'qr_code' },
      ],
    });

    const result = await runTool([makeFile('codes.png')], { formats: 'qr' });
    expect(result.outputs).toEqual([]);
    expect(result.report?.render).toBe('table');
    const table = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual(['#', 'Type', 'Field', 'Value']);
    const flat = table.rows.map((r) => r.join('|'));
    expect(flat.some((r) => r.startsWith('1|URL|'))).toBe(true);
    expect(flat.some((r) => r.includes('Link|https://example.com/a'))).toBe(true);
    expect(flat.some((r) => r.startsWith('2|Wi-Fi network|'))).toBe(true);
    expect(flat.some((r) => r.includes('SSID|Cafe;Nerd'))).toBe(true);
    expect(flat.some((r) => r.includes('Security|WPA'))).toBe(true);
    expect(flat.some((r) => r.includes('Password|p:a;ss'))).toBe(true);
    expect(result.stats?.['Codes found']).toBe(2);
    expect(result.warnings?.join(' ')).toMatch(/openable link/i);
    expect(result.notes?.join(' ')).toMatch(/never uploaded/i);
  });

  it('carries the file bitmap through to the fallback decoder', async () => {
    const image = installImageMock({ width: 400, height: 400 });
    restorers.push(() => image.restore());
    const raw = 'https://example.com/from-file';
    installBarcodeDetector({ codes: [] });
    installRasterCanvas(qrRaster(raw));

    const result = await runTool([makeFile('photo.png')], { formats: 'qr' });
    const table = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(table.rows.flat().join('|')).toContain(raw);
    expect(result.stats?.Decoder).toMatch(/jsQR/);
  });

  it('accepts several images and lists the ones without a code', async () => {
    const image = installImageMock({ width: 300, height: 300 });
    restorers.push(() => image.restore());
    // First call finds a code, the second finds nothing.
    let call = 0;
    install(
      'BarcodeDetector',
      class {
        static async getSupportedFormats(): Promise<string[]> {
          return ['qr_code'];
        }
        async detect(): Promise<FakeBarcode[]> {
          call += 1;
          return call === 1 ? [{ rawValue: 'plain text payload', format: 'qr_code' }] : [];
        }
      },
    );

    const result = await runTool([makeFile('a.png'), makeFile('b.png')], { tryFallback: false });
    expect(result.stats?.['Codes found']).toBe(1);
    expect(result.notes?.join(' ')).toMatch(/No code found in: b\.png/);
  });

  it('summariseCodes groups fields under their code', () => {
    const entry: CodeSummary = {
      file: 'a.png',
      code: { raw: 'mailto:a@b.io', format: 'qr_code' },
      typeLabel: 'Email address',
      summary: 'to a@b.io',
      fields: [{ label: 'To', value: 'a@b.io' }],
      warnings: ['heads up'],
    };
    expect(summariseCodes([entry])).toEqual([
      ['1', 'Email address', 'Format', 'qr_code'],
      ['', '', 'To', 'a@b.io'],
      ['', '⚠', 'Note', 'heads up'],
    ]);
  });
});
