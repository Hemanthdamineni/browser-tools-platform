import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './calculator.meta';

/* Safe recursive-descent expression evaluator — NO eval / new Function. */

const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600, 6227020800, 87178291200, 1307674368000, 20922789888000, 355687428096000, 6402373705728000, 121645100408832000, 2432902008176640000];

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

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
    const c = src[i]!;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '_') {
      i++;
      continue;
    }
    if (c === ',') {
      toks.push({ t: 'comma' });
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i;
      let dotted = false;
      while (j < n) {
        const d = src[j]!;
        if (d >= '0' && d <= '9') j++;
        else if (d === '.' && !dotted) {
          dotted = true;
          j++;
        } else break;
      }
      toks.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < n && /[a-zA-Z]/.test(src[j]!)) j++;
      toks.push({ t: 'name', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/%^!'.includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') {
      toks.push({ t: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      toks.push({ t: 'rp' });
      i++;
      continue;
    }
    throw new ToolError(`Unexpected character "${c}".`, 'Use + - * / % ^ and parentheses.');
  }
  return toks;
}

class Parser {
  private pos = 0;
  constructor(
    private toks: Tok[],
    private deg: boolean,
  ) {}

  parse(): number {
    const v = this.expression();
    this.expectEnd();
    return v;
  }

  private require(what: string): void {
    if (this.pos >= this.toks.length) throw new ToolError(`Expected ${what}.`, 'The expression is incomplete.');
  }

  private advance(): Tok {
    const t = this.toks[this.pos];
    this.pos++;
    return t!;
  }

  private peek(): Tok | undefined {
    return this.toks[this.pos];
  }

  private expectEnd(): void {
    if (this.pos !== this.toks.length) {
      const t = this.toks[this.pos]!;
      throw new ToolError(`Unexpected "${tokText(t)}" after the expression.`);
    }
  }

  private expression(): number {
    return this.term();
  }

  private term(): number {
    let left = this.factor();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.advance();
        const right = this.factor();
        left = t.v === '+' ? left + right : left - right;
      } else break;
    }
    return left;
  }

  private factor(): number {
    let left = this.power();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) {
        this.advance();
        const right = this.power();
        if (t.v === '*') left = left * right;
        else if (t.v === '/') {
          if (right === 0) throw new ToolError('Cannot divide by zero.');
          left = left / right;
        } else {
          if (right === 0) throw new ToolError('Cannot take modulo by zero.');
          left = left % right;
        }
      } else break;
    }
    return left;
  }

  private power(): number {
    const base = this.unary();
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '^') {
      this.advance();
      // Right-associative: exponent is itself a power expression.
      const exp = this.power();
      return Math.pow(base, exp);
    }
    return base;
  }

  private unary(): number {
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '-') {
      this.advance();
      return -this.unary();
    }
    if (t && t.t === 'op' && t.v === '+') {
      this.advance();
      return this.unary();
    }
    return this.postfix();
  }

  private postfix(): number {
    const base = this.primary();
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '!') {
      this.advance();
      const n = Math.round(base);
      if (Math.abs(base - n) > 1e-9 || n < 0) throw new ToolError('Factorial requires a non-negative integer.');
      if (n > 18) throw new ToolError(`Factorial of ${n} is too large to compute.`);
      return FACT[n]!;
    }
    return base;
  }

  private primary(): number {
    this.require('a value');
    const tk = this.toks[this.pos];
    if (!tk) throw new ToolError('Expected a value.', 'The expression is incomplete.');
    if (tk.t === 'num') {
      this.advance();
      return tk.v;
    }
    if (tk.t === 'lp') {
      this.advance();
      const v = this.expression();
      this.require("')'");
      const close = this.advance();
      if (close.t !== 'rp') throw new ToolError('Expected a closing parenthesis.');
      return v;
    }
    if (tk.t === 'name') {
      this.advance();
      return this.applyFunction(tk.v);
    }
    throw new ToolError(`Unexpected "${tokText(tk)}".`, 'Expected a number, name or an opening parenthesis.');
  }

  private applyFunction(name: string): number {
    if (name === 'pi') return Math.PI;
    if (name === 'e') return Math.E;

    if (this.peek()?.t !== 'lp') {
      throw new ToolError(`Unknown value or function "${name}".`);
    }
    this.advance(); // consume '('
    const args: number[] = [];
    if (this.peek()?.t === 'rp') {
      this.advance();
    } else {
      args.push(this.expression());
      while (this.peek()?.t === 'comma') {
        this.advance();
        args.push(this.expression());
      }
      const close = this.peek();
      if (!close || close.t !== 'rp') throw new ToolError(`Expected ')' to close ${name}(...).`);
      this.advance();
    }

    const one = args[0]!;
    switch (name) {
      case 'sqrt':
        if (one < 0) throw new ToolError('sqrt requires a non-negative argument.');
        return Math.sqrt(one);
      case 'cbrt':
        return Math.cbrt(one);
      case 'abs':
        return Math.abs(one);
      case 'round':
        return Math.round(one);
      case 'floor':
        return Math.floor(one);
      case 'ceil':
        return Math.ceil(one);
      case 'sign':
        return Math.sign(one);
      case 'ln':
        if (one <= 0) throw new ToolError('ln requires a positive argument.');
        return Math.log(one);
      case 'log':
        if (one <= 0) throw new ToolError('log requires a positive argument.');
        return Math.log10(one);
      case 'log2':
        if (one <= 0) throw new ToolError('log2 requires a positive argument.');
        return Math.log2(one);
      case 'exp':
        return Math.exp(one);
      case 'sin':
        return Math.sin(this.trig(one));
      case 'cos':
        return Math.cos(this.trig(one));
      case 'tan':
        return Math.tan(this.trig(one));
      case 'asin':
        if (one < -1 || one > 1) throw new ToolError('asin requires an argument between -1 and 1.');
        return this.untrig(Math.asin(one));
      case 'acos':
        if (one < -1 || one > 1) throw new ToolError('acos requires an argument between -1 and 1.');
        return this.untrig(Math.acos(one));
      case 'atan':
        return this.untrig(Math.atan(one));
      case 'atan2':
        if (args.length < 2) throw new ToolError('atan2 requires two arguments.');
        return this.untrig(Math.atan2(one, args[1]!));
      case 'sinh':
        return Math.sinh(one);
      case 'cosh':
        return Math.cosh(one);
      case 'tanh':
        return Math.tanh(one);
      case 'min':
        if (args.length === 0) throw new ToolError('min requires at least one argument.');
        return Math.min(...args);
      case 'max':
        if (args.length === 0) throw new ToolError('max requires at least one argument.');
        return Math.max(...args);
      case 'pow':
        if (args.length < 2) throw new ToolError('pow requires two arguments.');
        return Math.pow(one, args[1]!);
      case 'hypot':
        return Math.hypot(...args);
      case 'gcd': {
        if (args.length === 0) throw new ToolError('gcd requires at least one argument.');
        return args.reduce((a, b) => gcd(a, b), 0);
      }
      case 'factorial':
        return this.fact(one);
      default:
        throw new ToolError(`Unknown function "${name}".`);
    }
  }

  private fact(v: number): number {
    const n = Math.round(v);
    if (Math.abs(v - n) > 1e-9 || n < 0) throw new ToolError('Factorial requires a non-negative integer.');
    if (n > 18) throw new ToolError(`Factorial of ${n} is too large to compute.`);
    return FACT[n]!;
  }

  private trig(v: number): number {
    return this.deg ? (v * Math.PI) / 180 : v;
  }

  private untrig(v: number): number {
    return this.deg ? (v * 180) / Math.PI : v;
  }
}

function tokText(t: Tok): string {
  switch (t.t) {
    case 'num':
      return String(t.v);
    case 'name':
      return t.v;
    case 'op':
      return `"${t.v}"`;
    case 'lp':
      return '"("';
    case 'rp':
      return '")"';
    case 'comma':
      return '","';
  }
}

function formatNumber(v: number, precision: number): string {
  if (Number.isInteger(v) && Math.abs(v) < 1e21) return String(v);
  const s = v.toFixed(precision);
  return s.replace(/\.?0+$/, '');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };

  const precision = Math.max(0, Math.min(15, Math.floor(Number(o.precision) || 10)));
  const deg = String(o.angleMode) === 'degrees';

  const toks = tokenize(text);
  if (toks.length === 0) return { output: '' };
  const value = new Parser(toks, deg).parse();
  const formatted = formatNumber(value, precision);

  return {
    output: formatted,
    render: 'text',
    stats: { result: formatted },
    notes: [`Parsed expression: ${text}`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
