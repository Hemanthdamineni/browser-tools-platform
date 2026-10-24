/**
 * Pure, unit-testable core for `calculator`.
 *
 * Design
 * ------
 * Input   a maths expression as text, plus an angle mode.
 * Output  a finite number (or `null` for an expression that is only separators
 *         and whitespace).
 *
 * This is the single source of truth for the calculator: the recursive-descent
 * grammar, the tokenizer, every function (its implementation, keypad label and
 * whether it belongs on the scientific row) and the constants. The tool
 * (`calculator.tool.ts`) and the keypad panel (`calculator-panel.ts`) both
 * consume it, so a function can never appear on the keypad without an
 * implementation behind it.
 *
 * Safety
 * ------
 * The expression is tokenised and evaluated token by token. `eval` and
 * `new Function` are never used, so an expression is only ever numbers,
 * operators, parentheses, known names and constants — it can never reach a
 * global, the DOM or the network.
 *
 * Precedence (tightest first)
 * ---------------------------
 * `!` postfix factorial > `^` power (right-associative) > unary `+`/`-` >
 * `*` `/` `%` > `+` `-`. Power binds tighter than a leading minus, so
 * `-3^2` is `-(3^2)` = -9 and `2^3^2` is `2^(3^2)` = 512.
 */
import { ToolError } from '@/lib/types';

/* ------------------------------------------------------------------------ */
/*  Facts                                                                   */
/* ------------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------------ */
/*  Constants and operator precedence                                       */
/* ------------------------------------------------------------------------ */

/** The named constants the parser resolves, and the keypad can insert. */
export const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

/**
 * Operator precedence, tightest first. The grammar below implements exactly
 * this order; the tokenizer derives its operator characters from it, so the
 * two can never drift.
 */
export const PRECEDENCE: { level: number; ops: string[]; note: string }[] = [
  { level: 1, ops: ['!'], note: 'postfix factorial binds tightest, e.g. 5! = 120' },
  { level: 2, ops: ['^'], note: 'right-associative, tighter than unary minus' },
  { level: 3, ops: ['unary -', 'unary +'], note: 'e.g. -3^2 = -(3^2) = -9' },
  { level: 4, ops: ['*', '/', '%'], note: 'e.g. 2+3*4 = 14' },
  { level: 5, ops: ['+', '-'], note: 'loosest' },
];

/**
 * Every operator character, taken from the single-character symbols in the
 * precedence table above (the `unary -`/`unary +` rows share the `-`/`+`
 * characters already listed at level 5).
 */
const OP_CHARS = [...new Set(PRECEDENCE.flatMap((p) => p.ops).filter((op) => op.length === 1))].join('');

/* ------------------------------------------------------------------------ */
/*  Function registry                                                       */
/* ------------------------------------------------------------------------ */

/** What a function implementation is handed when it is called. */
export interface FnContext {
  /** Convert an angle in the active unit to radians. */
  toRadians(v: number): number;
  /** Convert a radian result back to the active angle unit. */
  fromRadians(v: number): number;
  /** The shared factorial helper (integer check + lookup table). */
  factorial(v: number): number;
}

/** One entry in the scientific function registry. */
export interface FnDef {
  /** Keypad label. */
  label: string;
  /** The snippet the keypad inserts into the expression. */
  insert: string;
  /** Show this button on the scientific keypad row. */
  scientific: boolean;
  /** Fewest arguments the function can be called with. */
  minArgs: number;
  /** Evaluate the already-evaluated arguments. */
  call(args: number[], ctx: FnContext): number;
}

const positive = (name: string, v: number): number => {
  if (v <= 0) throw new ToolError(`${name} requires a positive argument.`);
  return v;
};

const inUnitRange = (name: string, v: number): number => {
  if (v < -1 || v > 1) throw new ToolError(`${name} requires an argument between -1 and 1.`);
  return v;
};

/**
 * name -> implementation (plus its keypad metadata). This is the registry the
 * task's scientific functions live in.
 */
export const FUNCTIONS: Record<string, FnDef> = {
  sqrt: {
    label: '√',
    insert: 'sqrt(',
    scientific: true,
    minArgs: 1,
    call: ([v]) => {
      if (v! < 0) throw new ToolError('sqrt requires a non-negative argument.');
      return Math.sqrt(v!);
    },
  },
  cbrt: { label: '∛', insert: 'cbrt(', scientific: true, minArgs: 1, call: ([v]) => Math.cbrt(v!) },
  abs: { label: 'abs', insert: 'abs(', scientific: false, minArgs: 1, call: ([v]) => Math.abs(v!) },
  round: {
    label: 'round',
    insert: 'round(',
    scientific: false,
    minArgs: 1,
    call: ([v]) => Math.round(v!),
  },
  floor: {
    label: 'floor',
    insert: 'floor(',
    scientific: false,
    minArgs: 1,
    call: ([v]) => Math.floor(v!),
  },
  ceil: {
    label: 'ceil',
    insert: 'ceil(',
    scientific: false,
    minArgs: 1,
    call: ([v]) => Math.ceil(v!),
  },
  sign: { label: 'sign', insert: 'sign(', scientific: false, minArgs: 1, call: ([v]) => Math.sign(v!) },
  ln: {
    label: 'ln',
    insert: 'ln(',
    scientific: true,
    minArgs: 1,
    call: ([v]) => Math.log(positive('ln', v!)),
  },
  log: {
    label: 'log',
    insert: 'log(',
    scientific: true,
    minArgs: 1,
    call: ([v]) => Math.log10(positive('log', v!)),
  },
  log10: {
    label: 'log10',
    insert: 'log10(',
    scientific: true,
    minArgs: 1,
    call: ([v]) => Math.log10(positive('log10', v!)),
  },
  log2: {
    label: 'log2',
    insert: 'log2(',
    scientific: true,
    minArgs: 1,
    call: ([v]) => Math.log2(positive('log2', v!)),
  },
  exp: { label: 'exp', insert: 'exp(', scientific: true, minArgs: 1, call: ([v]) => Math.exp(v!) },
  sin: {
    label: 'sin',
    insert: 'sin(',
    scientific: true,
    minArgs: 1,
    call: ([v], ctx) => Math.sin(ctx.toRadians(v!)),
  },
  cos: {
    label: 'cos',
    insert: 'cos(',
    scientific: true,
    minArgs: 1,
    call: ([v], ctx) => Math.cos(ctx.toRadians(v!)),
  },
  tan: {
    label: 'tan',
    insert: 'tan(',
    scientific: true,
    minArgs: 1,
    call: ([v], ctx) => Math.tan(ctx.toRadians(v!)),
  },
  asin: {
    label: 'asin',
    insert: 'asin(',
    scientific: true,
    minArgs: 1,
    call: ([v], ctx) => ctx.fromRadians(Math.asin(inUnitRange('asin', v!))),
  },
  acos: {
    label: 'acos',
    insert: 'acos(',
    scientific: true,
    minArgs: 1,
    call: ([v], ctx) => ctx.fromRadians(Math.acos(inUnitRange('acos', v!))),
  },
  atan: {
    label: 'atan',
    insert: 'atan(',
    scientific: true,
    minArgs: 1,
    call: ([v], ctx) => ctx.fromRadians(Math.atan(v!)),
  },
  atan2: {
    label: 'atan2',
    insert: 'atan2(',
    scientific: false,
    minArgs: 2,
    call: ([y, x], ctx) => ctx.fromRadians(Math.atan2(y!, x!)),
  },
  sinh: {
    label: 'sinh',
    insert: 'sinh(',
    scientific: true,
    minArgs: 1,
    call: ([v]) => Math.sinh(v!),
  },
  cosh: {
    label: 'cosh',
    insert: 'cosh(',
    scientific: true,
    minArgs: 1,
    call: ([v]) => Math.cosh(v!),
  },
  tanh: {
    label: 'tanh',
    insert: 'tanh(',
    scientific: true,
    minArgs: 1,
    call: ([v]) => Math.tanh(v!),
  },
  min: { label: 'min', insert: 'min(', scientific: false, minArgs: 1, call: (args) => Math.min(...args) },
  max: { label: 'max', insert: 'max(', scientific: false, minArgs: 1, call: (args) => Math.max(...args) },
  pow: {
    label: 'pow',
    insert: 'pow(',
    scientific: false,
    minArgs: 2,
    call: ([base, exp]) => Math.pow(base!, exp!),
  },
  hypot: { label: 'hypot', insert: 'hypot(', scientific: false, minArgs: 1, call: (args) => Math.hypot(...args) },
  gcd: {
    label: 'gcd',
    insert: 'gcd(',
    scientific: false,
    minArgs: 1,
    call: (args) => args.reduce((a, b) => gcd(a, b), 0),
  },
  factorial: {
    label: 'factorial',
    insert: 'factorial(',
    scientific: false,
    minArgs: 1,
    call: ([v], ctx) => ctx.factorial(v!),
  },
};

/* ------------------------------------------------------------------------ */
/*  Tokenizer                                                               */
/* ------------------------------------------------------------------------ */

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
      // Names may carry digits so `log10` and `log2` tokenise as one name.
      while (j < n && /[a-zA-Z0-9]/.test(src[j]!)) j++;
      toks.push({ t: 'name', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (OP_CHARS.includes(c)) {
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
    throw new ToolError(`Unexpected character "${c}".`, 'Use + - * / % ^ ! and parentheses.');
  }
  return toks;
}

/* ------------------------------------------------------------------------ */
/*  Recursive-descent parser                                                */
/* ------------------------------------------------------------------------ */

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
    if (this.pos >= this.toks.length)
      throw new ToolError(`Expected ${what}.`, 'The expression is incomplete.');
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

  // Level 5: addition, subtraction.
  private expression(): number {
    let left = this.term();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.advance();
        const right = this.term();
        left = t.v === '+' ? left + right : left - right;
      } else break;
    }
    return left;
  }

  // Level 4: multiplication, division, modulo.
  private term(): number {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) {
        this.advance();
        const right = this.unary();
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

  // Level 3: unary signs (looser than power, tighter than * / %).
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
    return this.power();
  }

  // Level 2: right-associative power. The base is a postfix expression and the
  // exponent a unary one, so `2^3^2` = 2^(3^2) = 512 and the power binds tighter
  // than a leading minus: `-3^2` = -(3^2) = -9.
  private power(): number {
    const base = this.postfix();
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '^') {
      this.advance();
      const exp = this.unary();
      return Math.pow(base, exp);
    }
    return base;
  }

  // Level 1: postfix factorial.
  private postfix(): number {
    const base = this.primary();
    const t = this.peek();
    if (t && t.t === 'op' && t.v === '!') {
      this.advance();
      return this.fact(base);
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
    throw new ToolError(
      `Unexpected "${tokText(tk)}".`,
      'Expected a number, name or an opening parenthesis.',
    );
  }

  private applyFunction(name: string): number {
    // Own-property checks so `constructor`, `toString`, … cannot reach the
    // Object prototype and be "called".
    if (Object.hasOwn(CONSTANTS, name)) return CONSTANTS[name]!;

    const fn = Object.hasOwn(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
    if (!fn || this.peek()?.t !== 'lp') {
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

    if (args.length < fn.minArgs) {
      throw new ToolError(
        fn.minArgs === 1
          ? `${name} requires at least one argument.`
          : `${name} requires at least ${fn.minArgs} arguments.`,
      );
    }
    return fn.call(args, {
      toRadians: (v) => (this.deg ? (v * Math.PI) / 180 : v),
      fromRadians: (v) => (this.deg ? (v * 180) / Math.PI : v),
      factorial: (v) => this.fact(v),
    });
  }

  private fact(v: number): number {
    const n = Math.round(v);
    if (Math.abs(v - n) > 1e-9 || n < 0)
      throw new ToolError('Factorial requires a non-negative integer.');
    if (n > 18) throw new ToolError(`Factorial of ${n} is too large to compute.`);
    return FACT[n]!;
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

/* ------------------------------------------------------------------------ */
/*  Public entry points                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Evaluate an expression. Returns `null` when the input carries no tokens
 * (only separators and whitespace); throws a `ToolError` for anything that is
 * not a valid, in-domain expression.
 */
export function evaluateExpression(src: string, ctx: { degrees: boolean }): number | null {
  const toks = tokenize(src);
  if (toks.length === 0) return null;
  return new Parser(toks, ctx.degrees).parse();
}

/** Format a finite result for display, trimming trailing zeros. */
export function formatNumber(v: number, precision: number): string {
  if (!Number.isFinite(v)) {
    throw new ToolError('The expression does not evaluate to a finite number.');
  }
  if (Number.isInteger(v) && Math.abs(v) < 1e21) return String(v);
  const s = v.toFixed(precision);
  return s.replace(/\.?0+$/, '');
}
