import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './fraction-simplify.meta';

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

/** Returns [numerator, denominator] for a reduced fraction, or null on parse failure. */
function parseFraction(input: string): [number, number] | null {
  const t = input.trim();
  if (!t) return null;

  if (t.includes('/')) {
    const m = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(t);
    if (!m) return null;
    const n = Number(m[1]);
    const d = Number(m[2]);
    if (d === 0) throw new ToolError('The denominator cannot be zero.');
    return reduce(n, d);
  }

  // Integer or decimal, e.g. 3, 0.75, -1.5, 2.250
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(t);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const whole = m[2] ?? '0';
  const frac = (m[3] ?? '').replace(/0+$/, '');
  if (frac === '') {
    return reduce(sign * Number(whole), 1);
  }
  const dp = frac.length;
  const denominator = Math.pow(10, dp);
  const numerator = sign * (Number(whole) * denominator + Number(frac));
  return reduce(numerator, denominator);
}

function reduce(n: number, d: number): [number, number] {
  const sign = (n < 0) !== (d < 0) ? -1 : 1;
  const an = Math.abs(n);
  const ad = Math.abs(d) || 1;
  const g = gcd(an, ad);
  return [sign * (an / g), ad / g];
}

function mixed(n: number, d: number): string {
  const sign = n < 0 ? '-' : '';
  const an = Math.abs(n);
  const whole = Math.floor(an / d);
  const rem = an % d;
  if (rem === 0) return (sign === '-' && whole === 0 ? '0' : sign + String(whole));
  if (whole === 0) return sign + rem + '/' + d;
  return sign + whole + ' ' + rem + '/' + d;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const useMixed = o.mixedNumber === true;
  const source = (input.text ?? '').trim();
  if (!source) throw new ToolError('Enter a fraction (a/b) or a decimal to simplify.');

  let parsed: [number, number] | null;
  try {
    parsed = parseFraction(source);
  } catch (e) {
    if (e instanceof ToolError) throw e;
    parsed = null;
  }
  if (parsed === null) throw new ToolError('Not a parseable fraction or decimal.', 'Examples: 12/18, 0.75, -1.5, 4.');

  const [num, den] = parsed;
  if (den === 0) throw new ToolError('The denominator cannot be zero.');

  const reduced = num % den === 0 ? String(num / den) : num + '/' + den;
  const display = useMixed && num % den !== 0 ? mixed(num, den) : reduced;
  const decimal = num / den;

  return {
    output: display + '\n',
    render: 'text',
    language: 'text',
    stats: { numerator: num, denominator: den, decimal },
    notes: [
      'Reduced by gcd ' + gcd(num, den) + ' → ' + num + '/' + den + '.',
      decimal % 1 === 0 ? '' : 'Decimal value: ' + decimal + '.',
    ].filter(Boolean),
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
