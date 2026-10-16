import { describe, it, expect } from 'vitest';
import type { TextRunResult } from '@/lib/types';
import tool, {
  CODE128_PATTERNS,
  gtinCheckDigit,
  encodeCode128,
  encodeCode39,
  encodeEan13,
  encodeEan8,
  encodeUpcA,
  encodeItf,
  buildBarcode,
  renderSvg,
  svgDataUri,
} from './barcode.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as TextRunResult;

const decodeSvg = (uri: string) => atob(uri.split(',')[1]!);

/* ----------------------------- helpers (test-only) ----------------------------- */

/** Expand a Code 128 width pattern into its module bit-string. */
function expand128(widths: string): string {
  let out = '';
  for (let i = 0; i < widths.length; i++) {
    out += (i % 2 === 0 ? '1' : '0').repeat(widths.charCodeAt(i) - 48);
  }
  return out;
}

// Independent pattern→value lookup built from the declared table.
const CODE128_VALUES = new Map<string, number>();
CODE128_PATTERNS.forEach((p, i) => CODE128_VALUES.set(expand128(p), i));

/** Decode a Code 128 module string, returning { start, data, check }. */
function decodeCode128(modules: string): { start: number; data: number[]; check: number } {
  const values: number[] = [];
  let i = 0;
  while (i < modules.length) {
    const width = modules.length - i === 13 ? 13 : 11;
    const chunk = modules.slice(i, i + width);
    const value = CODE128_VALUES.get(chunk);
    expect(value, `unknown Code 128 chunk at ${i}: "${chunk}"`).toBeDefined();
    values.push(value!);
    i += width;
  }
  expect(values.pop()).toBe(106); // STOP
  const check = values.pop()!;
  const start = values.shift()!;
  return { start, data: values, check };
}

/* ------------------------------- gtin check digit ------------------------------- */

describe('gtinCheckDigit', () => {
  it('matches known EAN-13, UPC-A and ITF-14 values', () => {
    expect(gtinCheckDigit('400638133393')).toBe(1); // EAN-13 4006381333931
    expect(gtinCheckDigit('03600029145')).toBe(2); // UPC-A 036000291452
    expect(gtinCheckDigit('9638507')).toBe(4); // EAN-8 96385074
    expect(gtinCheckDigit('1540014128876')).toBe(3); // GTIN-14 data
  });

  it('handles a single digit', () => {
    expect(gtinCheckDigit('0')).toBe(0);
    expect(gtinCheckDigit('1')).toBe(7); // 3×1 = 3 → (10−3) mod 10 = 7
  });
});

/* ---------------------------------- Code 128 ---------------------------------- */

describe('Code 128', () => {
  it('encodes "A" in subset B to a known module string', () => {
    const { modules, start, check } = encodeCode128('A', 'B');
    expect(start).toBe(104);
    expect(check).toBe(34);
    // START B + value(33)="A" + checksum(34) + STOP, verified independently.
    expect(modules).toBe(
      '11010010000' + '10100011000' + '10001011000' + '1100011101011',
    );
  });

  it('round-trips subset B text through a decoder', () => {
    const text = 'Hello, World!';
    const { modules, check } = encodeCode128(text, 'B');
    const decoded = decodeCode128(modules);
    expect(decoded.start).toBe(104);
    expect(decoded.check).toBe(check);
    expect(decoded.data.map((v) => String.fromCharCode(v + 32)).join('')).toBe(text);
    // Verify the checksum the way a scanner would.
    const sum = decoded.start + decoded.data.reduce((acc, v, i) => acc + v * (i + 1), 0);
    expect(sum % 103).toBe(check);
  });

  it('uses subset C for even digit runs and round-trips', () => {
    const { modules, start } = encodeCode128('123456', 'C');
    expect(start).toBe(105);
    const decoded = decodeCode128(modules);
    expect(decoded.start).toBe(105);
    expect(decoded.data.map((v) => String(v).padStart(2, '0')).join('')).toBe('123456');
  });

  it('auto picks C for even digits and B otherwise', () => {
    expect(encodeCode128('1234', 'auto').start).toBe(105);
    expect(encodeCode128('12345', 'auto').start).toBe(104);
    expect(encodeCode128('AB12', 'auto').start).toBe(104);
  });

  it('rejects text in subset C and non-ASCII in B', () => {
    expect(() => encodeCode128('ABC', 'C')).toThrow(/digits/i);
    expect(() => encodeCode128('123', 'C')).toThrow(/even number/i);
    expect(() => encodeCode128('café', 'B')).toThrow(/cannot be encoded/i);
    expect(() => encodeCode128('', 'B')).toThrow(/Enter text/i);
    expect(() => encodeCode128('x'.repeat(201), 'B')).toThrow(/too many/i);
  });
});

/* ---------------------------------- Code 39 ---------------------------------- */

describe('Code 39', () => {
  it('encodes "A" to a known module string with * guards', () => {
    // * = 100101101101, A = 110101001011, one narrow gap between characters.
    expect(encodeCode39('A')).toBe(
      '100101101101' + '0' + '110101001011' + '0' + '100101101101',
    );
  });

  it('rejects characters outside the Code 39 alphabet', () => {
    expect(() => encodeCode39('abc!')).toThrow(/cannot encode/i);
    expect(() => encodeCode39('')).toThrow(/Enter text/i);
  });

  it('uppercases input', () => {
    expect(buildBarcode('code39', 'abc-1').humanText).toBe('ABC-1');
  });
});

/* ------------------------------- EAN / UPC ---------------------------------- */

describe('EAN-13', () => {
  it('appends the check digit and matches a known bit pattern', () => {
    const enc = buildBarcode('ean13', '4006381333931');
    expect(enc.humanText).toBe('4006381333931');
    expect(enc.modules.length).toBe(95);
    const expected =
      '101' +
      '0001101' + '0100111' + '0101111' + '0111101' + '0001001' + '0110011' +
      '01010' +
      '1000010' + '1000010' + '1000010' + '1110100' + '1000010' + '1100110' +
      '101';
    expect(enc.modules).toBe(expected);
    expect([...enc.guard].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94,
    ]);
  });

  it('adds a missing check digit and validates a supplied one', () => {
    expect(buildBarcode('ean13', '400638133393').humanText).toBe('4006381333931');
    expect(() => buildBarcode('ean13', '4006381333939')).toThrow(/check digit/i);
  });

  it('rejects wrong lengths and non-digits', () => {
    expect(() => buildBarcode('ean13', '123')).toThrow(/12 or 13 digits/i);
    expect(() => buildBarcode('ean13', '40063813339A')).toThrow(/not a valid/i);
  });
});

describe('EAN-8', () => {
  it('encodes 96385074 and checks structure', () => {
    const enc = buildBarcode('ean8', '96385074');
    expect(enc.modules.length).toBe(67);
    expect(enc.modules.startsWith('101')).toBe(true);
    expect(enc.modules.endsWith('101')).toBe(true);
    expect(enc.humanText).toBe('96385074');
  });

  it('derives the check digit', () => {
    expect(buildBarcode('ean8', '9638507').humanText).toBe('96385074');
  });
});

describe('UPC-A', () => {
  it('encodes 036000291452 as EAN-13 with a leading zero', () => {
    const enc = buildBarcode('upca', '036000291452');
    expect(enc.humanText).toBe('036000291452');
    expect(enc.modules).toBe(encodeEan13('0036000291452').modules);
    expect(enc.modules.length).toBe(95);
  });

  it('places the outer digits outside the symbol', () => {
    const cells = buildBarcode('upca', '036000291452').cells!;
    expect(cells[0]!.center).toBeLessThan(0);
    expect(cells[cells.length - 1]!.center).toBeGreaterThan(95);
  });
});

/* ------------------------------ Interleaved 2 of 5 ------------------------------ */

describe('Interleaved 2 of 5', () => {
  it('wraps in start/stop guards', () => {
    const modules = encodeItf('1234');
    expect(modules.startsWith('1010')).toBe(true);
    expect(modules.endsWith('1101')).toBe(true);
  });

  it('ITF-14 adds the GTIN check digit', () => {
    const enc = buildBarcode('itf14', '1540014128876');
    expect(enc.humanText).toBe('15400141288763');
    expect(enc.modules.length).toBeGreaterThan(4);
  });

  it('rejects odd-length digit strings', () => {
    expect(() => buildBarcode('itf', '123')).toThrow(/even number/i);
    expect(buildBarcode('itf', '12')).toBeTruthy();
  });
});

/* --------------------------------- rendering --------------------------------- */

describe('renderSvg / run', () => {
  it('produces an image data URI with a filename', () => {
    const result = run('SKU-2024-A17');
    expect(result.render).toBe('image');
    expect(result.output.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(result.filename).toBe('code128-barcode.svg');
    const svg = decodeSvg(result.output);
    expect(svg).toContain('<svg');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<text');
  });

  it('omits the human-readable text when asked', () => {
    const svg = decodeSvg(run('ABC', { showText: false }).output);
    expect(svg).not.toContain('<text');
  });

  it('scales width with module width and height with bar height', () => {
    const w = (opts: Record<string, number>) =>
      Number(decodeSvg(run('ABC', opts).output).match(/width="(\d+)"/)![1]);
    const h = (opts: Record<string, number>) =>
      Number(decodeSvg(run('ABC', opts).output).match(/height="(\d+)"/)![1]);
    expect(w({ moduleWidth: 4 })).toBe(2 * w({ moduleWidth: 2 }));
    expect(h({ height: 160 })).toBeGreaterThan(h({ height: 60 }));
  });

  it('supports a transparent background', () => {
    const svg = decodeSvg(run('ABC', { background: 'none' }).output);
    expect(svg).not.toContain('#ffffff');
  });

  it('validates colours', () => {
    expect(() => run('ABC', { color: 'black' })).toThrow(/hex colour/i);
    expect(() => run('ABC', { background: 'rgb(0,0,0)' })).toThrow(/hex colour/i);
  });

  it('escapes text in the SVG', () => {
    const svg = decodeSvg(run('A<B&C', { symbology: 'code128b' }).output);
    expect(svg).toContain('A&lt;B&amp;C');
    expect(svg).not.toContain('A<B&C');
  });

  it('rejects an unknown symbology', () => {
    expect(() => run('x', { symbology: 'nope' })).toThrow(/unknown symbology/i);
  });

  it('every symbology renders for a valid payload', () => {
    const cases: [string, string][] = [
      ['code128', 'ABC-123'],
      ['code128b', 'Hello'],
      ['code128c', '12345678'],
      ['code39', 'ABC123'],
      ['ean13', '4006381333931'],
      ['ean8', '96385074'],
      ['upca', '036000291452'],
      ['itf14', '1540014128876'],
      ['itf', '1234'],
    ];
    for (const [symbology, text] of cases) {
      const result = run(text, { symbology });
      expect(result.render, symbology).toBe('image');
      expect(result.output.startsWith('data:image/svg+xml;base64,'), symbology).toBe(true);
    }
  });
});

describe('svgDataUri', () => {
  it('round-trips through base64', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    expect(decodeSvg(svgDataUri(svg))).toBe(svg);
  });
});

describe('encodeEan8 helpers', () => {
  it('exposes a stable 67-module structure', () => {
    expect(encodeEan8('96385074').modules.length).toBe(67);
  });
});

describe('buildBarcode renderSvg integration', () => {
  it('positions EAN-13 left digits in text cells', () => {
    const enc = buildBarcode('ean13', '4006381333931');
    const svg = renderSvg(enc, {
      moduleWidth: 2,
      height: 80,
      showText: true,
      quietZone: 10,
      color: '#000000',
      background: '#ffffff',
    });
    expect((svg.match(/<text/g) ?? []).length).toBe(13);
  });

  it('encodeUpcA reuses the EAN-13 encoding', () => {
    expect(encodeUpcA('036000291452').modules).toBe(encodeEan13('0036000291452').modules);
  });
});
