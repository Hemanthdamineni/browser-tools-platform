import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ieee754-inspector.meta';

const MAX_LINES = 500;
const MAX_INPUT = 100_000;

type Format = 'float64' | 'float32';
type Kind = 'decimal' | 'bits' | 'binary-bits';

interface Parts {
  format: Format;
  width: number;
  sign: number;
  exponentBits: string;
  unbiased: number | null;
  mantissaHex: string;
  hex: string;
  binary: string;
  className: string;
  value: number;
}

function widthOf(format: Format): number {
  return format === 'float64' ? 64 : 32;
}

function decodeBits(format: Format, bits: bigint): number {
  const dv = new DataView(new ArrayBuffer(format === 'float64' ? 8 : 4));
  if (format === 'float64') {
    dv.setBigUint64(0, bits, false);
    return dv.getFloat64(0, false);
  }
  dv.setUint32(0, Number(bits), false);
  return dv.getFloat32(0, false);
}

function encodeNumber(format: Format, value: number): bigint {
  const dv = new DataView(new ArrayBuffer(format === 'float64' ? 8 : 4));
  if (format === 'float64') {
    dv.setFloat64(0, value, false);
    return dv.getBigUint64(0, false);
  }
  dv.setFloat32(0, value, false);
  return BigInt(dv.getUint32(0, false));
}

function analyse(format: Format, bits: bigint): Parts {
  const width = widthOf(format);
  const fracBits = format === 'float64' ? 52n : 23n;
  const expBits = format === 'float64' ? 11 : 8;
  const bias = format === 'float64' ? 1023 : 127;
  const expMax = (1 << expBits) - 1;

  const sign = Number(bits >> BigInt(width - 1));
  const exp = Number((bits >> fracBits) & ((1n << BigInt(expBits)) - 1n));
  const frac = bits & ((1n << fracBits) - 1n);

  let className: string;
  if (exp === expMax) className = frac === 0n ? 'Infinity' : 'NaN';
  else if (exp === 0) className = frac === 0n ? (sign === 1 ? 'Negative zero' : 'Zero') : 'Subnormal';
  else className = 'Normal';

  const hexBody = bits.toString(16).toUpperCase().padStart(width / 4, '0');
  const binary = bits.toString(2).padStart(width, '0');

  return {
    format,
    width,
    sign,
    exponentBits: exp.toString(2).padStart(expBits, '0'),
    unbiased: className === 'Normal' ? exp - bias : null,
    mantissaHex: frac.toString(16).toUpperCase().padStart(format === 'float64' ? 13 : 6, '0'),
    hex: '0x' + hexBody,
    binary,
    className,
    value: decodeBits(format, bits),
  };
}

function valueText(parts: Parts): string {
  if (parts.className === 'NaN') return 'NaN';
  if (parts.className === 'Infinity') return parts.sign === 1 ? '-Infinity' : 'Infinity';
  return String(parts.value);
}

function groupBinary(binary: string, grouped: boolean): string {
  if (!grouped) return binary;
  const out: string[] = [];
  for (let i = 0; i < binary.length; i += 8) out.push(binary.slice(i, i + 8));
  return out.join(' ');
}

function byteString(hex: string, littleEndian: boolean): string {
  const body = hex.slice(2);
  const pairs: string[] = [];
  for (let i = 0; i < body.length; i += 2) pairs.push(body.slice(i, i + 2));
  return (littleEndian ? pairs.reverse() : pairs).join(' ');
}

function detectKind(raw: string): Kind {
  const cleaned = raw.replace(/[\s_]/gu, '');
  if (/^[-+]?(inf|infinity|nan)$/iu.test(cleaned)) return 'decimal';
  if (/^[01]{32}$|^[01]{64}$/u.test(cleaned)) return 'binary-bits';

  const lower = cleaned.toLowerCase();
  const body = lower.startsWith('0x') ? lower.slice(2) : lower;
  if (/^[0-9a-f]+$/u.test(body) && (body.length === 8 || body.length === 16)) {
    if (lower.startsWith('0x') || /[a-f]/u.test(body)) return 'bits';
  }
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/u.test(cleaned)) return 'decimal';

  throw new ToolError(
    'Could not read "' + raw + '".',
    'Use a decimal number, a 0x hex pattern of 8 or 16 digits, or a 32/64-character binary pattern.',
  );
}

function parseDecimal(raw: string): number {
  const cleaned = raw.replace(/[\s_]/gu, '');
  const lower = cleaned.toLowerCase();
  if (lower === 'nan' || lower === '+nan' || lower === '-nan') return NaN;
  if (lower === 'inf' || lower === '+inf' || lower === 'infinity' || lower === '+infinity') return Infinity;
  if (lower === '-inf' || lower === '-infinity') return -Infinity;
  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    throw new ToolError('Could not read "' + raw + '" as a number.');
  }
  return value;
}

function parseBits(kind: Kind, raw: string): { width: number; bits: bigint } {
  const cleaned = raw.replace(/[\s_]/gu, '');
  if (kind === 'binary-bits') {
    return { width: cleaned.length, bits: BigInt('0b' + cleaned) };
  }
  const body = cleaned.toLowerCase().startsWith('0x') ? cleaned.slice(2) : cleaned;
  return { width: body.length * 4, bits: BigInt('0x' + body) };
}

function formatsFor(precision: string): Format[] {
  if (precision === 'float32') return ['float32'];
  if (precision === 'float64') return ['float64'];
  return ['float64', 'float32'];
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const inputMode = String(o.inputMode ?? 'auto');
  const precision = String(o.precision ?? 'both');
  const littleEndian = String(o.byteOrder ?? 'little') !== 'big';
  const grouped = o.groupBits !== false;
  const format = String(o.format ?? 'table') === 'lines' ? 'lines' : 'table';

  const text = String(input.text ?? '');
  if (text === '') throw new ToolError('Paste a number or a bit pattern to inspect.');
  if (text.length > MAX_INPUT) {
    throw new ToolError('Input is too large.', 'Keep it under ' + MAX_INPUT + ' characters.');
  }

  const lines = text
    .split(/\r\n|\r|\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (lines.length === 0) throw new ToolError('Paste a number or a bit pattern to inspect.');
  if (lines.length > MAX_LINES) {
    throw new ToolError('Too many lines to inspect.', 'Keep it under ' + MAX_LINES + ' lines.');
  }

  const rows: string[][] = [];
  const parts: Parts[] = [];
  let precisionLosses = 0;
  let overflows = 0;
  let underflows = 0;
  const warnings: string[] = [];

  for (const raw of lines) {
    const kind: Kind = inputMode === 'decimal' ? 'decimal' : inputMode === 'bits' ? detectBitsKind(raw) : detectKind(raw);

    if (kind === 'decimal') {
      const value = parseDecimal(raw);
      const cleaned = raw.replace(/[\s_]/gu, '');
      const special = /inf|nan/iu.test(cleaned);
      if (!special) {
        if (!Number.isFinite(value)) overflows += 1;
        else if (value === 0 && !/^[-+]?0*(\.0*)?([eE][-+]?\d+)?$/u.test(cleaned)) underflows += 1;
      }

      let lineLoss = false;
      for (const candidate of formatsFor(precision)) {
        const bits = encodeNumber(candidate, value);
        const decoded = decodeBits(candidate, bits);
        if (!Number.isNaN(value) && decoded !== value) lineLoss = true;
        parts.push(analyse(candidate, bits));
      }
      if (lineLoss) precisionLosses += 1;
      continue;
    }

    const parsed = parseBits(kind, raw);
    const detected: Format = parsed.width === 64 ? 'float64' : 'float32';
    if (precision !== 'both' && formatsFor(precision)[0] !== detected) {
      throw new ToolError(
        'That bit pattern is ' + parsed.width + ' bits wide.',
        'Choose the matching format, or use auto-detect.',
      );
    }
    parts.push(analyse(detected, parsed.bits));
  }

  for (const item of parts) {
    rows.push([
      item.format === 'float64' ? 'float64' : 'float32',
      item.sign === 1 ? '1 (-)' : '0 (+)',
      item.exponentBits,
      item.unbiased === null ? 'n/a' : String(item.unbiased),
      item.mantissaHex,
      item.hex,
      groupBinary(item.binary, grouped),
      byteString(item.hex, littleEndian),
      item.className,
      valueText(item),
    ]);
  }

  const notes: string[] = [];
  if (inputMode === 'auto') {
    notes.push(
      'Auto-detect: 32/64-character binary and 8/16-digit hex strings are read as bit patterns; anything else as a decimal number.',
    );
  }
  notes.push('Bytes are shown ' + (littleEndian ? 'little-endian' : 'big-endian') + '.');
  if (lines.length > 1) {
    notes.push('Inspected ' + lines.length + ' input line(s).');
  }
  if (precisionLosses > 0) {
    warnings.push(
      'Some decimal values are not exactly representable and were rounded to the nearest float (' +
        precisionLosses +
        ' case(s)).',
    );
  }
  if (overflows > 0) {
    warnings.push('A value was too large for the chosen format and became Infinity.');
  }
  if (underflows > 0) {
    warnings.push('A value was too small for the chosen format and became zero.');
  }
  if (parts.some((item) => item.className === 'NaN')) {
    warnings.push('NaN has many bit patterns: any non-zero mantissa with all exponent bits set.');
  }
  if (parts.some((item) => item.className === 'Subnormal')) {
    notes.push('Subnormal values have all exponent bits zero and a non-zero mantissa.');
  }

  const stats: Record<string, string | number> = {
    inputs: lines.length,
    rows: rows.length,
    precisionLosses,
  };

  if (format === 'table') {
    return {
      output: JSON.stringify({
        headers: [
          'Format',
          'Sign',
          'Exponent',
          'Unbiased',
          'Mantissa',
          'Hex',
          'Binary',
          'Bytes',
          'Class',
          'Value',
        ],
        rows,
      }),
      render: 'table',
      notes,
      warnings,
      stats,
    };
  }

  const output = parts
    .map(
      (item) =>
        item.format +
        '  ' +
        item.hex +
        '  sign=' +
        item.sign +
        '  exp=' +
        item.exponentBits +
        ' (unbiased ' +
        (item.unbiased === null ? 'n/a' : item.unbiased) +
        ')  mantissa=' +
        item.mantissaHex +
        '  bytes=' +
        byteString(item.hex, littleEndian) +
        '  class=' +
        item.className +
        '  value=' +
        valueText(item),
    )
    .join('\n');

  return { output, render: 'code', notes, warnings, stats };
}

function detectBitsKind(raw: string): Kind {
  const cleaned = raw.replace(/[\s_]/gu, '');
  return /^[01]+$/u.test(cleaned) ? 'binary-bits' : 'bits';
}

const tool: TextToolModule = { meta, run };
export default tool;
