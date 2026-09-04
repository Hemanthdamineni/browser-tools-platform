import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './crc32.meta';

/** Build a 256-entry lookup table for a reversed CRC polynomial. */
function makeTable(poly: number): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (poly ^ (c >>> 1)) >>> 0 : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = makeTable(0xedb88320);
const CRC32C_TABLE = makeTable(0x82f63b78);

function crc(bytes: Uint8Array, table: Uint32Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = (table[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  const MOD = 65521;
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]!) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const variant = String(o.variant);
  const bytes = new TextEncoder().encode(input.text);

  let value: number;
  let label: string;
  if (variant === 'crc32') {
    value = crc(bytes, CRC32_TABLE);
    label = 'CRC-32';
  } else if (variant === 'crc32c') {
    value = crc(bytes, CRC32C_TABLE);
    label = 'CRC-32C';
  } else if (variant === 'adler32') {
    value = adler32(bytes);
    label = 'Adler-32';
  } else {
    throw new ToolError(`Unknown variant "${variant}".`, 'Use crc32, crc32c or adler32.');
  }

  const unsigned = value >>> 0;
  const hex = unsigned.toString(16).padStart(8, '0');

  let out: string;
  if (String(o.output) === 'decimal') {
    out = String(unsigned);
  } else {
    out = o.uppercase ? hex.toUpperCase() : hex;
  }

  return {
    output: out,
    render: 'code',
    stats: {
      variant: label,
      bytes: bytes.length,
      decimal: unsigned,
      hex: `0x${hex}`,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
