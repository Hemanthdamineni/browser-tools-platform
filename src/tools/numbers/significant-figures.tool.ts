import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './significant-figures.meta';

const MAX_LINES = 500;
const MAX_INPUT = 100_000;

interface SigInfo {
  negative: boolean;
  sigFigs: number;
  decimals: number;
  ambiguous: boolean;
  zero: boolean;
  value: number;
  scientific: string;
  engineering: string;
}

function mantissa(digits: string): string {
  return digits.length > 1 ? digits.charAt(0) + '.' + digits.slice(1) : digits;
}

function formatScientific(negative: boolean, digits: string, exponent: number): string {
  return (negative ? '-' : '') + mantissa(digits) + 'e' + exponent;
}

/**
 * Engineering notation keeps the exponent a multiple of three, so the mantissa
 * holds one to three digits before the point.
 */
function formatEngineering(negative: boolean, digits: string, exponent: number): string {
  const engExponent = Math.floor(exponent / 3) * 3;
  const pointPosition = exponent - engExponent + 1;
  const padded = digits.padEnd(pointPosition, '0');
  const whole = padded.slice(0, pointPosition);
  const fraction = padded.slice(pointPosition);
  return (negative ? '-' : '') + whole + (fraction === '' ? '' : '.' + fraction) + 'e' + engExponent;
}

function analyseLiteral(raw: string): SigInfo {
  const cleaned = raw.replace(/[,\s_]/gu, '');
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/u.exec(cleaned);
  if (match === null) {
    throw new ToolError(
      'Could not read "' + raw + '" as a number.',
      'Use a plain decimal such as 0.00450, 1200. or 1.230e5.',
    );
  }

  const negative = match[1] === '-';
  const intPart = match[2] ?? '';
  const fracRaw = match[3];
  const hasDecimal = fracRaw !== undefined;
  const fracPart = fracRaw ?? '';
  if (intPart === '' && fracPart === '') {
    throw new ToolError('Could not read "' + raw + '" as a number.');
  }

  const expPart = match[4] === undefined ? 0 : Number(match[4]);
  const value = Number(cleaned);

  const allDigits = intPart + fracPart;
  const pointPosition = intPart.length;
  const decimals = hasDecimal ? fracPart.length : 0;

  if (/^0*$/u.test(allDigits)) {
    const sigFigs = hasDecimal ? Math.max(1, fracPart.length) : 1;
    return {
      negative,
      sigFigs,
      decimals,
      ambiguous: false,
      zero: true,
      value,
      scientific: '0',
      engineering: '0',
    };
  }

  let lead = 0;
  while (lead < allDigits.length && allDigits.charAt(lead) === '0') lead += 1;
  let digits = allDigits.slice(lead);
  const firstExponent = pointPosition - 1 - lead;

  // Without a decimal point, trailing zeros are not significant - and that
  // makes the reading ambiguous, so the caller is told.
  let ambiguous = false;
  if (!hasDecimal) {
    const trimmed = digits.replace(/0+$/u, '');
    if (trimmed.length !== digits.length) ambiguous = true;
    digits = trimmed;
  }

  const exponent = firstExponent + expPart;

  return {
    negative,
    sigFigs: digits.length,
    decimals,
    ambiguous,
    zero: false,
    value,
    scientific: formatScientific(negative, digits, exponent),
    engineering: formatEngineering(negative, digits, exponent),
  };
}

function formatRounded(value: number, roundTo: number): string {
  if (roundTo <= 0) return 'n/a';
  if (!Number.isFinite(value)) return String(value);
  return value.toPrecision(Math.min(21, roundTo));
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const roundTo = Math.max(0, Math.min(21, Number(o.roundTo ?? 0)));
  const format = String(o.format ?? 'table') === 'lines' ? 'lines' : 'table';

  const text = String(input.text ?? '');
  if (text === '') throw new ToolError('Paste one number per line to analyse.');
  if (text.length > MAX_INPUT) {
    throw new ToolError('Input is too large.', 'Keep it under ' + MAX_INPUT + ' characters.');
  }

  const lines = text
    .split(/\r\n|\r|\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (lines.length === 0) throw new ToolError('Paste one number per line to analyse.');
  if (lines.length > MAX_LINES) {
    throw new ToolError('Too many numbers.', 'Keep it under ' + MAX_LINES + ' lines.');
  }

  const analysed = lines.map((line) => ({ raw: line, info: analyseLiteral(line) }));

  const rows: string[][] = analysed.map((item) => [
    item.raw,
    String(item.info.sigFigs),
    String(item.info.decimals),
    item.info.scientific,
    item.info.engineering,
    String(item.info.value),
    formatRounded(item.info.value, roundTo),
  ]);

  const notes: string[] = [];
  const warnings: string[] = [];

  const ambiguous = analysed.filter((item) => item.info.ambiguous);
  if (ambiguous.length > 0) {
    notes.push(
      'Ambiguous: ' +
        ambiguous
          .map((item) => '"' + item.raw + '"')
          .join(', ') +
        ' has trailing zeros with no decimal point, so the digit count may understate its precision. Write 1200. or 1.200e3 to be explicit.',
    );
  }
  if (analysed.some((item) => item.info.zero)) {
    notes.push('Zero is a special case: its significant figures are a matter of convention.');
  }
  if (roundTo > 0) {
    notes.push('Values are also rounded to ' + roundTo + ' significant figure(s).');
  }
  const infinite = analysed.filter((item) => !Number.isFinite(item.info.value));
  if (infinite.length > 0) {
    warnings.push('Some values are outside the range JavaScript numbers can represent exactly.');
  }

  const stats: Record<string, string | number> = {
    numbers: analysed.length,
    ambiguous: ambiguous.length,
    lowestSigFigs: analysed.reduce(
      (low, item) => Math.min(low, item.info.sigFigs),
      Number.POSITIVE_INFINITY,
    ),
  };

  if (format === 'table') {
    return {
      output: JSON.stringify({
        headers: [
          'Input',
          'Significant figures',
          'Decimal places',
          'Scientific',
          'Engineering',
          'Value',
          'Rounded',
        ],
        rows,
      }),
      render: 'table',
      notes,
      warnings,
      stats,
    };
  }

  const output = analysed
    .map(
      (item) =>
        item.raw +
        ' -> ' +
        item.info.sigFigs +
        ' sf | decimals ' +
        item.info.decimals +
        ' | sci ' +
        item.info.scientific +
        ' | eng ' +
        item.info.engineering +
        ' | value ' +
        item.info.value +
        (item.info.ambiguous ? ' | ambiguous' : ''),
    )
    .join('\n');

  return { output, render: 'code', notes, warnings, stats };
}

const tool: TextToolModule = { meta, run };
export default tool;
