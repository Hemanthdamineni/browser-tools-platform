import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './font-inspector.meta';

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_TABLES = 512;
const MAX_NAMES = 400;
const MAX_ROWS = 2000;
const MAX_TTC_FONTS = 64;
const MAX_AXES = 32;
const MAX_TEXT_CHARS = 5000;
const MAX_CODEPOINTS = 400000;
const CLIP = 90;
const HEAD_MAGIC = 0x5f0f3cf5;
const FILE_CHECKSUM = 0xb1b0afba;

type Level = 'error' | 'warning' | 'note';

interface Finding {
  level: Level;
  problem: string;
  detail: string;
}

interface TableRecord {
  tag: string;
  checksum: number;
  offset: number;
  /** Declared length in the directory. */
  length: number;
  /** Bytes actually available for this table, or null when the data is compressed and unreadable. */
  payload: Uint8Array | null;
  truncated: boolean;
}

interface NameRecord {
  nameId: number;
  platform: number;
  encoding: number;
  language: string;
  value: string;
}

interface Axis {
  tag: string;
  min: number;
  def: number;
  max: number;
}

interface Cmap {
  map: Map<number, number>;
  format: number;
  platform: number;
  encoding: number;
  subtables: number;
}

interface Head {
  unitsPerEm: number;
  indexToLocFormat: number;
  magic: number;
  created: string | null;
  modified: string | null;
  macStyle: number;
}

interface Maxp {
  version: number;
  numGlyphs: number;
}

interface Os2 {
  version: number;
  weightClass: number;
  widthClass: number;
  fsType: number;
  vendor: string;
  typoAscender: number | null;
  typoDescender: number | null;
  capHeight: number | null;
  xHeight: number | null;
}

interface FontData {
  container: string;
  flavor: string;
  outline: string;
  fileSize: number;
  tables: TableRecord[];
  tableOrder: string[];
  head: Head | null;
  maxp: Maxp | null;
  os2: Os2 | null;
  names: NameRecord[];
  cmap: Cmap | null;
  axes: Axis[];
  ttcCount: number;
  woff: {
    version: string;
    totalSfntSize: number;
    compressed: number;
    raw: number;
    metaLength: number;
    privLength: number;
  } | null;
  woff2: {
    version: string;
    totalSfntSize: number;
    totalCompressedSize: number;
    transformed: string[];
    decoded: boolean;
    metaLength: number;
    privLength: number;
  } | null;
  checksumFailures: string[];
  fileChecksumOk: boolean | null;
  findings: Finding[];
}

/** Big-endian reader that answers null instead of throwing when a font is truncated. */
class Bytes {
  private readonly view: DataView;
  readonly length: number;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.length = bytes.byteLength;
  }

  u8(at: number): number | null {
    return at >= 0 && at + 1 <= this.length ? this.view.getUint8(at) : null;
  }

  u16(at: number): number | null {
    return at >= 0 && at + 2 <= this.length ? this.view.getUint16(at, false) : null;
  }

  i16(at: number): number | null {
    return at >= 0 && at + 2 <= this.length ? this.view.getInt16(at, false) : null;
  }

  u32(at: number): number | null {
    return at >= 0 && at + 4 <= this.length ? this.view.getUint32(at, false) : null;
  }

  fixed(at: number): number | null {
    const value = this.u32(at);
    return value === null ? null : value / 65536;
  }

  slice(at: number, length: number): Uint8Array | null {
    if (at < 0 || length < 0 || at + length > this.length) return null;
    return new Uint8Array(this.view.buffer, this.view.byteOffset + at, length);
  }

  tag(at: number): string | null {
    const raw = this.slice(at, 4);
    if (raw === null) return null;
    let out = '';
    for (const byte of raw)
      out += byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '\u00b7';
    return out;
  }

  /** UTF-16BE string of `length` bytes, used by Windows and Unicode name records. */
  utf16be(at: number, length: number): string | null {
    const raw = this.slice(at, length);
    if (raw === null) return null;
    const codes: number[] = [];
    for (let i = 0; i + 1 < raw.length; i += 2)
      codes.push(((raw[i] ?? 0) << 8) | (raw[i + 1] ?? 0));
    const chunks: string[] = [];
    for (let i = 0; i < codes.length; i += 512)
      chunks.push(String.fromCharCode(...codes.slice(i, i + 512)));
    return chunks.join('');
  }
}

const clip = (text: string, limit = CLIP): string =>
  text.length > limit ? text.slice(0, limit - 1) + '\u2026' : text;

const formatBytes = (size: number): string => {
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(2) + ' MB';
};

/** Sums a buffer as big-endian 32-bit words, optionally zeroing the word at `zeroAt`. */
const sumWords = (data: Uint8Array, zeroAt?: number): number => {
  let sum = 0;
  const zeroWord = zeroAt !== undefined && zeroAt % 4 === 0 ? zeroAt : -4;
  for (let i = 0; i < data.length; i += 4) {
    if (i === zeroWord) continue;
    const word =
      (((data[i] ?? 0) << 24) |
        ((data[i + 1] ?? 0) << 16) |
        ((data[i + 2] ?? 0) << 8) |
        (data[i + 3] ?? 0)) >>>
      0;
    sum = (sum + word) >>> 0;
  }
  return sum >>> 0;
};

type StreamConstructor = new (format: string) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

/** Decompresses with the platform codec, returning null when the browser has no such codec. */
const inflate = async (data: Uint8Array, format: string): Promise<Uint8Array | null> => {
  const Constructor = (globalThis as unknown as { DecompressionStream?: StreamConstructor })
    .DecompressionStream;
  if (Constructor === undefined) return null;
  try {
    const stream = new Constructor(format);
    const collected = (async (): Promise<Uint8Array | null> => {
      const chunks: Uint8Array[] = [];
      let total = 0;
      const reader = stream.readable.getReader();
      for (;;) {
        const step = await reader.read();
        if (step.done) break;
        if (step.value !== undefined) {
          chunks.push(step.value);
          total += step.value.byteLength;
        }
      }
      const out = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.byteLength;
      }
      return out;
    })();
    const writer = stream.writable.getWriter();
    await writer.write(data);
    await writer.close();
    return await collected;
  } catch {
    return null;
  }
};

/** WOFF2 stores small table tags as indexes into this list. */
const WOFF2_KNOWN_TAGS = [
  'cmap',
  'head',
  'hhea',
  'hmtx',
  'maxp',
  'name',
  'OS/2',
  'post',
  'cvt ',
  'fpgm',
  'glyf',
  'loca',
  'prep',
  'CFF ',
  'VORG',
  'EBDT',
  'EBLC',
  'gasp',
  'hdmx',
  'kern',
  'LTSH',
  'PCLT',
  'VDMX',
  'vhea',
  'vmtx',
  'BASE',
  'GDEF',
  'GPOS',
  'GSUB',
  'EBSC',
  'JSTF',
  'MATH',
  'CBDT',
  'CBLC',
  'COLR',
  'CPAL',
  'SVG ',
  'sbix',
  'acnt',
  'avar',
  'bdat',
  'bloc',
  'bsln',
  'cvar',
  'fdsc',
  'feat',
  'fmtx',
  'fvar',
  'gvar',
  'hsty',
  'just',
  'lcar',
  'mort',
  'morx',
  'opbd',
  'prop',
  'trak',
  'Zapf',
  'Silf',
  'Glat',
  'Gloc',
  'Feat',
  'Sill',
];

const TABLE_PURPOSE: Record<string, string> = {
  avar: 'axis variations',
  BASE: 'baseline positions',
  bdat: 'Apple bitmap data',
  bloc: 'Apple bitmap locations',
  'CFF ': 'PostScript (CFF) outlines',
  CFF2: 'variable PostScript (CFF2) outlines',
  cmap: 'character to glyph mapping',
  COLR: 'layered colour glyphs',
  CPAL: 'colour palette for COLR',
  cvar: 'variable font CVT deltas',
  'cvt ': 'control values for hinting',
  DSIG: 'digital signature (often a placeholder)',
  EBDT: 'embedded bitmap data',
  EBLC: 'embedded bitmap locations',
  FFTM: 'written by FontForge',
  fpgm: 'hinting program',
  fvar: 'variable font axes',
  gasp: 'grid-fitting and scan conversion',
  GDEF: 'glyph classes for layout',
  glyf: 'TrueType outlines',
  GPOS: 'glyph positioning',
  GSUB: 'glyph substitution',
  gvar: 'variable font glyph deltas',
  hdmx: 'legacy horizontal device metrics',
  head: 'font header',
  hhea: 'horizontal header',
  hmtx: 'horizontal metrics',
  kern: 'legacy kerning pairs',
  loca: 'glyph outline offsets',
  LTSH: 'legacy linear thresholds',
  MATH: 'math layout',
  maxp: 'glyph count and limits',
  meta: 'extra metadata',
  name: 'family, version and licence names',
  'OS/2': 'metrics, weight class and embedding rights',
  PCLT: 'legacy PCL metrics',
  post: 'PostScript names and italic angle',
  prep: 'hinting pre-program',
  sbix: 'bitmap glyphs (Apple)',
  STAT: 'axis value names',
  'SVG ': 'SVG colour glyphs',
  TSI0: 'written by Visual TrueType',
  TSI1: 'written by Visual TrueType',
  TSI2: 'written by Visual TrueType',
  TSI3: 'written by Visual TrueType',
  TSI5: 'written by Visual TrueType',
  VDMX: 'legacy vertical metrics',
  vhea: 'vertical header',
  vmtx: 'vertical metrics',
  VORG: 'vertical origin (CFF)',
};

const NAME_LABELS: Record<number, string> = {
  0: 'Copyright',
  1: 'Family',
  2: 'Subfamily',
  3: 'Unique identifier',
  4: 'Full name',
  5: 'Version',
  6: 'PostScript name',
  7: 'Trademark',
  8: 'Manufacturer',
  9: 'Designer',
  10: 'Description',
  11: 'Vendor URL',
  12: 'Designer URL',
  13: 'Licence',
  14: 'Licence URL',
  16: 'Typographic family',
  17: 'Typographic subfamily',
  18: 'Compatible full name',
  19: 'Sample text',
  20: 'PostScript CID findfont',
  21: 'WWS family',
  22: 'WWS subfamily',
  23: 'Light background palette',
  24: 'Dark background palette',
  25: 'Variations PostScript name',
};

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

const WIDTH_NAMES = [
  'UltraCondensed',
  'ExtraCondensed',
  'Condensed',
  'SemiCondensed',
  'Medium',
  'SemiExpanded',
  'Expanded',
  'ExtraExpanded',
  'UltraExpanded',
];

const WINDOWS_LANGUAGES: Record<number, string> = {
  0x0404: 'zh-TW',
  0x0407: 'de-DE',
  0x0409: 'en-US',
  0x040a: 'es-ES',
  0x040c: 'fr-FR',
  0x0410: 'it-IT',
  0x0411: 'ja-JP',
  0x0412: 'ko-KR',
  0x0413: 'nl-NL',
  0x0416: 'pt-BR',
  0x0419: 'ru-RU',
  0x041d: 'sv-SE',
  0x041f: 'tr-TR',
  0x0804: 'zh-CN',
  0x0809: 'en-GB',
  0x0c0a: 'es-ES',
};

const UNICODE_BLOCKS: [string, number, number][] = [
  ['Basic Latin', 0x0020, 0x007f],
  ['Latin-1 Supplement', 0x0080, 0x00ff],
  ['Latin Extended-A', 0x0100, 0x017f],
  ['Latin Extended-B', 0x0180, 0x024f],
  ['IPA Extensions', 0x0250, 0x02af],
  ['Spacing Modifiers', 0x02b0, 0x02ff],
  ['Combining Diacritics', 0x0300, 0x036f],
  ['Greek and Coptic', 0x0370, 0x03ff],
  ['Cyrillic', 0x0400, 0x04ff],
  ['Cyrillic Supplement', 0x0500, 0x052f],
  ['Armenian', 0x0530, 0x058f],
  ['Hebrew', 0x0590, 0x05ff],
  ['Arabic', 0x0600, 0x06ff],
  ['Syriac', 0x0700, 0x074f],
  ['Thaana', 0x0780, 0x07bf],
  ['Devanagari', 0x0900, 0x097f],
  ['Bengali', 0x0980, 0x09ff],
  ['Gurmukhi', 0x0a00, 0x0a7f],
  ['Gujarati', 0x0a80, 0x0aff],
  ['Oriya', 0x0b00, 0x0b7f],
  ['Tamil', 0x0b80, 0x0bff],
  ['Telugu', 0x0c00, 0x0c7f],
  ['Kannada', 0x0c80, 0x0cff],
  ['Malayalam', 0x0d00, 0x0d7f],
  ['Sinhala', 0x0d80, 0x0dff],
  ['Thai', 0x0e00, 0x0e7f],
  ['Lao', 0x0e80, 0x0eff],
  ['Tibetan', 0x0f00, 0x0fff],
  ['Myanmar', 0x1000, 0x109f],
  ['Georgian', 0x10a0, 0x10ff],
  ['Hangul Jamo', 0x1100, 0x11ff],
  ['Ethiopic', 0x1200, 0x137f],
  ['Cherokee', 0x13a0, 0x13ff],
  ['Khmer', 0x1780, 0x17ff],
  ['Mongolian', 0x1800, 0x18af],
  ['Latin Extended Additional', 0x1e00, 0x1eff],
  ['Greek Extended', 0x1f00, 0x1fff],
  ['Punctuation', 0x2000, 0x206f],
  ['Super and Subscripts', 0x2070, 0x209f],
  ['Currency Symbols', 0x20a0, 0x20cf],
  ['Letterlike Symbols', 0x2100, 0x214f],
  ['Number Forms', 0x2150, 0x218f],
  ['Arrows', 0x2190, 0x21ff],
  ['Mathematical Operators', 0x2200, 0x22ff],
  ['Technical Symbols', 0x2300, 0x23ff],
  ['Control Pictures', 0x2400, 0x243f],
  ['Box Drawing', 0x2500, 0x257f],
  ['Block Elements', 0x2580, 0x259f],
  ['Geometric Shapes', 0x25a0, 0x25ff],
  ['Miscellaneous Symbols', 0x2600, 0x26ff],
  ['Dingbats', 0x2700, 0x27bf],
  ['Braille', 0x2800, 0x28ff],
  ['Supplemental Arrows', 0x2900, 0x297f],
  ['Misc Math Symbols', 0x2a00, 0x2aff],
  ['CJK Radicals', 0x2e80, 0x2eff],
  ['Kangxi Radicals', 0x2f00, 0x2fdf],
  ['CJK Symbols', 0x3000, 0x303f],
  ['Hiragana', 0x3040, 0x309f],
  ['Katakana', 0x30a0, 0x30ff],
  ['Bopomofo', 0x3100, 0x312f],
  ['Hangul Compatibility', 0x3130, 0x318f],
  ['CJK Extensions A', 0x3400, 0x4dbf],
  ['CJK Unified Ideographs', 0x4e00, 0x9fff],
  ['Yi Syllables', 0xa000, 0xa48f],
  ['Hangul Syllables', 0xac00, 0xd7af],
  ['Private Use Area', 0xe000, 0xf8ff],
  ['Alphabetic Presentation', 0xfb00, 0xfb4f],
  ['Arabic Presentation A', 0xfb50, 0xfdff],
  ['Combining Half Marks', 0xfe20, 0xfe2f],
  ['CJK Compatibility Ideographs', 0xf900, 0xfaff],
  ['Halfwidth and Fullwidth', 0xff00, 0xffef],
  ['CJK Extensions B', 0x20000, 0x2a6df],
  ['Emoji and Symbols', 0x1f300, 0x1f9ff],
  ['Transport and Maps', 0x1f680, 0x1f6ff],
  ['Alchemical Symbols', 0x1f700, 0x1f77f],
  ['Enclosed Alphanumerics', 0x2460, 0x24ff],
];

const parseSfntDirectory = (
  data: Bytes,
  base: number,
  findings: Finding[],
  fileSize: number,
): { tables: TableRecord[]; version: number; numTables: number } | null => {
  const numTables = data.u16(base + 4);
  const version = data.u32(base + 0);
  if (numTables === null || version === null) return null;
  if (numTables === 0 || numTables > MAX_TABLES) {
    findings.push({
      level: 'error',
      problem: 'The table directory is not usable',
      detail:
        'The offset table declares ' +
        numTables +
        ' tables; a font has between 1 and ' +
        MAX_TABLES +
        '.',
    });
    return null;
  }
  const tables: TableRecord[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < numTables; i += 1) {
    const at = base + 12 + i * 16;
    const tag = data.tag(at);
    const checksum = data.u32(at + 4);
    const offset = data.u32(at + 8);
    const length = data.u32(at + 12);
    if (tag === null || checksum === null || offset === null || length === null) {
      findings.push({
        level: 'error',
        problem: 'The table directory is truncated',
        detail:
          'The directory of the offset table stops after ' +
          i +
          ' entries, so the font file is incomplete.',
      });
      break;
    }
    const truncated = offset + length > fileSize;
    if (truncated) {
      findings.push({
        level: 'error',
        problem: 'A table points outside the file',
        detail:
          'Table "' +
          tag +
          '" claims ' +
          length +
          ' bytes at offset ' +
          offset +
          ', which is past the end of a ' +
          fileSize +
          '-byte file. The file is truncated or was rebuilt incorrectly.',
      });
    }
    if (seen.has(tag)) {
      findings.push({
        level: 'warning',
        problem: 'The same table appears twice',
        detail: 'Table "' + tag + '" is listed more than once; readers use the first entry.',
      });
    }
    seen.add(tag);
    tables.push({
      tag,
      checksum,
      offset,
      length,
      payload: data.slice(offset, Math.min(length, Math.max(0, fileSize - offset))),
      truncated,
    });
  }
  return { tables, version, numTables };
};

const SIGNATURES = {
  woff: 0x774f4646,
  woff2: 0x774f4632,
  ttcf: 0x74746366,
  otto: 0x4f54544f,
  trueType: 0x00010000,
  appleTrue: 0x74727565,
  type1: 0x74797031,
};

const baseFlavor = (signature: string): string => {
  if (signature === 'OTTO') return 'OpenType with CFF outlines';
  if (signature === 'true') return 'Apple TrueType';
  if (signature === 'typ1') return 'PostScript Type 1 in sfnt';
  return 'TrueType';
};

const readNames = (table: Bytes): NameRecord[] => {
  const format = table.u16(0);
  const count = table.u16(2);
  const stringOffset = table.u16(4);
  if (format === null || count === null || stringOffset === null) return [];
  const records: NameRecord[] = [];
  const limit = Math.min(count, MAX_NAMES);
  for (let i = 0; i < limit; i += 1) {
    const at = 6 + i * 12;
    const platform = table.u16(at);
    const encoding = table.u16(at + 2);
    const languageId = table.u16(at + 4);

    const nameId = table.u16(at + 6);
    const length = table.u16(at + 8);
    const offset = table.u16(at + 10);
    if (
      platform === null ||
      encoding === null ||
      languageId === null ||
      nameId === null ||
      length === null ||
      offset === null
    )
      break;
    const start = stringOffset + offset;
    let value: string | null = null;
    if (platform === 3 || platform === 0 || platform === 2) {
      value = table.utf16be(start, length);
    } else {
      const raw = table.slice(start, length);
      if (raw !== null) value = [...raw].map((byte) => String.fromCharCode(byte)).join('');
    }
    if (value === null) continue;
    const cleaned = value.replace(/\u0000+$/u, '').trim();
    if (cleaned === '') continue;
    const language =
      platform === 3
        ? (WINDOWS_LANGUAGES[languageId] ?? '0x' + languageId.toString(16).padStart(4, '0'))
        : platform === 1
          ? 'Mac ' + languageId
          : '-';
    records.push({ nameId, platform, encoding, language, value: cleaned });
  }
  records.sort(
    (left, right) =>
      left.nameId - right.nameId ||
      left.platform - right.platform ||
      left.language.localeCompare(right.language),
  );
  return records;
};

/** NUL and CR occur in some cmaps but no renderer sets them, and fontconfig drops them too. */
const isRenderable = (code: number): boolean => code !== 0x0000 && code !== 0x000d;

const readCmap = (table: Bytes): Cmap | null => {
  const numSubtables = table.u16(2);
  if (numSubtables === null || numSubtables === 0) return null;
  let best: { score: number; offset: number; platform: number; encoding: number } | null = null;
  for (let i = 0; i < Math.min(numSubtables, 64); i += 1) {
    const at = 4 + i * 8;
    const platform = table.u16(at);
    const encoding = table.u16(at + 2);
    const offset = table.u32(at + 4);
    if (platform === null || encoding === null || offset === null) break;
    const score =
      platform === 3 && encoding === 10
        ? 100
        : platform === 0 && (encoding === 4 || encoding === 6)
          ? 90
          : platform === 3 && encoding === 1
            ? 80
            : platform === 0
              ? 70
              : platform === 3 && encoding === 0
                ? 60
                : 10;
    if (best === null || score > best.score) best = { score, offset, platform, encoding };
  }
  if (best === null) return null;
  const format = table.u16(best.offset);
  if (format === null) return null;
  const map = new Map<number, number>();
  if (format === 4) {
    const segCountX2 = table.u16(best.offset + 6);
    if (segCountX2 === null || segCountX2 === 0) return null;
    const endBase = best.offset + 14;
    const startBase = endBase + segCountX2 + 2;
    const deltaBase = startBase + segCountX2;
    const rangeBase = deltaBase + segCountX2;
    for (let i = 0; i < segCountX2 / 2; i += 1) {
      const end = table.u16(endBase + i * 2);
      const start = table.u16(startBase + i * 2);
      const delta = table.u16(deltaBase + i * 2);
      const rangeOffset = table.u16(rangeBase + i * 2);
      if (end === null || start === null || delta === null || rangeOffset === null || start > end)
        continue;
      for (let code = start; code <= end && code <= 0xffff; code += 1) {
        if (map.size >= MAX_CODEPOINTS) break;
        let glyph: number;
        if (rangeOffset === 0) {
          glyph = (code + delta) & 0xffff;
        } else {
          const address = rangeBase + i * 2 + rangeOffset + (code - start) * 2;
          const raw = table.u16(address);
          if (raw === null) continue;
          glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
        }
        if (glyph !== 0 && isRenderable(code)) map.set(code, glyph);
      }
    }
  } else if (format === 12 || format === 13) {
    const groups = table.u32(best.offset + 12);
    if (groups === null) return null;
    for (let i = 0; i < Math.min(groups, MAX_CODEPOINTS); i += 1) {
      const at = best.offset + 16 + i * 12;
      const start = table.u32(at);
      const end = table.u32(at + 4);
      const glyph = table.u32(at + 8);
      if (start === null || end === null || glyph === null || start > end) continue;
      for (let code = start; code <= end; code += 1) {
        if (map.size >= MAX_CODEPOINTS) break;
        if (isRenderable(code)) map.set(code, format === 12 ? glyph + (code - start) : glyph);
      }
    }
  } else if (format === 6) {
    const first = table.u16(best.offset + 6);
    const count = table.u16(best.offset + 8);
    if (first === null || count === null) return null;
    for (let i = 0; i < count; i += 1) {
      const glyph = table.u16(best.offset + 10 + i * 2);
      if (glyph === null) break;
      if (glyph !== 0 && isRenderable(first + i)) map.set(first + i, glyph);
    }
  } else if (format === 0) {
    const raw = table.slice(best.offset + 6, 256);
    if (raw !== null) {
      for (let code = 0; code < 256; code += 1) {
        const glyph = raw[code] ?? 0;
        if (glyph !== 0 && isRenderable(code)) map.set(code, glyph);
      }
    }
  } else {
    return {
      map,
      format,
      platform: best.platform,
      encoding: best.encoding,
      subtables: numSubtables,
    };
  }
  return { map, format, platform: best.platform, encoding: best.encoding, subtables: numSubtables };
};

const readAxes = (table: Bytes): Axis[] => {
  const axisCount = table.u16(8);
  const axisSize = table.u16(10);
  const axesOffset = table.u16(4);
  if (axisCount === null || axisSize === null || axesOffset === null || axisSize < 20) return [];
  const axes: Axis[] = [];
  for (let i = 0; i < Math.min(axisCount, MAX_AXES); i += 1) {
    const at = axesOffset + i * axisSize;
    const tag = table.tag(at);
    const min = table.fixed(at + 4);
    const def = table.fixed(at + 8);
    const max = table.fixed(at + 12);
    if (tag === null || min === null || def === null || max === null) break;
    axes.push({ tag, min, def, max });
  }
  return axes;
};

const interpretFsType = (fsType: number): string => {
  if (fsType === 0) return 'installable (no restriction)';
  const parts: string[] = [];
  if ((fsType & 0x0002) !== 0) parts.push('restricted, embedding not allowed');
  else if ((fsType & 0x000c) === 0x000c) parts.push('preview and print only, editable');
  else if ((fsType & 0x0004) !== 0) parts.push('preview and print only');
  else if ((fsType & 0x0008) !== 0) parts.push('editable embedding allowed');
  if ((fsType & 0x0100) !== 0) parts.push('no subsetting allowed');
  if ((fsType & 0x0200) !== 0) parts.push('bitmap embedding only');
  return parts.length > 0
    ? parts.join('; ')
    : 'installable (other bits set: 0x' + fsType.toString(16) + ')';
};

const font_outlineBitmap = (tableOrder: string[]): boolean =>
  !tableOrder.includes('glyf') &&
  !tableOrder.includes('CFF ') &&
  !tableOrder.includes('CFF2') &&
  tableOrder.some((tag) => tag === 'CBDT' || tag === 'EBDT' || tag === 'sbix');

const parseFont = async (bytes: Uint8Array, fileName: string): Promise<FontData> => {
  const data = new Bytes(bytes);
  const findings: Finding[] = [];
  const signatureRaw = data.u32(0);
  const signature = data.tag(0);
  if (signatureRaw === null || signature === null)
    throw new ToolError(
      'That file is too short to be a font.',
      'A font needs at least an offset table in its first bytes.',
    );

  let container = 'sfnt';
  let flavor = baseFlavor(signature);
  let tables: TableRecord[] = [];
  let payloads = new Map<string, Uint8Array>();
  let ttcCount = 1;
  let woff: FontData['woff'] = null;
  let woff2: FontData['woff2'] = null;

  if (signatureRaw === SIGNATURES.woff) {
    container = 'woff';
    const declaredLength = data.u32(8);
    const numTables = data.u16(12);
    const totalSfntSize = data.u32(16);
    const major = data.u16(20);
    const minor = data.u16(22);
    const metaLength = data.u32(28);
    const privLength = data.u32(40);
    const flavorTag = data.tag(4) ?? '????';
    if (numTables === null || totalSfntSize === null || major === null || minor === null)
      throw new ToolError(
        'The WOFF header is truncated.',
        'The first 44 bytes of a WOFF file describe its tables; this file ends before that.',
      );
    if (declaredLength !== null && declaredLength !== bytes.length) {
      findings.push({
        level: 'warning',
        problem: 'The WOFF header length does not match the file',
        detail:
          'The header declares ' +
          declaredLength +
          ' bytes but the file is ' +
          bytes.length +
          ' bytes long.',
      });
    }
    flavor = baseFlavor(flavorTag);
    let compressed = 0;
    let raw = 0;
    for (let i = 0; i < Math.min(numTables, MAX_TABLES); i += 1) {
      const at = 44 + i * 20;
      const tag = data.tag(at);
      const offset = data.u32(at + 4);
      const compLength = data.u32(at + 8);
      const origLength = data.u32(at + 12);
      const checksum = data.u32(at + 16);
      if (
        tag === null ||
        offset === null ||
        compLength === null ||
        origLength === null ||
        checksum === null
      ) {
        findings.push({
          level: 'error',
          problem: 'The WOFF table directory is truncated',
          detail: 'The directory stops after ' + i + ' tables.',
        });
        break;
      }
      const stored = data.slice(offset, compLength);
      const truncated = offset + compLength > bytes.length;
      if (truncated) {
        findings.push({
          level: 'error',
          problem: 'A WOFF table points outside the file',
          detail:
            'Table "' +
            tag +
            '" claims ' +
            compLength +
            ' bytes at offset ' +
            offset +
            ', past the end of the file.',
        });
      }
      let payload: Uint8Array | null = stored;
      if (compLength < origLength && stored !== null) {
        payload = await inflate(stored, 'deflate');
        compressed += 1;
        if (payload === null) {
          findings.push({
            level: 'warning',
            problem: 'A compressed WOFF table could not be read',
            detail:
              'Table "' +
              tag +
              '" is deflated and this browser exposes no decompressor, so only its size is shown.',
          });
        } else if (payload.byteLength !== origLength) {
          findings.push({
            level: 'warning',
            problem: 'A decompressed WOFF table has the wrong size',
            detail:
              'Table "' +
              tag +
              '" unpacked to ' +
              payload.byteLength +
              ' bytes instead of the declared ' +
              origLength +
              '.',
          });
        }
      } else {
        raw += 1;
      }
      if (payload !== null) payloads.set(tag, payload);
      tables.push({ tag, checksum, offset, length: origLength, payload, truncated });
    }
    woff = {
      version: major + '.' + minor,
      totalSfntSize,
      compressed,
      raw,
      metaLength: metaLength ?? 0,
      privLength: privLength ?? 0,
    };
  } else if (signatureRaw === SIGNATURES.woff2) {
    container = 'woff2';
    const flavorTag = data.tag(4) ?? '????';
    const numTables = data.u16(12);
    const totalSfntSize = data.u32(16);
    const totalCompressedSize = data.u32(20);
    const major = data.u16(24);
    const minor = data.u16(26);
    const metaLength = data.u32(32);
    const privLength = data.u32(44);
    if (
      numTables === null ||
      totalSfntSize === null ||
      totalCompressedSize === null ||
      major === null ||
      minor === null
    )
      throw new ToolError(
        'The WOFF2 header is truncated.',
        'The first 48 bytes of a WOFF2 file describe its tables; this file ends before that.',
      );
    flavor = baseFlavor(flavorTag);
    const tags: string[] = [];
    const lengths: number[] = [];
    const stored: number[] = [];
    const transformed: string[] = [];
    let at = 48;
    for (let i = 0; i < Math.min(numTables, MAX_TABLES); i += 1) {
      const flags = data.u8(at);
      if (flags === null) {
        findings.push({
          level: 'error',
          problem: 'The WOFF2 table directory is truncated',
          detail: 'The directory stops after ' + i + ' tables.',
        });
        break;
      }
      at += 1;
      const index = flags & 0x3f;
      const version = (flags >> 6) & 0x03;
      let tag: string | null;
      if (index === 0x3f) {
        tag = data.tag(at);
        at += 4;
      } else {
        tag = WOFF2_KNOWN_TAGS[index] ?? null;
      }
      const origLength = readBase128(data, at);
      if (tag === null || origLength === null) {
        findings.push({
          level: 'error',
          problem: 'The WOFF2 table directory is malformed',
          detail: 'Entry ' + i + ' of the directory could not be decoded.',
        });
        break;
      }
      at = origLength.next;
      const isGlyf = tag === 'glyf' || tag === 'loca';
      const isTransformed = isGlyf ? version === 0 : version !== 0;
      let dataLength = origLength.value;
      if (isTransformed) {
        const transformLength = readBase128(data, at);
        if (transformLength === null) {
          findings.push({
            level: 'error',
            problem: 'The WOFF2 table directory is malformed',
            detail: 'Table "' + tag + '" declares a transform but no transformed length.',
          });
          break;
        }
        at = transformLength.next;
        dataLength = transformLength.value;
        transformed.push(tag);
      }
      tags.push(tag);
      lengths.push(origLength.value);
      stored.push(dataLength);
      tables.push({
        tag,
        checksum: 0,
        offset: at,
        length: origLength.value,
        payload: null,
        truncated: false,
      });
    }
    let decoded = false;
    const streamAt = at;
    const stream = data.slice(streamAt, totalCompressedSize);
    if (stream !== null) {
      const plain = await inflate(stream, 'brotli');
      if (plain === null) {
        findings.push({
          level: 'note',
          problem: 'The WOFF2 table data is compressed with Brotli',
          detail:
            'This browser exposes no Brotli decompressor, so names, glyph counts and coverage cannot be read from a WOFF2 file here. Convert it to TTF or WOFF, or open it in a browser with Brotli support, to see those fields.',
        });
      } else {
        decoded = true;
        // When glyf/loca are transformed they are stored smaller than their sfnt
        // size, so the unpacked stream is legitimately shorter than
        // totalSfntSize minus the directory; only demand an exact match when no
        // table is transformed.
        if (transformed.length === 0) {
          const expected = totalSfntSize - 12 - tags.length * 16;
          if (plain.byteLength !== expected) {
            findings.push({
              level: 'warning',
              problem: 'The WOFF2 stream does not match its declared size',
              detail:
                'The stream unpacked to ' +
                plain.byteLength +
                ' bytes but the tables declared ' +
                expected +
                ' bytes.',
            });
          }
        }
        let cursor = 0;
        for (let i = 0; i < tags.length; i += 1) {
          const tag = tags[i] ?? '';
          const length = stored[i] ?? 0;
          const chunk = plain.subarray(cursor, cursor + length);
          cursor += length;
          if (!transformed.includes(tag)) payloads.set(tag, chunk);
        }
        for (const table of tables) {
          const payload = payloads.get(table.tag);
          if (payload !== undefined) table.payload = payload;
        }
      }
    }
    woff2 = {
      version: major + '.' + minor,
      totalSfntSize,
      totalCompressedSize,
      transformed,
      decoded,
      metaLength: metaLength ?? 0,
      privLength: privLength ?? 0,
    };
  } else if (signatureRaw === SIGNATURES.ttcf) {
    container = 'ttc';
    const count = data.u32(8);
    if (count === null || count === 0)
      throw new ToolError(
        'The font collection header is truncated.',
        'A TTC file lists its fonts in the first bytes.',
      );
    ttcCount = count;
    if (count > MAX_TTC_FONTS) {
      findings.push({
        level: 'warning',
        problem: 'The collection holds a lot of fonts',
        detail:
          'The collection declares ' +
          count +
          ' fonts; only the first ' +
          MAX_TTC_FONTS +
          ' offsets are read.',
      });
    }
    if (count > 1) {
      findings.push({
        level: 'note',
        problem: 'This is a font collection',
        detail:
          'The file packs ' +
          count +
          ' fonts that share tables. The first one is described here; the others share most tables with it.',
      });
    }
    const firstOffset = data.u32(12);
    if (firstOffset === null || firstOffset + 12 > bytes.length)
      throw new ToolError(
        'The font collection points outside the file.',
        'The first font offset in the TTC header is not inside the file.',
      );
    const directory = parseSfntDirectory(data, firstOffset, findings, bytes.length);
    if (directory === null)
      throw new ToolError(
        'The first font in the collection has no usable table directory.',
        'The TTC header is readable but the font it points at is not.',
      );
    tables = directory.tables;
    for (const table of tables) {
      if (table.payload !== null) payloads.set(table.tag, table.payload);
      else {
        const slice = data.slice(table.offset, table.length);
        if (slice !== null) {
          table.payload = slice;
          payloads.set(table.tag, slice);
        }
      }
    }
    flavor = baseFlavor(data.tag(firstOffset) ?? '????');
  } else if (
    signatureRaw === SIGNATURES.otto ||
    signatureRaw === SIGNATURES.trueType ||
    signatureRaw === SIGNATURES.appleTrue ||
    signatureRaw === SIGNATURES.type1
  ) {
    const directory = parseSfntDirectory(data, 0, findings, bytes.length);
    if (directory === null)
      throw new ToolError(
        'This font has no usable table directory.',
        'The offset table at the start of the file could not be read.',
      );
    tables = directory.tables;
    for (const table of tables) if (table.payload !== null) payloads.set(table.tag, table.payload);
  } else {
    throw new ToolError(
      'That is not a font file.',
      'Font Inspector reads TTF, OTF, TTC, WOFF and WOFF2 files. The file starts with "' +
        clip(signature, 8) +
        '", which is none of those signatures.',
    );
  }

  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
    : '';
  const expectedExtensions: Record<string, string[]> = {
    sfnt: ['ttf', 'otf', 'otc', 'sfnt'],
    ttc: ['ttc', 'otc', 'ttf', 'otf'],
    woff: ['woff'],
    woff2: ['woff2'],
  };
  if (extension !== '' && !(expectedExtensions[container] ?? []).includes(extension)) {
    findings.push({
      level: 'warning',
      problem: 'The file name does not match the contents',
      detail:
        'The file is named ".' +
        extension +
        '" but its bytes are a ' +
        container +
        ' font. Browsers trust the MIME type and the bytes, while some build tools trust the extension, so this mismatch costs time.',
    });
  }

  const tableOrder = tables.map((table) => table.tag);
  const tableBytes = (tag: string): Bytes | null => {
    const payload = payloads.get(tag);
    return payload === undefined ? null : new Bytes(payload);
  };

  let head: Head | null = null;
  const headBytes = tableBytes('head');
  if (headBytes !== null) {
    const unitsPerEm = headBytes.u16(18);
    const indexToLocFormat = headBytes.i16(50);
    const magic = headBytes.u32(12);
    if (unitsPerEm === null || indexToLocFormat === null || magic === null) {
      findings.push({
        level: 'error',
        problem: 'The head table is truncated',
        detail:
          'A head table is 54 bytes; this one ends early, so units per em and the loca format are unknown.',
      });
    } else {
      const macStyle = headBytes.u16(44) ?? 0;
      const longDateTime = (at: number): string | null => {
        const high = headBytes.u32(at);
        const low = headBytes.u32(at + 4);
        if (high === null || low === null) return null;
        const seconds = high * 4294967296 + low - 2082844800;
        if (seconds <= 0) return null;
        return new Date(seconds * 1000).toISOString().slice(0, 10);
      };
      head = {
        unitsPerEm,
        indexToLocFormat,
        magic,
        created: longDateTime(20),
        modified: longDateTime(28),
        macStyle,
      };
      if (magic !== HEAD_MAGIC) {
        findings.push({
          level: 'error',
          problem: 'The head table has the wrong magic number',
          detail:
            'head.magicNumber is 0x' +
            magic.toString(16) +
            ' instead of 0x' +
            HEAD_MAGIC.toString(16) +
            ', which means the file is not a valid sfnt or was rebuilt incorrectly.',
        });
      }
      if (unitsPerEm < 16 || unitsPerEm > 16384) {
        findings.push({
          level: 'error',
          problem: 'The units per em value is out of range',
          detail:
            'head.unitsPerEm is ' + unitsPerEm + '; the OpenType specification allows 16 to 16384.',
        });
      }
      if (indexToLocFormat !== 0 && indexToLocFormat !== 1) {
        findings.push({
          level: 'warning',
          problem: 'The loca format is unknown',
          detail:
            'head.indexToLocFormat is ' +
            indexToLocFormat +
            '; only 0 (short) and 1 (long) are defined.',
        });
      }
    }
  } else if (container !== 'woff2' || woff2?.decoded === true) {
    findings.push({
      level: 'error',
      problem: 'A required table is missing',
      detail:
        'The head table is not present, so the font has no units per em or bounding box information.',
    });
  }

  let maxp: Maxp | null = null;
  const maxpBytes = tableBytes('maxp');
  if (maxpBytes !== null) {
    const version = maxpBytes.u32(0);
    const numGlyphs = maxpBytes.u16(4);
    if (version === null || numGlyphs === null) {
      findings.push({
        level: 'error',
        problem: 'The maxp table is truncated',
        detail: 'maxp must be at least 6 bytes; this one ends early.',
      });
    } else {
      maxp = { version, numGlyphs };
      if (numGlyphs === 0) {
        findings.push({
          level: 'error',
          problem: 'The font declares no glyphs',
          detail: 'maxp.numGlyphs is 0, so the font cannot render anything.',
        });
      }
    }
  } else if (container !== 'woff2' || woff2?.decoded === true) {
    findings.push({
      level: 'error',
      problem: 'A required table is missing',
      detail: 'The maxp table is not present, so the glyph count is unknown.',
    });
  }

  let os2: Os2 | null = null;
  const os2Bytes = tableBytes('OS/2');
  if (os2Bytes !== null) {
    const version = os2Bytes.u16(0);
    const weightClass = os2Bytes.u16(4);
    const widthClass = os2Bytes.u16(6);
    const fsType = os2Bytes.u16(8);
    const vendor = os2Bytes.tag(58) ?? '\u00b7\u00b7\u00b7\u00b7';
    if (version === null || weightClass === null || widthClass === null || fsType === null) {
      findings.push({
        level: 'error',
        problem: 'The OS/2 table is truncated',
        detail: 'OS/2 needs at least 10 bytes for its version, weight, width and embedding fields.',
      });
    } else {
      const minimum = version === 0 ? 78 : version === 1 ? 86 : version <= 4 ? 96 : 100;
      if (os2Bytes.length < minimum) {
        findings.push({
          level: 'warning',
          problem: 'The OS/2 table is shorter than its version requires',
          detail:
            'OS/2 version ' +
            version +
            ' must be at least ' +
            minimum +
            ' bytes but the table is ' +
            os2Bytes.length +
            ' bytes, so later fields are missing.',
        });
      }
      os2 = {
        version,
        weightClass,
        widthClass,
        fsType,
        vendor,
        typoAscender: os2Bytes.i16(68),
        typoDescender: os2Bytes.i16(70),
        capHeight: version >= 2 ? os2Bytes.i16(88) : null,
        xHeight: version >= 2 ? os2Bytes.i16(86) : null,
      };
    }
  }

  const names = (() => {
    const nameBytes = tableBytes('name');
    return nameBytes === null ? [] : readNames(nameBytes);
  })();

  const cmap = (() => {
    const cmapBytes = tableBytes('cmap');
    return cmapBytes === null ? null : readCmap(cmapBytes);
  })();

  const axes = (() => {
    const fvarBytes = tableBytes('fvar');
    return fvarBytes === null ? [] : readAxes(fvarBytes);
  })();

  if (payloads.size === 0 && container !== 'woff2') {
    findings.push({
      level: 'error',
      problem: 'No table data could be read',
      detail: 'The directory lists tables but none of their bytes are inside the file.',
    });
  }
  if (payloads.size > 0 && cmap === null) {
    findings.push({
      level: 'error',
      problem: 'The font has no usable character mapping',
      detail: 'No cmap subtable for Unicode was found, so no text can be mapped to glyphs.',
    });
  } else if (cmap !== null && cmap.map.size === 0) {
    findings.push({
      level: 'warning',
      problem: 'The character mapping is empty',
      detail:
        'The chosen cmap subtable (format ' + cmap.format + ') maps no code point to a glyph.',
    });
  }
  if (names.length > 0) {
    if (!names.some((record) => record.nameId === 1 || record.nameId === 16)) {
      findings.push({
        level: 'warning',
        problem: 'The font has no family name',
        detail:
          'Neither name ID 1 (family) nor 16 (typographic family) is present, so the font may not be selectable by name.',
      });
    }
    if (!names.some((record) => record.nameId === 6)) {
      findings.push({
        level: 'note',
        problem: 'The font has no PostScript name',
        detail: 'Name ID 6 is missing, which some PDF and PostScript workflows expect.',
      });
    }
    if (!names.some((record) => record.nameId === 13)) {
      findings.push({
        level: 'note',
        problem: 'The font ships no licence text',
        detail:
          'Name ID 13 is missing. The fsType bits still state the embedding rights, but the terms themselves are not inside the file.',
      });
    }
  } else if (payloads.has('name')) {
    findings.push({
      level: 'warning',
      problem: 'The name table holds no readable records',
      detail: 'The name table is present but every record was empty or unreadable.',
    });
  }
  if (os2 !== null) {
    const rights = interpretFsType(os2.fsType);
    if ((os2.fsType & 0x0002) !== 0) {
      findings.push({
        level: 'warning',
        problem: 'Embedding is restricted by the foundry',
        detail:
          'OS/2 fsType is 0x' +
          os2.fsType.toString(16) +
          ': ' +
          rights +
          '. Check the licence records before shipping this font in a document or app.',
      });
    } else if ((os2.fsType & 0x000c) !== 0 || (os2.fsType & 0x0100) !== 0) {
      findings.push({
        level: 'note',
        problem: 'Embedding carries conditions',
        detail: 'OS/2 fsType is 0x' + os2.fsType.toString(16) + ': ' + rights + '.',
      });
    }
  }
  if (tableOrder.includes('loca') && maxp !== null && head !== null) {
    const loca = payloads.get('loca');
    const entrySize = head.indexToLocFormat === 0 ? 2 : 4;
    const expected = (maxp.numGlyphs + 1) * entrySize;
    if (loca !== undefined && loca.byteLength < expected) {
      findings.push({
        level: 'warning',
        problem: 'The loca table is too short for the glyph count',
        detail:
          'loca holds ' +
          loca.byteLength +
          ' bytes but ' +
          maxp.numGlyphs +
          ' glyphs with ' +
          (entrySize === 2 ? 'short' : 'long') +
          ' offsets need ' +
          expected +
          '.',
      });
    }
  }
  if (tableOrder.includes('glyf') && !payloads.has('glyf')) {
    findings.push({
      level: 'note',
      problem: 'The glyph outlines are stored transformed',
      detail:
        'This WOFF2 keeps glyf and loca in the transformed representation, and recombining them is out of scope here, so outline sizes are reported from the directory only.',
    });
  }
  if (tableOrder.includes('post') && payloads.has('post')) {
    const version = new Bytes(payloads.get('post') as Uint8Array).u32(0);
    if (version === 0x00030000) {
      findings.push({
        level: 'note',
        problem: 'The font stores no glyph names',
        detail:
          'The post table is version 3, which drops glyph names; older PostScript or PDF tooling may rely on them.',
      });
    }
  }
  if (tableOrder.includes('kern') && tableOrder.includes('GPOS')) {
    findings.push({
      level: 'note',
      problem: 'Kerning exists in two places',
      detail:
        'Both the legacy kern table and OpenType GPOS kerning are present; applications usually honour only one of them.',
    });
  }
  if (tableOrder.includes('DSIG')) {
    const size =
      payloads.get('DSIG')?.byteLength ?? tables.find((table) => table.tag === 'DSIG')?.length ?? 0;
    if (size < 8) {
      findings.push({
        level: 'note',
        problem: 'The signature table is an empty placeholder',
        detail:
          'DSIG exists but holds ' +
          size +
          ' bytes, which is the usual way to say "built without a signature".',
      });
    } else {
      findings.push({
        level: 'note',
        problem: 'The font carries a signature table',
        detail:
          'DSIG holds ' + size + ' bytes. This inspector does not verify the signature itself.',
      });
    }
  }

  const legacy = tableOrder.filter(
    (tag) =>
      tag === 'hdmx' ||
      tag === 'LTSH' ||
      tag === 'VDMX' ||
      tag === 'PCLT' ||
      tag === 'FFTM' ||
      tag.startsWith('TSI'),
  );
  if (legacy.length > 0) {
    findings.push({
      level: 'note',
      problem: 'Legacy tables are present',
      detail:
        'Tables ' +
        legacy.join(', ') +
        ' come from older Windows hints and editors; they are harmless and may be dropped when subsetting.',
    });
  }

  const checksumFailures: string[] = [];
  let fileChecksumOk: boolean | null = null;
  if (container === 'sfnt' || container === 'ttc') {
    for (const table of tables) {
      if (table.payload === null) continue;
      const expected = sumWords(table.payload, table.tag === 'head' ? 8 : undefined);
      if (expected !== table.checksum) checksumFailures.push(table.tag);
    }
    if (checksumFailures.length > 0) {
      findings.push({
        level: 'warning',
        problem: 'Table checksums do not match the table data',
        detail:
          'Tables ' +
          checksumFailures.slice(0, 8).join(', ') +
          (checksumFailures.length > 8 ? ' and ' + (checksumFailures.length - 8) + ' more' : '') +
          ' fail their own checksum. Many shipping fonts are like this after hinting or rebuilding, so it is a warning rather than a corruption error.',
      });
    }
    const headRecord = tables.find((table) => table.tag === 'head');
    if (headRecord !== undefined && headRecord.payload !== null) {
      const total = sumWords(bytes, headRecord.offset + 8);
      fileChecksumOk = total === FILE_CHECKSUM;
      if (fileChecksumOk === false) {
        findings.push({
          level: 'note',
          problem: 'The whole-file checksum does not add up',
          detail:
            'head.checkSumAdjustment is meant to make every 32-bit word in the file sum to 0x' +
            FILE_CHECKSUM.toString(16) +
            '; this file sums to 0x' +
            total.toString(16) +
            '. Common in fonts that were rebuilt without fixing the adjustment.',
        });
      }
    }
  } else if (container === 'woff') {
    for (const table of tables) {
      if (table.payload === null) continue;
      const expected = sumWords(table.payload, table.tag === 'head' ? 8 : undefined);
      if (expected !== table.checksum) checksumFailures.push(table.tag);
    }
    if (checksumFailures.length > 0) {
      findings.push({
        level: 'warning',
        problem: 'WOFF table checksums do not match the unpacked data',
        detail:
          'Tables ' +
          checksumFailures.slice(0, 8).join(', ') +
          ' fail the checksum stored in the WOFF directory.',
      });
    }
  }

  if (font_outlineBitmap(tableOrder)) {
    findings.push({
      level: 'note',
      problem: 'This font draws with bitmaps, not outlines',
      detail:
        'Tables ' +
        tableOrder
          .filter(
            (tag) =>
              tag === 'CBDT' ||
              tag === 'CBLC' ||
              tag === 'EBDT' ||
              tag === 'EBLC' ||
              tag === 'sbix',
          )
          .join(', ') +
        ' hold embedded bitmaps and there is no glyf or CFF table, so the glyphs only look right at the sizes the foundry shipped.',
    });
  }
  if (tableOrder.includes('CFF ') || tableOrder.includes('CFF2')) {
    findings.push({
      level: 'note',
      problem: 'Outlines are PostScript flavoured',
      detail:
        'The font draws with ' +
        (tableOrder.includes('CFF2') ? 'CFF2 (a variable CFF)' : 'CFF') +
        ' charstrings rather than TrueType outlines.',
    });
  }
  if (axes.length > 0) {
    findings.push({
      level: 'note',
      problem: 'This is a variable font',
      detail:
        'It exposes ' +
        axes.length +
        ' axis or axes: ' +
        axes.map((axis) => axis.tag + ' ' + axis.min + ' to ' + axis.max).join(', ') +
        '.',
    });
  }
  const colorTables = tableOrder.filter(
    (tag) => tag === 'COLR' || tag === 'SVG ' || tag === 'sbix' || tag === 'CBDT',
  );
  if (colorTables.length > 0) {
    findings.push({
      level: 'note',
      problem: 'The font contains colour glyphs',
      detail:
        'Colour tables ' +
        colorTables.join(', ') +
        ' are present' +
        (colorTables.includes('COLR') ? ' (with CPAL palettes)' : '') +
        '. Older renderers fall back to the monochrome outlines.',
    });
  }
  const hintTables = tableOrder.filter(
    (tag) => tag === 'cvt ' || tag === 'fpgm' || tag === 'prep' || tag === 'glyf',
  );
  if (hintTables.length >= 2 && tableOrder.includes('fpgm')) {
    findings.push({
      level: 'note',
      problem: 'The font is hinted',
      detail:
        'Hinting tables ' +
        hintTables.filter((tag) => tag !== 'glyf').join(', ') +
        ' control grid fitting, which is why the file is larger than an unhinted build.',
    });
  }

  return {
    container,
    flavor,
    outline:
      tableOrder.includes('CFF ') || tableOrder.includes('CFF2')
        ? 'PostScript'
        : tableOrder.includes('glyf')
          ? 'TrueType'
          : tableOrder.includes('CBDT') ||
              tableOrder.includes('EBDT') ||
              tableOrder.includes('sbix')
            ? 'bitmap'
            : 'none',
    fileSize: bytes.length,
    tables,
    tableOrder,
    head,
    maxp,
    os2,
    names,
    cmap,
    axes,
    ttcCount,
    woff,
    woff2,
    checksumFailures,
    fileChecksumOk,
    findings,
  };
};

/** Decodes the variable-length integer WOFF2 uses for table lengths. */
function readBase128(data: Bytes, at: number): { value: number; next: number } | null {
  let value = 0;
  for (let i = 0; i < 5; i += 1) {
    const byte = data.u8(at + i);
    if (byte === null) return null;
    if (i === 0 && byte === 0x80) return null;
    if (value > 0x1ffffff) return null;
    value = ((value << 7) | (byte & 0x7f)) >>> 0;
    if ((byte & 0x80) === 0) return { value, next: at + i + 1 };
  }
  return null;
}

const nameValue = (font: FontData, ...ids: number[]): string | null => {
  for (const id of ids) {
    const record = font.names.find(
      (candidate) =>
        candidate.nameId === id && (candidate.platform === 3 || candidate.platform === 0),
    );
    if (record !== undefined) return record.value;
    const fallback = font.names.find((candidate) => candidate.nameId === id);
    if (fallback !== undefined) return fallback.value;
  }
  return null;
};

interface BlockCount {
  name: string;
  start: number;
  end: number;
  covered: number;
}

const coverageBlocks = (font: FontData): { blocks: BlockCount[]; unlisted: number } => {
  const counts = UNICODE_BLOCKS.map(([name, start, end]) => ({ name, start, end, covered: 0 }));
  let unlisted = 0;
  if (font.cmap !== null) {
    for (const code of font.cmap.map.keys()) {
      let placed = false;
      for (const block of counts) {
        if (code >= block.start && code <= block.end) {
          block.covered += 1;
          placed = true;
          break;
        }
      }
      if (!placed) unlisted += 1;
    }
  }
  counts.sort((left, right) => right.covered - left.covered || left.start - right.start);
  return { blocks: counts, unlisted };
};

const textCoverage = (
  font: FontData,
  text: string,
): { checked: number; available: number; missing: number[] } | null => {
  if (text.trim() === '') return null;
  const seen = new Set<number>();
  for (const character of Array.from(text)) {
    const code = character.codePointAt(0);
    if (code === undefined || code === 0x0a || code === 0x0d) continue;
    seen.add(code);
    if (seen.size >= MAX_TEXT_CHARS) break;
  }
  if (seen.size === 0) return null;
  const missing: number[] = [];
  let available = 0;
  for (const code of seen) {
    if (font.cmap !== null && font.cmap.map.has(code)) available += 1;
    else missing.push(code);
  }
  missing.sort((left, right) => left - right);
  return { checked: seen.size, available, missing };
};

const describeCode = (code: number): string => {
  const label = 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
  if (code >= 0x20 && code !== 0x7f) return label + ' "' + String.fromCodePoint(code) + '"';
  return label;
};

const buildSummary = (
  font: FontData,
  textCheck: ReturnType<typeof textCoverage>,
  blocks: BlockCount[],
  unlisted: number,
): string[][] => {
  const rows: string[][] = [];
  const add = (item: string, value: string): void => {
    rows.push([item, value]);
  };
  const family = nameValue(font, 16, 1);
  const subfamily = nameValue(font, 17, 2);
  const full = nameValue(font, 4);
  const postScript = nameValue(font, 6);
  const version = nameValue(font, 5);
  const copyright = nameValue(font, 0);
  const codepoints = font.cmap?.map.size ?? 0;
  const coveredBlocks = blocks.filter((block) => block.covered > 0).length;
  add('File', formatBytes(font.fileSize));
  add(
    'Container',
    font.container === 'woff2'
      ? 'WOFF2 wrapper (' + (font.woff2?.version ?? '?') + ') over ' + font.flavor
      : font.container === 'woff'
        ? 'WOFF wrapper (' + (font.woff?.version ?? '?') + ') over ' + font.flavor
        : font.container === 'ttc'
          ? 'Font collection with ' + font.ttcCount + ' font(s), first shown: ' + font.flavor
          : font.flavor,
  );
  const bitmapTables = font.tableOrder.filter(
    (tag) => tag === 'CBDT' || tag === 'CBLC' || tag === 'EBDT' || tag === 'EBLC' || tag === 'sbix',
  );
  add(
    'Outlines',
    font.outline === 'TrueType'
      ? 'TrueType (glyf)'
      : font.outline === 'PostScript'
        ? 'PostScript (CFF)'
        : font.outline === 'bitmap'
          ? 'bitmap glyphs only (' + bitmapTables.join(', ') + ')'
          : 'not present in the readable tables',
  );
  add('Family', family ?? '(no family name record)');
  add('Style', subfamily ?? '(none)');
  if (full !== null && full !== family) add('Full name', full);
  if (postScript !== null) add('PostScript name', postScript);
  if (version !== null) add('Version', clip(version, 60));
  if (font.maxp !== null) add('Glyphs', String(font.maxp.numGlyphs));
  if (font.head !== null) {
    add('Units per em', String(font.head.unitsPerEm));
    if (font.head.created !== null || font.head.modified !== null)
      add('Created / modified', (font.head.created ?? '?') + ' / ' + (font.head.modified ?? '?'));
  }
  if (font.os2 !== null) {
    const weight = WEIGHT_NAMES[font.os2.weightClass];
    const width = WIDTH_NAMES[font.os2.widthClass - 1];
    add(
      'Weight / width',
      font.os2.weightClass +
        (weight === undefined ? '' : ' (' + weight + ')') +
        ' / ' +
        font.os2.widthClass +
        (width === undefined ? '' : ' (' + width + ')'),
    );
    add(
      'Embedding',
      interpretFsType(font.os2.fsType) + ' \u2014 fsType 0x' + font.os2.fsType.toString(16),
    );
    if (font.os2.vendor !== '\u00b7\u00b7\u00b7\u00b7') add('Vendor', font.os2.vendor);
  }
  add(
    'Tables',
    font.tables.length + ' table(s)' + (font.tableOrder.includes('CFF ') ? ', CFF outlines' : ''),
  );
  add(
    'Coverage',
    codepoints === 0
      ? 'no mapped code points'
      : codepoints.toLocaleString('en-US') +
          ' code points in ' +
          coveredBlocks +
          ' Unicode block(s)' +
          (unlisted > 0 ? ', ' + unlisted + ' outside the listed blocks' : ''),
  );
  if (font.cmap !== null)
    add(
      'Mapping table',
      'cmap format ' +
        font.cmap.format +
        ', platform ' +
        font.cmap.platform +
        '/' +
        font.cmap.encoding +
        ' of ' +
        font.cmap.subtables +
        ' subtable(s)',
    );
  if (font.axes.length > 0)
    add(
      'Variable axes',
      font.axes
        .map(
          (axis) => axis.tag + ' ' + axis.min + '\u2013' + axis.max + ' (default ' + axis.def + ')',
        )
        .join(', '),
    );
  const colorTables = font.tableOrder.filter(
    (tag) => tag === 'COLR' || tag === 'SVG ' || tag === 'sbix' || tag === 'CBDT',
  );
  if (colorTables.length > 0)
    add(
      'Colour',
      colorTables.join(', ') + (font.tableOrder.includes('CPAL') ? ' + CPAL palettes' : ''),
    );
  const hinting = font.tableOrder.filter(
    (tag) => tag === 'cvt ' || tag === 'fpgm' || tag === 'prep',
  );
  add('Hinting', hinting.length > 0 ? hinting.join(', ') : 'none');
  add('Names', font.names.length + ' record(s)');
  if (font.woff !== null) {
    add(
      'WOFF compression',
      font.woff.compressed +
        ' deflated and ' +
        font.woff.raw +
        ' stored table(s), ' +
        formatBytes(font.woff.totalSfntSize) +
        ' when unpacked',
    );
    if (font.woff.metaLength > 0 || font.woff.privLength > 0)
      add(
        'WOFF extra blocks',
        'metadata ' + font.woff.metaLength + ' B, private ' + font.woff.privLength + ' B',
      );
  }
  if (font.woff2 !== null) {
    add(
      'WOFF2 compression',
      formatBytes(font.woff2.totalCompressedSize) +
        ' compressed from ' +
        formatBytes(font.woff2.totalSfntSize) +
        (font.woff2.decoded ? ', decoded' : ', not decoded (no Brotli)'),
    );
    if (font.woff2.transformed.length > 0)
      add('WOFF2 transforms', font.woff2.transformed.join(', ') + ' stored transformed');
    if (font.woff2.metaLength > 0 || font.woff2.privLength > 0)
      add(
        'WOFF2 extra blocks',
        'metadata ' + font.woff2.metaLength + ' B, private ' + font.woff2.privLength + ' B',
      );
  }
  if (textCheck !== null) {
    add(
      'Your text',
      textCheck.available +
        ' of ' +
        textCheck.checked +
        ' character(s) available' +
        (textCheck.missing.length > 0 ? ', ' + textCheck.missing.length + ' missing' : ''),
    );
  }
  if (copyright !== null) add('Copyright', clip(copyright, 90));
  const errors = font.findings.filter((finding) => finding.level === 'error').length;
  const warnings = font.findings.filter((finding) => finding.level === 'warning').length;
  const notes = font.findings.filter((finding) => finding.level === 'note').length;
  add('Findings', errors + ' error, ' + warnings + ' warning, ' + notes + ' note');
  if (font.checksumFailures.length > 0)
    add(
      'Checksums',
      font.checksumFailures.length +
        ' table(s) fail' +
        (font.fileChecksumOk === false ? ', whole-file adjustment wrong' : ''),
    );
  else if (font.fileChecksumOk !== null)
    add(
      'Checksums',
      font.fileChecksumOk
        ? 'all table checksums and the file adjustment match'
        : 'table checksums match, whole-file adjustment wrong',
    );
  return rows;
};

const buildTablesView = (font: FontData): string[][] => {
  const rows: string[][] = [];
  for (const table of font.tables.slice(0, MAX_ROWS)) {
    const purpose = TABLE_PURPOSE[table.tag] ?? '\u2014';
    const share =
      font.fileSize === 0 ? 0 : ((table.payload?.byteLength ?? table.length) / font.fileSize) * 100;
    rows.push([
      table.tag,
      purpose,
      table.offset.toLocaleString('en-US'),
      table.length.toLocaleString('en-US'),
      table.payload === null ? 'compressed' : '0x' + table.checksum.toString(16).padStart(8, '0'),
      share.toFixed(1) + '%',
    ]);
  }
  if (rows.length === 0) rows.push(['\u2014', '(no tables readable)', '', '', '', '']);
  return rows;
};

const buildNamesView = (font: FontData): string[][] => {
  const rows: string[][] = [];
  for (const record of font.names.slice(0, MAX_ROWS)) {
    rows.push([
      String(record.nameId),
      NAME_LABELS[record.nameId] ?? 'Name ID ' + record.nameId,
      (record.platform === 3
        ? 'Windows'
        : record.platform === 1
          ? 'Macintosh'
          : record.platform === 0
            ? 'Unicode'
            : 'Platform ' + record.platform) +
        ' ' +
        record.encoding,
      record.language,
      clip(record.value, 220),
    ]);
  }
  if (rows.length === 0) rows.push(['\u2014', '(no name records)', '', '', '']);
  return rows;
};

const buildCoverageView = (blocks: BlockCount[], unlisted: number): string[][] => {
  const rows: string[][] = [];
  const total = blocks.reduce((sum, block) => sum + block.covered, 0) + unlisted;
  for (const block of blocks) {
    if (block.covered === 0) continue;
    const size = block.end - block.start + 1;
    rows.push([
      block.name,
      'U+' +
        block.start.toString(16).toUpperCase() +
        '\u2013U+' +
        block.end.toString(16).toUpperCase(),
      block.covered.toLocaleString('en-US') + ' / ' + size.toLocaleString('en-US'),
      total === 0 ? '0%' : ((block.covered / total) * 100).toFixed(1) + '%',
    ]);
  }
  if (unlisted > 0)
    rows.push([
      'Outside the listed blocks',
      '\u2014',
      unlisted.toLocaleString('en-US'),
      total === 0 ? '0%' : ((unlisted / total) * 100).toFixed(1) + '%',
    ]);
  if (rows.length === 0) rows.push(['(nothing mapped)', '\u2014', '0', '0%']);
  return rows.slice(0, MAX_ROWS);
};

const buildFindingsView = (findings: Finding[]): string[][] => {
  const rows = findings.map((finding) => [finding.level, finding.problem, finding.detail]);
  if (rows.length === 0)
    rows.push([
      'note',
      'Nothing to flag',
      'Every table this inspector checked is present, readable and consistent.',
    ]);
  return rows.slice(0, MAX_ROWS);
};

const run = async (input: FileRunInput): Promise<FileRunResult> => {
  const file = (input.files ?? [])[0];
  if (file === undefined) {
    throw new ToolError(
      'Choose a font file to inspect.',
      'Drop a .ttf, .otf, .ttc, .woff or .woff2 file, or use the file picker.',
    );
  }
  if (file.size === 0) {
    throw new ToolError('That file is empty.', 'Choose a font file that contains a font.');
  }
  if (file.size > MAX_BYTES) {
    throw new ToolError(
      'That file is larger than 32 MB.',
      'Fonts that large are rare; this inspector keeps the whole file in memory, so trim the collection or pick a smaller font.',
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const font = await parseFont(bytes, file.name);
  const format = String(input.options?.format ?? 'summary');
  const requested = String(input.options?.text ?? '');
  const { blocks, unlisted } = coverageBlocks(font);
  const textCheck = textCoverage(font, requested);

  if (textCheck !== null) {
    const listed = textCheck.missing.slice(0, 40).map(describeCode).join(', ');
    const rest =
      textCheck.missing.length > 40 ? ' and ' + (textCheck.missing.length - 40) + ' more' : '';
    if (textCheck.available === 0) {
      font.findings.push({
        level: 'error',
        problem: 'None of your text can be set in this font',
        detail:
          'All ' +
          textCheck.checked +
          ' distinct character(s) you pasted have no glyph: ' +
          listed +
          rest +
          '. A renderer falls back to another font for every one of them.',
      });
    } else if (textCheck.missing.length > 0) {
      font.findings.push({
        level: 'warning',
        problem: 'Some of your text is missing from this font',
        detail:
          textCheck.missing.length +
          ' of the ' +
          textCheck.checked +
          ' character(s) you pasted have no glyph: ' +
          listed +
          rest +
          '. A renderer falls back to another font for those.',
      });
    } else {
      font.findings.push({
        level: 'note',
        problem: 'Your text is fully covered',
        detail:
          'All ' +
          textCheck.checked +
          ' distinct character(s) you pasted map to a glyph in this font.',
      });
    }
  }

  if (format === 'tables' && font.tables.length >= MAX_TABLES) {
    font.findings.push({
      level: 'note',
      problem: 'Only the first tables are listed',
      detail: 'The directory holds more than ' + MAX_TABLES + ' entries; the view stops there.',
    });
  }

  const report = (() => {
    switch (format) {
      case 'tables':
        return {
          headers: ['Tag', 'Purpose', 'Offset', 'Length', 'Checksum', 'Share of file'],
          rows: buildTablesView(font),
        };
      case 'names':
        return {
          headers: ['Name ID', 'Meaning', 'Platform', 'Language', 'Value'],
          rows: buildNamesView(font),
        };
      case 'coverage':
        return {
          headers: ['Unicode block', 'Range', 'Covered', 'Share'],
          rows: buildCoverageView(blocks, unlisted),
        };
      case 'findings':
        return { headers: ['Level', 'Problem', 'Detail'], rows: buildFindingsView(font.findings) };
      default:
        return {
          headers: ['Item', 'Value'],
          rows: buildSummary(font, textCheck, blocks, unlisted),
        };
    }
  })();

  const errors = font.findings.filter((finding) => finding.level === 'error');
  const warnings = font.findings.filter((finding) => finding.level === 'warning');
  const notes = font.findings.filter((finding) => finding.level === 'note');
  const stats: Record<string, string | number> = {
    bytes: font.fileSize,
    container: font.container,
    tables: font.tables.length,
    glyphs: font.maxp?.numGlyphs ?? 0,
    unitsPerEm: font.head?.unitsPerEm ?? 0,
    names: font.names.length,
    codePoints: font.cmap?.map.size ?? 0,
    blocks: blocks.filter((block) => block.covered > 0).length,
    axes: font.axes.length,
    findings: font.findings.length,
    errors: errors.length,
    warnings: warnings.length,
    notes: notes.length,
  };
  if (font.os2 !== null) stats.embedding = interpretFsType(font.os2.fsType);
  if (textCheck !== null) {
    stats.checkedCharacters = textCheck.checked;
    stats.missingCharacters = textCheck.missing.length;
  }
  if (font.checksumFailures.length > 0) stats.checksumFailures = font.checksumFailures.length;

  return {
    outputs: [],
    report: { output: JSON.stringify(report), render: 'table' },
    notes: notes.map((finding) => finding.problem + '.'),
    warnings: warnings.map((finding) => finding.detail),
    stats,
  };
};

const tool: FileToolModule = { meta, run };

export default tool;
