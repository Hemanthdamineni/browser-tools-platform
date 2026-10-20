import { describe, it, expect } from 'vitest';
import {
  encodeDataMatrix,
  utf8Bytes,
  encodate,
  rsEncode,
  DATAMATRIX_MAX_BYTES,
} from './datamatrix';

/* ------------------------------------------------------------------ helpers */

/** Row-major bits packed four-per-nibble into a hex string (padded within each row). */
function toHex(matrix: Uint8Array, size: number): string {
  let out = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c += 4) {
      let v = 0;
      for (let k = 0; k < 4; k++) {
        const col = c + k;
        v = (v << 1) | (col < size ? matrix[r * size + col]! : 0);
      }
      out += v.toString(16);
    }
  }
  return out;
}

/** FNV-1a hash over the module bytes — a compact whole-symbol fingerprint. */
function fnv(matrix: Uint8Array): string {
  let h = 0x811c9dc5;
  for (const b of matrix) {
    h ^= b & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------- goldens */

// Golden values were produced by the reference encoder that was verified
// byte-for-byte against bwip-js and round-tripped through the ZXing decoder
// for every symbol size. They anchor this port to that verification.
describe('encodeDataMatrix golden matrices', () => {
  it('builds the exact 10×10 symbol for "A"', () => {
    const { size, matrix } = encodeDataMatrix('A');
    expect(size).toBe(10);
    expect(toHex(matrix, size)).toBe('aa8cbc8c09cca609ec978b0c818ffc');
  });

  it('builds the exact 12×12 symbol for "Hello"', () => {
    const { size, matrix } = encodeDataMatrix('Hello');
    expect(size).toBe(12);
    expect(toHex(matrix, size)).toBe('aaab6bc68ed9f10f7f982cf7f06ae5d6afff');
  });

  it('encodes digit pairs (130+value) for "12345678"', () => {
    const { size, matrix } = encodeDataMatrix('12345678');
    expect(size).toBe(12);
    expect(toHex(matrix, size)).toBe('aaac95c80c1fe22b6bd94d4d9a2dedfeafff');
  });

  it('matches the whole-symbol fingerprint across every region layout', () => {
    const cases: [string, number, string][] = [
      ['A', 10, '22443031'],
      ['Hello', 12, 'e15c9f1f'],
      ['12345678', 12, '4550e502'],
      ['X'.repeat(50), 32, 'c26e5317'], // first 2×2 region layout
      ['X'.repeat(180), 52, '432d1e75'], // first multi-block Reed-Solomon layout
      ['X'.repeat(250), 64, '0ffbf1a6'], // 4×4 regions
      ['X'.repeat(700), 104, 'd42826fb'], // 6 blocks
      ['X'.repeat(1400), 144, '2c8dd77d'], // 144×144, mixed 8+2 blocks
    ];
    for (const [text, size, hash] of cases) {
      const dm = encodeDataMatrix(text);
      expect(dm.size, `size for ${text.length} chars`).toBe(size);
      expect(fnv(dm.matrix), `hash for ${text.length} chars`).toBe(hash);
    }
  });
});

/* ---------------------------------------------------------- structure */

describe('encodeDataMatrix structure', () => {
  it('fills exactly size² modules with 0/1', () => {
    const { size, matrix } = encodeDataMatrix('SKU-2024-A17');
    expect(matrix.length).toBe(size * size);
    expect([...matrix].every((v) => v === 0 || v === 1)).toBe(true);
  });

  it('draws the ECC200 finder pattern for a single region', () => {
    const { size, matrix } = encodeDataMatrix('A'); // 10×10, region 8×8
    const at = (r: number, c: number) => matrix[r * size + c];
    for (let i = 0; i < size; i++) {
      expect(at(size - 1, i), `solid bottom row @${i}`).toBe(1);
      expect(at(i, 0), `solid left column @${i}`).toBe(1);
      expect(at(0, i), `alt top row @${i}`).toBe(i % 2 === 0 ? 1 : 0);
      expect(at(i, size - 1), `alt right column @${i}`).toBe(i % 2 === 1 ? 1 : 0);
    }
  });

  it('draws solid separators between regions in a 2×2 layout', () => {
    const { size, matrix } = encodeDataMatrix('X'.repeat(50)); // 32×32, 2×2 regions of 14
    for (let c = 0; c < size; c++) expect(matrix[15 * size + c]).toBe(1); // horizontal separator row
    for (let r = 0; r < size; r++) expect(matrix[r * size + 16]).toBe(1); // vertical separator column
    // and the alternating (clock-track) lines on the outer edges
    for (let i = 0; i < size; i++) {
      expect(matrix[0 * size + i]).toBe(i % 2 === 0 ? 1 : 0); // top edge, alternating
      expect(matrix[i * size + 15]).toBe(i % 2 === 1 ? 1 : 0); // col 15, alternating
    }
  });

  it('picks the smallest symbol that fits', () => {
    expect(encodeDataMatrix('A'.repeat(3)).size).toBe(10);
    expect(encodeDataMatrix('A'.repeat(4)).size).toBe(12);
    expect(encodeDataMatrix('A'.repeat(44)).size).toBe(26);
    expect(encodeDataMatrix('A'.repeat(45)).size).toBe(32);
    expect(encodeDataMatrix('A'.repeat(174)).size).toBe(48);
    expect(encodeDataMatrix('A'.repeat(175)).size).toBe(52);
  });

  it('accepts text that fills the largest symbol and rejects anything bigger', () => {
    expect(encodeDataMatrix('A'.repeat(DATAMATRIX_MAX_BYTES)).size).toBe(144);
    expect(() => encodeDataMatrix('A'.repeat(DATAMATRIX_MAX_BYTES + 1))).toThrow(/too large/i);
  });

  it('uses digit-pair packing, so digits fit in roughly half the codewords', () => {
    // 20 digits ≈ 10 codewords → a 10×10 (dataCW 3) is too small, 14×14 (8) too, 16×16 (12) fits.
    expect(encodeDataMatrix('1'.repeat(20)).size).toBe(16);
  });
});

/* -------------------------------------------------------- encodation */

describe('utf8Bytes / encodate', () => {
  it('encodes ASCII, 2-, 3- and 4-byte sequences', () => {
    expect(utf8Bytes('A')).toEqual([65]);
    expect(utf8Bytes('é')).toEqual([195, 169]);
    expect(utf8Bytes('€')).toEqual([226, 130, 172]);
    expect(utf8Bytes('😀')).toEqual([240, 159, 152, 128]);
  });

  it('round-trips bytes through a UTF-8 decode', () => {
    const samples = ['Hello', 'Ünïcödé', '日本語', 'π≈3.14159', 'a😀b'];
    for (const s of samples) {
      expect(new TextDecoder().decode(Uint8Array.from(utf8Bytes(s)))).toBe(s);
    }
  });

  it('packs digit pairs into 130+value', () => {
    // "00" → 130, "99" → 229, then pad to 3 codewords.
    expect(encodate('0099', 3)).toEqual([130, 229, 129]);
  });

  it('uses upper shift (235) for bytes ≥ 128', () => {
    // 'é' = 0xC3 0xA9 → 235, 0x44 (=195-127=68?) computed: 195-127=68, 169-127=42
    expect(encodate('é', 4)).toEqual([235, 68, 235, 42]);
  });

  it('pads short data with the alternating randomising pad', () => {
    expect(encodate('A', 4)).toEqual([66, 129, 130, 129]);
  });
});

/* --------------------------------------------------- reed-solomon */

describe('rsEncode', () => {
  it('produces the known ECC200 ECC for a small block', () => {
    // Reference ECC codewords for data [142, 164, 186] (3 CW, 5 ECC) per ECC200.
    const ecc = rsEncode(Uint8Array.from([142, 164, 186]), 5);
    expect([...ecc]).toEqual([114, 25, 5, 88, 102]);
  });

  it('is all zero when there is no ECC', () => {
    expect([...rsEncode(Uint8Array.from([1, 2, 3]), 0)]).toEqual([]);
  });
});
