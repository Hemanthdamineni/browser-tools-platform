import { describe, expect, it } from 'vitest';
import { detectContainer, MAX_HEIC_BYTES, readFtypBox, type HeifContainer } from './heic-container';

/** Build one ISO-BMFF box: 4-byte size, 4-byte type, payload. */
function box(type: string, payload: Uint8Array, sizeOverride?: number): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, sizeOverride ?? out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  return out;
}

/** Build a `ftyp` box with a major brand and a list of compatible brands. */
function ftyp(
  major: string,
  compatible: string[] = [],
  minor = 0,
  sizeOverride?: number,
): Uint8Array {
  const payload = new Uint8Array(8 + compatible.length * 4);
  const view = new DataView(payload.buffer);
  for (let i = 0; i < 4; i++) payload[i] = major.charCodeAt(i);
  view.setUint32(4, minor);
  compatible.forEach((brand, index) => {
    for (let i = 0; i < 4; i++) payload[8 + index * 4 + i] = brand.charCodeAt(i);
  });
  return box('ftyp', payload, sizeOverride);
}

/** Concatenate boxes into one file. */
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

describe('readFtypBox', () => {
  it('reads the major brand, the minor version and the compatible brands', () => {
    const parsed = readFtypBox(ftyp('heic', ['mif1', 'miaf'], 0x2000))!;
    expect(parsed.majorBrand).toBe('heic');
    expect(parsed.compatibleBrands).toEqual(['mif1', 'miaf']);
  });

  it('finds the ftyp box when another box comes first', () => {
    const bytes = concat(box('free', new Uint8Array(4)), ftyp('heic'));
    expect(readFtypBox(bytes)?.majorBrand).toBe('heic');
  });

  it('skips a box that uses a 64-bit size', () => {
    // size === 1 means the real 64-bit length follows the box type.
    const wide = new Uint8Array(20);
    const view = new DataView(wide.buffer);
    view.setUint32(0, 1);
    for (let i = 0; i < 4; i++) wide[4 + i] = 'free'.charCodeAt(i);
    view.setUint32(8, 0);
    view.setUint32(12, wide.length);
    const bytes = concat(wide, ftyp('heic'));
    expect(readFtypBox(bytes)?.majorBrand).toBe('heic');
  });

  it('treats a size of zero as "until the end of the file"', () => {
    const bytes = ftyp('heic', ['mif1'], 0, 0);
    expect(readFtypBox(bytes)?.compatibleBrands).toEqual(['mif1']);
  });

  it('returns null when the file has no ftyp box', () => {
    expect(readFtypBox(box('mdat', new Uint8Array(16)))).toBeNull();
  });

  it('returns null for a truncated ftyp box', () => {
    const bytes = ftyp('heic').slice(0, 10);
    expect(readFtypBox(bytes)).toBeNull();
  });

  it('returns null for an empty file', () => {
    expect(readFtypBox(new Uint8Array(0))).toBeNull();
  });

  it('ignores NUL padding in the compatible brand list', () => {
    const bytes = ftyp('heic', ['mif1']);
    // Overwrite the last compatible-brand slot with NUL bytes.
    bytes.set([0, 0, 0, 0], bytes.length - 4);
    expect(readFtypBox(bytes)?.compatibleBrands).toEqual([]);
  });
});

describe('detectContainer', () => {
  const cases: [string, string[], HeifContainer][] = [
    ['heic', [], 'heic'],
    ['heix', [], 'heic'],
    ['mif1', ['heic'], 'heic'],
    ['mif1', [], 'heif'],
    ['msf1', [], 'heif'],
    ['avif', [], 'avif'],
    ['avis', [], 'avif'],
    ['mif1', ['avif'], 'avif'],
    ['qt  ', [], 'unknown'],
  ];

  for (const [major, compatible, expected] of cases) {
    it(`reports ${major} (${compatible.join(',') || 'no compatible brands'}) as ${expected}`, () => {
      expect(detectContainer(ftyp(major, compatible))).toBe(expected);
    });
  }

  it('reports a JPEG as unknown', () => {
    expect(detectContainer(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe('unknown');
  });

  it('reports plain text as unknown', () => {
    expect(detectContainer(new TextEncoder().encode('this is not a HEIC file'))).toBe('unknown');
  });

  it('reports an empty file as unknown', () => {
    expect(detectContainer(new Uint8Array(0))).toBe('unknown');
  });
});

describe('MAX_HEIC_BYTES', () => {
  it('caps a single file at 64 MB', () => {
    expect(MAX_HEIC_BYTES).toBe(64 * 1024 * 1024);
  });
});
