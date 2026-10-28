import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './upgrade-calculator-scientific.meta';

const FACT = [
  1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600, 6227020800,
  87178291200, 1307674368000, 20922789888000, 355687428096000, 6402373705728000, 121645100408832000,
  2432902008176640000,
];

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return (Math.abs(a) / gcd(a, b)) * Math.abs(b);
}

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
  tau: 2 * Math.PI,
  sqrt2: Math.SQRT2,
  ln2: Math.LN2,
  ln10: Math.LN10,
  log2e: Math.LOG2E,
  log10e: Math.LOG10E,
};

type Tok =
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'comma' };

function tokenize(src: string): Tok[] {
  src = src.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '').replace(/_/g, '');
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];
    if (ch === undefined) break;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let hasDot = false;
      while (j < n) {
        const c = src[j];
        if (c === undefined) break;
        if (c === '.') {
          if (hasDot) break;
          hasDot = true;
        } else if (!/[0-9]/.test(c)) break;
        j++;
      }
      const num = parseFloat(src.slice(i, j));
      if (!Number.isFinite(num)) throw new ToolError(`Invalid number: ${src.slice(i, j)}`);
      toks.push({ t: 'num', v: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < n) {
        const c = src[j];
        if (c === undefined || !/[A-Za-z0-9_]/.test(c)) break;
        j++;
      }
      toks.push({ t: 'name', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '(') {
      toks.push({ t: 'lp' });
      i++;
      continue;
    }
    if (ch === ')') {
      toks.push({ t: 'rp' });
      i++;
      continue;
    }
    if (ch === ',') {
      toks.push({ t: 'comma' });
      i++;
      continue;
    }
    // Operators
    if (ch === '^' || ch === '**') {
      toks.push({ t: 'op', v: '^' });
      i += ch === '**' ? 2 : 1;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      toks.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    if (ch === '!') {
      toks.push({ t: 'op', v: '!' });
      i++;
      continue;
    }
    throw new ToolError(`Unexpected character: ${ch} at position ${i}`);
  }
  return toks;
}

class Parser {
  private toks: Tok[];
  private pos = 0;
  private angleMode: 'radians' | 'degrees' | 'gradians';

  constructor(toks: Tok[], angleMode: 'radians' | 'degrees' | 'gradians') {
    this.toks = toks;
    this.angleMode = angleMode;
  }

  private peek(): Tok | null {
    const tok = this.toks[this.pos];
    return tok ?? null;
  }

  private consume(): Tok | null {
    const tok = this.toks[this.pos];
    this.pos++;
    return tok ?? null;
  }

  private expect(type: Tok['t'], value?: string): Tok {
    const tok = this.consume();
    if (!tok || tok.t !== type) {
      throw new ToolError(`Expected ${type}${value ? ` ${value}` : ''}`);
    }
    if (value !== undefined) {
      // Only token types with 'v' property can have a value check
      if (tok.t === 'op' || tok.t === 'name' || tok.t === 'num') {
        if (tok.v !== value) {
          throw new ToolError(`Expected ${type} ${value}`);
        }
      }
    }
    return tok;
  }

  private toRadians(x: number): number {
    if (this.angleMode === 'degrees') return x * (Math.PI / 180);
    if (this.angleMode === 'gradians') return x * (Math.PI / 200);
    return x;
  }

  private fromRadians(x: number): number {
    if (this.angleMode === 'degrees') return x * (180 / Math.PI);
    if (this.angleMode === 'gradians') return x * (200 / Math.PI);
    return x;
  }

  parse(): number {
    const val = this.expression();
    if (this.peek()) throw new ToolError('Unexpected token after end of expression');
    return val;
  }

  private expression(): number {
    let left = this.term();
    while (true) {
      const tok = this.peek();
      if (tok && tok.t === 'op' && (tok.v === '+' || tok.v === '-')) {
        this.consume();
        const right = this.term();
        left = tok.v === '+' ? left + right : left - right;
      } else break;
    }
    return left;
  }

  private term(): number {
    let left = this.factor();
    while (true) {
      const tok = this.peek();
      if (tok && tok.t === 'op' && (tok.v === '*' || tok.v === '/' || tok.v === '%')) {
        this.consume();
        const right = this.factor();
        if (tok.v === '*') left *= right;
        else if (tok.v === '/') {
          if (right === 0) throw new ToolError('Division by zero');
          left /= right;
        } else left %= right;
      } else break;
    }
    return left;
  }

  private factor(): number {
    let left = this.unary();
    const tok = this.peek();
    if (tok && tok.t === 'op' && tok.v === '^') {
      this.consume();
      const right = this.factor();
      left = Math.pow(left, right);
    }
    return left;
  }

  private unary(): number {
    const tok = this.peek();
    if (tok && tok.t === 'op' && (tok.v === '+' || tok.v === '-')) {
      this.consume();
      const val = this.unary();
      return tok.v === '+' ? val : -val;
    }
    return this.postfix();
  }

  private postfix(): number {
    let val = this.primary();
    while (true) {
      const tok = this.peek();
      if (tok && tok.t === 'op' && tok.v === '!') {
        this.consume();
        if (!Number.isInteger(val) || val < 0 || val > 20) {
          throw new ToolError('Factorial requires integer 0–20');
        }
        const factVal = FACT[val];
        if (factVal === undefined) throw new ToolError('Factorial overflow');
        val = factVal;
      } else break;
    }
    return val;
  }
  private primary(): number {
    const tok = this.peek();
    if (!tok) throw new ToolError('Unexpected end of input');

    if (tok.t === 'num') {
      this.consume();
      const v = tok.v;
      if (v === undefined) throw new ToolError('Invalid number token');
      return v;
    }

    if (tok.t === 'name') {
      const name = tok.v;
      if (name === undefined) throw new ToolError('Invalid name token');
      this.consume();
      const next = this.peek();

      // Constant
      const constantVal = CONSTANTS[name];
      if (constantVal !== undefined) {
        return constantVal;
      }

      // Function call
      if (next && next.t === 'lp') {
        this.consume(); // consume '('
        const args: number[] = [];
        if (this.peek()?.t !== 'rp') {
          while (true) {
            args.push(this.expression());
            const comma = this.peek();
            if (comma && comma.t === 'comma') {
              this.consume();
              continue;
            }
            break;
          }
        }
        this.expect('rp');
        return this.callFunction(name, args);
      }
      // Constant without parens
      const constantVal2 = CONSTANTS[name];
      if (constantVal2 !== undefined) return constantVal2;

      throw new ToolError(`Unknown identifier: ${name}`);
    }

    if (tok.t === 'lp') {
      this.consume();
      const val = this.expression();
      this.expect('rp');
      return val;
    }

    throw new ToolError(`Unexpected token: ${tok.t}`);
  }

  private callFunction(name: string, args: number[]): number {
    const fn = name.toLowerCase();

    const arg = (i: number): number => {
      if (i >= args.length) throw new ToolError(`Function ${name} requires at least ${i + 1} argument(s)`);
      const val = args[i];
      if (val === undefined) throw new ToolError(`Function ${name} argument ${i + 1} is undefined`);
      return val;
    };
    const arg1 = (): number => arg(0);
    const arg2 = (): number => arg(1);
    const arg3 = (): number => arg(2);

    // Trigonometric
    if (fn === 'sin') return Math.sin(this.toRadians(arg1()));
    if (fn === 'cos') return Math.cos(this.toRadians(arg1()));
    if (fn === 'tan') return Math.tan(this.toRadians(arg1()));
    if (fn === 'asin') return this.fromRadians(Math.asin(arg1()));
    if (fn === 'acos') return this.fromRadians(Math.acos(arg1()));
    if (fn === 'atan') return this.fromRadians(Math.atan(arg1()));
    if (fn === 'atan2') return this.fromRadians(Math.atan2(arg1(), arg2()));
    if (fn === 'sinh') return Math.sinh(arg1());
    if (fn === 'cosh') return Math.cosh(arg1());
    if (fn === 'tanh') return Math.tanh(arg1());
    if (fn === 'asinh') return Math.asinh(arg1());
    if (fn === 'acosh') return Math.acosh(arg1());
    if (fn === 'atanh') return Math.atanh(arg1());

    // Logarithmic
    if (fn === 'ln') return Math.log(arg1());
    if (fn === 'log') return Math.log10(arg1());
    if (fn === 'log2') return Math.log2(arg1());
    if (fn === 'log10') return Math.log10(arg1());
    if (fn === 'log1p') return Math.log1p(arg1());

    // Exponential
    if (fn === 'exp') return Math.exp(arg1());
    if (fn === 'expm1') return Math.expm1(arg1());
    if (fn === 'pow') return Math.pow(arg1(), arg2());
    if (fn === 'sqrt') return Math.sqrt(arg1());
    if (fn === 'cbrt') return Math.cbrt(arg1());
    if (fn === 'hypot') return Math.hypot(arg1(), arg2());

    // Angle conversion
    if (fn === 'deg2rad') return arg1() * (Math.PI / 180);
    if (fn === 'rad2deg') return arg1() * (180 / Math.PI);
    if (fn === 'grad2rad') return arg1() * (Math.PI / 200);
    if (fn === 'rad2grad') return arg1() * (200 / Math.PI);

    // Statistical / combinatorics
    if (fn === 'npr') return this.permutations(arg1(), arg2());
    if (fn === 'ncr') return this.combinations(arg1(), arg2());
    if (fn === 'gcd') return gcd(arg1(), arg2());
    if (fn === 'lcm') return lcm(arg1(), arg2());

    // Rounding / misc
    if (fn === 'abs') return Math.abs(arg1());
    if (fn === 'round') return Math.round(arg1());
    if (fn === 'floor') return Math.floor(arg1());
    if (fn === 'ceil') return Math.ceil(arg1());
    if (fn === 'trunc') return Math.trunc(arg1());
    if (fn === 'sign') return Math.sign(arg1());
    if (fn === 'min') return Math.min(...args);
    if (fn === 'max') return Math.max(...args);
    if (fn === 'clamp') return Math.min(Math.max(arg1(), arg2()), arg3());
    if (fn === 'random') return Math.random();

    // Factorial
    if (fn === 'factorial') {
      const n = Math.round(arg1());
      if (!Number.isInteger(n) || n < 0 || n > 20) throw new ToolError('Factorial requires integer 0–20');
      const factVal = FACT[n];
      if (factVal === undefined) throw new ToolError('Factorial overflow');
      return factVal;
    }
    throw new ToolError(`Unknown function: ${name}`);
  }

  private permutations(n: number, r: number): number {
    n = Math.round(n);
    r = Math.round(r);
    if (n < 0 || r < 0 || r > n) throw new ToolError('Invalid nPr arguments');
    let result = 1;
    for (let i = 0; i < r; i++) result *= n - i;
    return result;
  }

  private combinations(n: number, r: number): number {
    n = Math.round(n);
    r = Math.round(r);
    if (n < 0 || r < 0 || r > n) throw new ToolError('Invalid nCr arguments');
    if (r > n - r) r = n - r;
    let result = 1;
    for (let i = 1; i <= r; i++) result = (result * (n - r + i)) / i;
    return Math.round(result);
  }
}

function formatNumber(v: number, precision: number): string {
  if (!Number.isFinite(v)) return v > 0 ? 'Infinity' : v < 0 ? '-Infinity' : 'NaN';
  if (precision < 0) precision = 10;
  if (precision > 15) precision = 15;
  const s = v.toFixed(precision);
  // Trim trailing zeros after decimal point, but keep at least one digit
  return s.replace(/\.?0+$/, '');
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const angleMode = String(options.angleMode) as 'radians' | 'degrees' | 'gradians';
  const precision = Math.round(Number(options.precision) ?? 10);
  const text = input.text?.trim();

  if (!text) {
    return {
      output: JSON.stringify({
        headers: ['Metric', 'Value'],
        rows: [
          ['Status', 'Enter an expression to evaluate'],
          ['Angle Mode', angleMode],
          ['Precision', precision.toString()],
        ],
      }),
      render: 'table',
    };
  }

  try {
    const toks = tokenize(text);
    const parser = new Parser(toks, angleMode);
    const result = parser.parse();
    const formatted = formatNumber(result, precision);

    return {
      output: formatted,
      render: 'code',
      stats: { result: formatted, angleMode, precision },
    };
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError(`Evaluation error: ${(e as Error).message}`);
  }
}

const tool: TextToolModule = { meta, run };
export default tool;