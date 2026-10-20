/**
 * Dependency-free DataMatrix ECC200 encoder (square symbols).
 *
 * Text is carried as UTF-8 bytes using ASCII encodation, with the ECC200
 * "upper shift" (235) for bytes ≥ 128 — the same convention bwip-js and other
 * generators use. This was verified byte-for-byte against bwip-js and
 * round-tripped through the ZXing decoder across every square symbol size
 * (10×10 … 144×144), including the multi-block Reed-Solomon layouts.
 *
 * Only ASCII encodation is implemented: no C40/Text/X12/EDIFACT/Base256
 * compression. That keeps the symbol correct and the code small; symbols are
 * simply a little larger than a fully-optimising encoder would produce.
 */

/** `[count, dataCodewordsPerBlock]`; only 144×144 mixes two block sizes. */
type BlockSpec = [count: number, dataPerBlock: number][];

interface SymbolSpec {
  /** Full symbol edge length in modules. */
  size: number;
  regionRows: number;
  regionCols: number;
  vRegions: number;
  hRegions: number;
  dataCW: number;
  eccCW: number;
  blocks: BlockSpec;
}

/** ECC200 square symbol table (ISO/IEC 16022), smallest first. */
const SPECS: SymbolSpec[] = [
  { size: 10, regionRows: 8, regionCols: 8, vRegions: 1, hRegions: 1, dataCW: 3, eccCW: 5, blocks: [[1, 3]] },
  { size: 12, regionRows: 10, regionCols: 10, vRegions: 1, hRegions: 1, dataCW: 5, eccCW: 7, blocks: [[1, 5]] },
  { size: 14, regionRows: 12, regionCols: 12, vRegions: 1, hRegions: 1, dataCW: 8, eccCW: 10, blocks: [[1, 8]] },
  { size: 16, regionRows: 14, regionCols: 14, vRegions: 1, hRegions: 1, dataCW: 12, eccCW: 12, blocks: [[1, 12]] },
  { size: 18, regionRows: 16, regionCols: 16, vRegions: 1, hRegions: 1, dataCW: 18, eccCW: 14, blocks: [[1, 18]] },
  { size: 20, regionRows: 18, regionCols: 18, vRegions: 1, hRegions: 1, dataCW: 22, eccCW: 18, blocks: [[1, 22]] },
  { size: 22, regionRows: 20, regionCols: 20, vRegions: 1, hRegions: 1, dataCW: 30, eccCW: 20, blocks: [[1, 30]] },
  { size: 24, regionRows: 22, regionCols: 22, vRegions: 1, hRegions: 1, dataCW: 36, eccCW: 24, blocks: [[1, 36]] },
  { size: 26, regionRows: 24, regionCols: 24, vRegions: 1, hRegions: 1, dataCW: 44, eccCW: 28, blocks: [[1, 44]] },
  { size: 32, regionRows: 14, regionCols: 14, vRegions: 2, hRegions: 2, dataCW: 62, eccCW: 36, blocks: [[1, 62]] },
  { size: 36, regionRows: 16, regionCols: 16, vRegions: 2, hRegions: 2, dataCW: 86, eccCW: 42, blocks: [[1, 86]] },
  { size: 40, regionRows: 18, regionCols: 18, vRegions: 2, hRegions: 2, dataCW: 114, eccCW: 48, blocks: [[1, 114]] },
  { size: 44, regionRows: 20, regionCols: 20, vRegions: 2, hRegions: 2, dataCW: 144, eccCW: 56, blocks: [[1, 144]] },
  { size: 48, regionRows: 22, regionCols: 22, vRegions: 2, hRegions: 2, dataCW: 174, eccCW: 68, blocks: [[1, 174]] },
  { size: 52, regionRows: 24, regionCols: 24, vRegions: 2, hRegions: 2, dataCW: 204, eccCW: 84, blocks: [[2, 102]] },
  { size: 64, regionRows: 14, regionCols: 14, vRegions: 4, hRegions: 4, dataCW: 280, eccCW: 112, blocks: [[2, 140]] },
  { size: 72, regionRows: 16, regionCols: 16, vRegions: 4, hRegions: 4, dataCW: 368, eccCW: 144, blocks: [[4, 92]] },
  { size: 80, regionRows: 18, regionCols: 18, vRegions: 4, hRegions: 4, dataCW: 456, eccCW: 192, blocks: [[4, 114]] },
  { size: 88, regionRows: 20, regionCols: 20, vRegions: 4, hRegions: 4, dataCW: 576, eccCW: 224, blocks: [[4, 144]] },
  { size: 96, regionRows: 22, regionCols: 22, vRegions: 4, hRegions: 4, dataCW: 696, eccCW: 272, blocks: [[4, 174]] },
  { size: 104, regionRows: 24, regionCols: 24, vRegions: 4, hRegions: 4, dataCW: 816, eccCW: 336, blocks: [[6, 136]] },
  { size: 120, regionRows: 18, regionCols: 18, vRegions: 6, hRegions: 6, dataCW: 1050, eccCW: 408, blocks: [[6, 175]] },
  { size: 132, regionRows: 20, regionCols: 20, vRegions: 6, hRegions: 6, dataCW: 1304, eccCW: 496, blocks: [[8, 163]] },
  {
    size: 144, regionRows: 22, regionCols: 22, vRegions: 6, hRegions: 6, dataCW: 1558, eccCW: 620,
    blocks: [[8, 156], [2, 155]],
  },
];

/** Largest payload (in UTF-8 bytes, before any digit-pair compression). */
export const DATAMATRIX_MAX_BYTES = SPECS[SPECS.length - 1]!.dataCW;

/* -------------------------------------------------------------------------- */
/*  Arithmetic over GF(256) with the ECC200 primitive polynomial 0x12d        */
/* -------------------------------------------------------------------------- */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x12d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

const gmul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!;

const generatorCache = new Map<number, Uint8Array>();
function rsGenerator(n: number): Uint8Array {
  const cached = generatorCache.get(n);
  if (cached) return cached;
  let g = new Uint8Array([1]);
  for (let i = 1; i <= n; i++) {
    const next = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      next[j] = next[j]! ^ gmul(g[j]!, 1);
      next[j + 1] = next[j + 1]! ^ gmul(g[j]!, EXP[i]!);
    }
    g = next;
  }
  generatorCache.set(n, g);
  return g;
}

/** Reed-Solomon ECC codewords for one block. */
export function rsEncode(data: Uint8Array, necc: number): Uint8Array {
  if (necc === 0) return new Uint8Array(0);
  const gen = rsGenerator(necc);
  const res = new Uint8Array(necc);
  for (const d of data) {
    const factor = d ^ res[0]!;
    res.copyWithin(0, 1);
    res[necc - 1] = 0;
    for (let i = 0; i < necc; i++) res[i] = res[i]! ^ gmul(gen[i + 1]!, factor);
  }
  return res;
}

/* -------------------------------------------------------------------------- */
/*  ASCII encodation (UTF-8 payload)                                          */
/* -------------------------------------------------------------------------- */

/** UTF-8 encode a string, handling surrogate pairs and lone surrogates. */
export function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000)
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
  }
  return out;
}

/** ASCII-encodate the UTF-8 bytes of `text`, padding to `dataCW` codewords. */
export function encodate(text: string, dataCW: number): number[] {
  const bytes = utf8Bytes(text);
  const cw: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]!;
    if (c >= 48 && c <= 57 && i + 1 < bytes.length) {
      const c2 = bytes[i + 1]!;
      if (c2 >= 48 && c2 <= 57) {
        cw.push(130 + (c - 48) * 10 + (c2 - 48));
        i++;
        continue;
      }
    }
    if (c < 128) cw.push(c + 1);
    else {
      cw.push(235);
      cw.push(c - 127);
    }
  }
  if (cw.length > dataCW) throw new Error('too much data');
  if (cw.length < dataCW) {
    cw.push(129);
    while (cw.length < dataCW) cw.push(cw[cw.length - 1]! === 129 ? 130 : 129);
  }
  return cw;
}

/* -------------------------------------------------------------------------- */
/*  Reed-Solomon block interleaving                                           */
/* -------------------------------------------------------------------------- */

// The data codewords are stored in plain order; only the ECC codewords are
// interleaved across blocks (position-major). 144×144 reorders the block map.
function buildCodewords(data: number[], spec: SymbolSpec): Uint8Array {
  const counts: number[] = [];
  for (const [count, len] of spec.blocks) for (let i = 0; i < count; i++) counts.push(len);
  const numBlocks = counts.length;
  const ecPerBlock = spec.eccCW / numBlocks;
  const special = spec.blocks.length > 1;
  const longer = Math.max(...counts);
  const shorter = longer - 1;
  const numLonger = counts.filter((c) => c === longer).length;

  const blocks = counts.map((n) => new Uint8Array(n));
  let off = 0;
  for (let i = 0; i < shorter; i++)
    for (let j = 0; j < numBlocks; j++) blocks[j]![i] = data[off++]!;
  for (let j = 0; j < numLonger; j++) blocks[j]![longer - 1] = data[off++]!;

  const eccs = blocks.map((b) => rsEncode(b, ecPerBlock));

  const raw: number[] = [...data];
  for (let k = 0; k < ecPerBlock; k++) {
    for (let j = 0; j < numBlocks; j++) {
      const jOffset = special ? (j + 8) % numBlocks : j;
      raw.push(eccs[jOffset]![k]!);
    }
  }
  return Uint8Array.from(raw);
}

/* -------------------------------------------------------------------------- */
/*  Symbol placement (ISO/IEC 16022 annex F)                                  */
/* -------------------------------------------------------------------------- */

function placeCodewords(codewords: Uint8Array, nr: number, nc: number): Int8Array[] {
  const m = Array.from({ length: nr }, () => new Int8Array(nc).fill(-1));
  const bit = (chr: number, bn: number) => (codewords[chr]! >> (8 - bn)) & 1;

  const place = (r0: number, c0: number, chr: number, bn: number) => {
    let r = r0;
    let c = c0;
    if (r < 0) {
      r += nr;
      c += 4 - ((nr + 4) % 8);
    }
    if (c < 0) {
      c += nc;
      r += 4 - ((nc + 4) % 8);
    }
    m[r]![c] = bit(chr, bn);
  };

  const utah = (r: number, c: number, chr: number) => {
    place(r - 2, c - 2, chr, 1);
    place(r - 2, c - 1, chr, 2);
    place(r - 1, c - 2, chr, 3);
    place(r - 1, c - 1, chr, 4);
    place(r - 1, c, chr, 5);
    place(r, c - 2, chr, 6);
    place(r, c - 1, chr, 7);
    place(r, c, chr, 8);
  };

  const corner1 = (chr: number) => {
    place(nr - 1, 0, chr, 1); place(nr - 1, 1, chr, 2); place(nr - 1, 2, chr, 3);
    place(0, nc - 2, chr, 4); place(0, nc - 1, chr, 5); place(1, nc - 1, chr, 6);
    place(2, nc - 1, chr, 7); place(3, nc - 1, chr, 8);
  };
  const corner2 = (chr: number) => {
    place(nr - 3, 0, chr, 1); place(nr - 2, 0, chr, 2); place(nr - 1, 0, chr, 3);
    place(0, nc - 4, chr, 4); place(0, nc - 3, chr, 5); place(0, nc - 2, chr, 6);
    place(0, nc - 1, chr, 7); place(1, nc - 1, chr, 8);
  };
  const corner3 = (chr: number) => {
    place(nr - 3, 0, chr, 1); place(nr - 2, 0, chr, 2); place(nr - 1, 0, chr, 3);
    place(0, nc - 2, chr, 4); place(0, nc - 1, chr, 5); place(1, nc - 1, chr, 6);
    place(2, nc - 1, chr, 7); place(3, nc - 1, chr, 8);
  };
  const corner4 = (chr: number) => {
    place(nr - 1, 0, chr, 1); place(nr - 1, nc - 1, chr, 2); place(0, nc - 3, chr, 3);
    place(0, nc - 2, chr, 4); place(0, nc - 1, chr, 5); place(1, nc - 3, chr, 6);
    place(1, nc - 2, chr, 7); place(1, nc - 1, chr, 8);
  };

  let row = 4;
  let col = 0;
  let chr = 0;
  do {
    if (row === nr && col === 0) corner1(chr++);
    if (row === nr - 2 && col === 0 && nc % 4 !== 0) corner2(chr++);
    if (row === nr - 2 && col === 0 && nc % 8 === 4) corner3(chr++);
    if (row === nr + 4 && col === 2 && nc % 8 === 0) corner4(chr++);
    do {
      if (row < nr && col >= 0 && m[row]![col]! === -1) utah(row, col, chr++);
      row -= 2;
      col += 2;
    } while (row >= 0 && col < nc);
    row += 1;
    col += 3;
    do {
      if (row >= 0 && col < nc && m[row]![col]! === -1) utah(row, col, chr++);
      row += 2;
      col -= 2;
    } while (row < nr && col >= 0);
    row += 3;
    col += 1;
  } while (row < nr || col < nc);

  if (m[nr - 1]![nc - 1]! === -1) {
    // Fixed pattern for the four unused modules (ISO/IEC 16022): a checkerboard
    // in the data region's lower-right 2×2 corner.
    m[nr - 1]![nc - 1] = 1;
    m[nr - 2]![nc - 2] = 1;
    m[nr - 2]![nc - 1] = 0;
    m[nr - 1]![nc - 2] = 0;
  }
  return m;
}

export interface DataMatrix {
  /** Symbol edge length in modules. */
  size: number;
  /** Row-major modules, `1` = dark. Length is `size * size`. */
  matrix: Uint8Array;
}

/**
 * Encode `text` as the smallest square DataMatrix that fits.
 * Throws if the payload is larger than a 144×144 symbol can hold.
 */
export function encodeDataMatrix(text: string): DataMatrix {
  for (const spec of SPECS) {
    let data: number[];
    try {
      data = encodate(text, spec.dataCW);
    } catch {
      continue;
    }
    const codewords = buildCodewords(data, spec);
    const nr = spec.size - 2 * spec.vRegions;
    const nc = spec.size - 2 * spec.hRegions;
    const pm = placeCodewords(codewords, nr, nc);

    const { size, regionRows: rh, regionCols: rw, vRegions: nv, hRegions: nh } = spec;
    const matrix = new Uint8Array(size * size);

    // Data modules, folded into their regions.
    for (let i = 0; i < nv; i++) {
      for (let j = 0; j < nh; j++) {
        const top = i * (rh + 2);
        const left = j * (rw + 2);
        for (let r = 0; r < rh; r++)
          for (let c = 0; c < rw; c++)
            matrix[(top + 1 + r) * size + (left + 1 + c)] = pm[i * rh + r]![j * rw + c]!;
      }
    }

    // Finder patterns: solid + alternating border lines around each region.
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let v: number;
        if (r % (rh + 2) === rh + 1 || c % (rw + 2) === 0) v = 1; // solid
        else if (r % (rh + 2) === 0) v = c % 2 === 0 ? 1 : 0; // alt row
        else if (c % (rw + 2) === rw + 1) v = r % 2 === 1 ? 1 : 0; // alt col
        else continue;
        matrix[r * size + c] = v;
      }
    }

    return { size, matrix };
  }
  throw new Error('payload too large for a square DataMatrix');
}
