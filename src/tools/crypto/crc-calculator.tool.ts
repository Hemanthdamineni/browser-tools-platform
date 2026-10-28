import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './crc-calculator.meta';

/**
 * Parametrised CRC calculator.
 *
 * One bitwise routine driven by six catalogue parameters: width, polynomial,
 * init, refin, refout and xorout. A named preset is just a tuple of those
 * parameters; custom mode exposes the tuple directly. Bitwise rather than
 * table-driven because a register wider than 32 bits needs BigInt anyway, and
 * the inputs here are small.
 *
 * The expected values in the tests are the catalogue's published check values
 * for the ASCII string "123456789", produced by an independent Python
 * reference implementation of these same parameters, not by this code.
 */

const MAX_BYTES = 128 * 1024 * 1024;

interface Params {
  name: string;
  width: number;
  poly: bigint;
  init: bigint;
  refin: boolean;
  refout: boolean;
  xorout: bigint;
}

const PRESETS: Record<string, Params> = {
  'crc-8-atm': {
    name: 'CRC-8/ATM',
    width: 8,
    poly: 0x07n,
    init: 0x00n,
    refin: false,
    refout: false,
    xorout: 0x00n,
  },
  'crc-8-maxim': {
    name: 'CRC-8/MAXIM',
    width: 8,
    poly: 0x31n,
    init: 0x00n,
    refin: true,
    refout: true,
    xorout: 0x00n,
  },
  'crc-16-ibm': {
    name: 'CRC-16/IBM',
    width: 16,
    poly: 0x8005n,
    init: 0x0000n,
    refin: true,
    refout: true,
    xorout: 0x0000n,
  },
  'crc-16-ccitt-false': {
    name: 'CRC-16/CCITT-FALSE',
    width: 16,
    poly: 0x1021n,
    init: 0xffffn,
    refin: false,
    refout: false,
    xorout: 0x0000n,
  },
  'crc-16-modbus': {
    name: 'CRC-16/MODBUS',
    width: 16,
    poly: 0x8005n,
    init: 0xffffn,
    refin: true,
    refout: true,
    xorout: 0x0000n,
  },
  'crc-16-usb': {
    name: 'CRC-16/USB',
    width: 16,
    poly: 0x8005n,
    init: 0xffffn,
    refin: true,
    refout: true,
    xorout: 0xffffn,
  },
  'crc-16-xmodem': {
    name: 'CRC-16/XMODEM',
    width: 16,
    poly: 0x1021n,
    init: 0x0000n,
    refin: false,
    refout: false,
    xorout: 0x0000n,
  },
  'crc-32-iso-hdlc': {
    name: 'CRC-32/ISO-HDLC',
    width: 32,
    poly: 0x04c11db7n,
    init: 0xffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffn,
  },
  'crc-32c-castagnoli': {
    name: 'CRC-32C/Castagnoli',
    width: 32,
    poly: 0x1edc6f41n,
    init: 0xffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffn,
  },
  'crc-32-bzip2': {
    name: 'CRC-32/BZIP2',
    width: 32,
    poly: 0x04c11db7n,
    init: 0xffffffffn,
    refin: false,
    refout: false,
    xorout: 0xffffffffn,
  },
  'crc-32-mpeg2': {
    name: 'CRC-32/MPEG-2',
    width: 32,
    poly: 0x04c11db7n,
    init: 0xffffffffn,
    refin: false,
    refout: false,
    xorout: 0x00000000n,
  },
  'crc-64-xz': {
    name: 'CRC-64/XZ',
    width: 64,
    poly: 0x42f0e1eba9ea3693n,
    init: 0xffffffffffffffffn,
    refin: true,
    refout: true,
    xorout: 0xffffffffffffffffn,
  },
  'crc-64-ecma182': {
    name: 'CRC-64/ECMA-182',
    width: 64,
    poly: 0x42f0e1eba9ea3693n,
    init: 0x0000000000000000n,
    refin: false,
    refout: false,
    xorout: 0x0000000000000000n,
  },
};

function maskFor(width: number): bigint {
  return (1n << BigInt(width)) - 1n;
}

function reverseBits(value: bigint, width: number): bigint {
  let out = 0n;
  let v = value;
  for (let i = 0; i < width; i += 1) {
    out = (out << 1n) | (v & 1n);
    v >>= 1n;
  }
  return out;
}

function reverseBitsSmall(value: number, width: number): number {
  let out = 0;
  let v = value;
  for (let i = 0; i < width; i += 1) {
    out = (out << 1) | (v & 1);
    v >>>= 1;
  }
  return out >>> 0;
}

const tableCache = new Map<string, Uint32Array>();

/**
 * Build the 256-entry table for widths <= 32. Two shapes are needed because the
 * register is shifted in opposite directions: reflected (LSB-first folklore
 * implementation) and normal (MSB-first).
 */
function tableFor(p: Params): Uint32Array {
  const key = `${p.width}:${p.refin}:${p.poly.toString(16)}`;
  const hit = tableCache.get(key);
  if (hit !== undefined) return hit;

  const width = p.width;
  const mask = width === 32 ? 0xffffffff : (1 << width) - 1;
  const poly = Number(p.poly & BigInt(mask)) & mask;
  const table = new Uint32Array(256);

  if (p.refin) {
    // Reflected table: reverse the polynomial, then walk bit 0 upward.
    const polyRef = reverseBitsSmall(poly, width);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? ((c >>> 1) ^ polyRef) & mask : (c >>> 1) & mask;
      table[n] = c;
    }
  } else {
    const shift = width - 8;
    for (let n = 0; n < 256; n += 1) {
      let c = (n << shift) & mask;
      for (let bit = 0; bit < 8; bit += 1)
        c = c & (1 << (width - 1)) ? ((c << 1) ^ poly) & mask : (c << 1) & mask;
      table[n] = c;
    }
  }
  tableCache.set(key, table);
  return table;
}

/**
 * Table-driven engine for widths <= 32. Uses Number arithmetic throughout, so
 * the eight bit tests per byte become one array lookup. Agrees with the
 * reference engine on every preset; tested against the same baked literals.
 */
function crcComputeSmall(bytes: Uint8Array, p: Params): bigint {
  const width = p.width;
  const mask = width === 32 ? 0xffffffff : (1 << width) - 1;
  const table = tableFor(p);
  let crc = Number(p.init & BigInt(mask)) & mask;

  if (p.refin) {
    for (let index = 0; index < bytes.length; index += 1) {
      crc = ((crc >>> 8) ^ table[(crc ^ bytes[index]!) & 0xff]!) & mask;
    }
    // The register is already in reflected order.
    if (!p.refout) crc = reverseBitsSmall(crc, width);
  } else {
    const shift = width - 8;
    for (let index = 0; index < bytes.length; index += 1) {
      crc = ((crc << 8) ^ table[((crc >>> shift) ^ bytes[index]!) & 0xff]!) & mask;
    }
    if (p.refout) crc = reverseBitsSmall(crc, width);
  }
  // A 32-bit mask applied with `&` yields a SIGNED int32 (for example -1), and
  // BigInt(-) would make the result negative. `>>> 0` reinterprets it unsigned.
  return BigInt(crc >>> 0) ^ p.xorout;
}

const wideTableCache = new Map<string, bigint[]>();

/**
 * 256-entry BigInt table for widths above 32.
 *
 * Each entry is the register after moving one already-XORed-in byte up to the
 * top and running the eight reference steps. Using it turns the inner bit loop
 * into a single lookup and one shift per byte.
 */
function wideTableFor(p: Params): bigint[] {
  const key = `${p.width}:${p.refin}:${p.poly.toString(16)}`;
  const hit = wideTableCache.get(key);
  if (hit !== undefined) return hit;

  const mask = maskFor(p.width);
  const topBit = 1n << BigInt(p.width - 1);
  const feedShift = BigInt(p.width - 8);
  const table: bigint[] = [];
  for (let n = 0; n < 256; n += 1) {
    // The byte is placed UNREFLECTED here. RefIn is applied at lookup time in
    // crcComputeWide, where the index is combined with the reflected input byte.
    // Reflecting in both places cancels out and yields a wrong checksum.
    let c = BigInt(n) << feedShift;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((c & topBit) !== 0n) c = ((c << 1n) ^ p.poly) & mask;
      else c = (c << 1n) & mask;
    }
    table.push(c);
  }
  wideTableCache.set(key, table);
  return table;
}

/**
 * Table-driven engine for widths above 32. Equivalent to the reference engine:
 * the byte is reflected into the top of the register exactly as there, then the
 * precomputed eight shifts replace the inner loop.
 */
function crcComputeWide(bytes: Uint8Array, p: Params): bigint {
  const mask = maskFor(p.width);
  const table = wideTableFor(p);
  const feedShift = BigInt(p.width - 8);
  let crc = p.init & mask;

  const input = new Uint8Array(256);
  for (let n = 0; n < 256; n += 1) {
    input[n] = p.refin ? Number(reverseBits(BigInt(n), 8)) : n;
  }
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = input[bytes[index]!]!;
    // Shift the register up one byte, drop the overflow, index by the top byte.
    crc = ((crc << 8n) & mask) ^ table[Number(((crc >> feedShift) ^ BigInt(byte)) & 0xffn)]!;
  }
  if (p.refout) crc = reverseBits(crc, p.width);
  return crc ^ p.xorout;
}
function parseHex(raw: string, what: string, width: number): bigint {
  const cleaned = raw.trim().replace(/^0x/iu, '').replace(/[\s_]/gu, '');
  if (cleaned === '') throw new ToolError(`${what} is empty.`, `Enter a value for ${what}.`);
  if (!/^[0-9a-f]+$/iu.test(cleaned))
    throw new ToolError(
      `${what} "${raw.trim()}" is not hexadecimal.`,
      'Use digits 0-9 and letters A-F only.',
    );
  const value = BigInt(`0x${cleaned}`);
  const limit = maskFor(width);
  if (value > limit)
    throw new ToolError(
      `${what} 0x${cleaned} does not fit in ${width} bits.`,
      `The largest value for a ${width}-bit CRC is 0x${limit.toString(16)}.`,
    );
  return value;
}

function resolveParams(
  preset: string,
  width: number,
  options: Record<string, unknown>,
): Params {
  if (preset !== 'custom') {
    const found = PRESETS[preset];
    if (found === undefined)
      throw new ToolError(`Unknown CRC preset "${preset}".`, 'Choose a preset from the list.');
    return found;
  }
  if (!Number.isInteger(width) || width < 1 || width > 64)
    throw new ToolError(
      `CRC width ${width} is out of range.`,
      'Widths from 1 to 64 bits are supported.',
    );
  return {
    name: `Custom CRC-${width}`,
    width,
    poly: parseHex(String(options.poly ?? ''), 'Polynomial', width),
    init: parseHex(String(options.init ?? ''), 'Initial value', width),
    refin: String(options.refin ?? 'no') === 'yes',
    refout: String(options.refout ?? 'no') === 'yes',
    xorout: parseHex(String(options.xorout ?? ''), 'Final XOR', width),
  };
}

function formatValue(value: bigint, width: number, base: string, upper: boolean): string {
  if (base === 'decimal') return value.toString(10);
  const digits = Math.ceil(width / 4);
  const text = value.toString(16).padStart(digits, '0');
  return upper ? text.toUpperCase() : text.toLowerCase();
}

function hexWord(value: bigint, width: number): string {
  const digits = Math.ceil(width / 4);
  const text = value.toString(16).padStart(digits, '0').toUpperCase();
  return `0x${text}`;
}

function crcCompute(bytes: Uint8Array, p: Params): bigint {
  return p.width <= 32 ? crcComputeSmall(bytes, p) : crcComputeWide(bytes, p);
}

const CHECK_LITERAL = '123456789';

async function readInput(
  input: FileRunInput,
): Promise<{ bytes: Uint8Array; label: string }> {
  const file = (input.files ?? [])[0];
  if (file !== undefined) {
    if (file.size > MAX_BYTES)
      throw new ToolError(
        'That file is larger than 128 MB.',
        'The CRC is computed over the whole file in memory.',
      );
    return { bytes: new Uint8Array(await file.arrayBuffer()), label: file.name };
  }
  if (input.text !== undefined && input.text !== '')
    return { bytes: new TextEncoder().encode(input.text), label: '(pasted text)' };
  throw new ToolError('Nothing to checksum.', 'Choose a file or paste some text.');
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options) as Record<string, unknown>;
  const preset = String(options.preset ?? 'crc-32-iso-hdlc');
  const widthOption = Number(options.width ?? 32);
  const base = String(options.output ?? 'hex') === 'decimal' ? 'decimal' : 'hex';
  const upper = String(options.uppercase ?? 'yes') !== 'no';

  const params = resolveParams(preset, widthOption, options);
  const { bytes, label } = await readInput(input);

  const value = crcCompute(bytes, params);
  const checkValue = crcCompute(new TextEncoder().encode(CHECK_LITERAL), params);

  const rows: string[][] = [
    ['CRC', params.name],
    ['Input', label],
    ['Length', `${bytes.length} byte(s)`],
    ['Result (hex)', formatValue(value, params.width, 'hex', upper)],
    ['Result (hex, prefixed)', hexWord(value, params.width)],
    ['Result (decimal)', value.toString(10)],
    ['Width', `${params.width} bits`],
    ['Polynomial', hexWord(params.poly, params.width)],
    ['Initial value', hexWord(params.init, params.width)],
    ['Reflect input', params.refin ? 'yes' : 'no'],
    ['Reflect output', params.refout ? 'yes' : 'no'],
    ['Final XOR', hexWord(params.xorout, params.width)],
    ['Check value ("123456789")', formatValue(checkValue, params.width, base, upper)],
  ];

  return {
    outputs: [],
    report: { output: JSON.stringify({ headers: ['Property', 'Value'], rows }), render: 'table' },
    notes: [`${params.name} of ${label}: ${formatValue(value, params.width, base, upper)}`],
    stats: { bytes: bytes.length, width: params.width },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;