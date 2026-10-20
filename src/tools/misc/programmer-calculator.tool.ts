import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './programmer-calculator.meta';

type T = { k: 'num'; v: bigint } | { k: 'op'; v: string } | { k: 'lp' } | { k: 'rp' };

function tokenize(src: string): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      if (c === '0' && /[xXbBoO]/.test(src[j] ?? '')) {
        j++;
        while (j < src.length && /[0-9a-fA-F]/.test(src[j]!)) j++;
      } else {
        while (j < src.length && /[0-9]/.test(src[j]!)) j++;
      }
      const raw = src.slice(i, j);
      try {
        out.push({ k: 'num', v: BigInt(raw) });
      } catch {
        throw new ToolError(`Invalid integer literal "${raw}".`);
      }
      i = j;
      continue;
    }
    if ('+-*/%&|^~'.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
      continue;
    }
    if (c === '<' || c === '>') {
      const op = src.slice(i, i + 3);
      const two = src.slice(i, i + 2);
      if (op === '>>>') {
        out.push({ k: 'op', v: op });
        i += 3;
      } else if (two === '<<' || two === '>>') {
        out.push({ k: 'op', v: two });
        i += 2;
      } else throw new ToolError(`Unexpected character "${c}".`);
      continue;
    }
    if (c === '(') {
      out.push({ k: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ k: 'rp' });
      i++;
      continue;
    }
    throw new ToolError(`Unexpected character "${c}".`);
  }
  return out;
}

const PREC: Record<string, number> = {
  '|': 1,
  '^': 2,
  '&': 3,
  '<<': 4,
  '>>': 4,
  '>>>': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

class Parser {
  private pos = 0;
  constructor(private ts: T[]) {}
  parse(): bigint {
    const x = this.expr(0);
    if (this.pos !== this.ts.length) throw new ToolError('Unexpected token after the expression.');
    return x;
  }
  private peek(): T | undefined {
    return this.ts[this.pos];
  }
  private take(): T {
    const t = this.ts[this.pos++];
    if (!t) throw new ToolError('Unexpected end of expression.');
    return t;
  }
  private expr(min: number): bigint {
    const first = this.take();
    let left: bigint;
    if (first.k === 'num') left = first.v;
    else if (first.k === 'lp') {
      left = this.expr(0);
      if (this.peek()?.k !== 'rp') throw new ToolError('Expected a closing parenthesis.');
      this.take();
    } else if (first.k === 'op' && (first.v === '+' || first.v === '-' || first.v === '~')) {
      const v = this.expr(7);
      left = first.v === '+' ? v : first.v === '-' ? -v : ~v;
    } else throw new ToolError('Expected an integer or parenthesised expression.');

    while (this.peek()?.k === 'op') {
      const op = (this.peek() as Extract<T, { k: 'op' }>).v;
      const prec = PREC[op];
      if (prec === undefined || prec < min) break;
      this.take();
      const right = this.expr(prec + 1);
      switch (op) {
        case '+':
          left += right;
          break;
        case '-':
          left -= right;
          break;
        case '*':
          left *= right;
          break;
        case '/':
          if (right === 0n) throw new ToolError('Cannot divide by zero.');
          left /= right;
          break;
        case '%':
          if (right === 0n) throw new ToolError('Cannot take modulo by zero.');
          left %= right;
          break;
        case '&':
          left &= right;
          break;
        case '|':
          left |= right;
          break;
        case '^':
          left ^= right;
          break;
        case '<<':
          if (right < 0n || right > 1024n)
            throw new ToolError('Shift count must be between 0 and 1024.');
          left <<= right;
          break;
        case '>>':
          if (right < 0n || right > 1024n)
            throw new ToolError('Shift count must be between 0 and 1024.');
          left >>= right;
          break;
        case '>>>':
          if (right < 0n || right > 1024n)
            throw new ToolError('Shift count must be between 0 and 1024.');
          left = BigInt.asUintN(64, left) >> right;
          break;
      }
    }
    return left;
  }
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };
  const bits = Math.max(8, Math.min(64, Number(o.bits) || 32));
  const signed = Boolean(o.signed);
  const raw = new Parser(tokenize(text)).parse();
  const unsigned = BigInt.asUintN(bits, raw);
  const interpreted = signed ? BigInt.asIntN(bits, raw) : unsigned;
  const bin = unsigned
    .toString(2)
    .padStart(bits, '0')
    .replace(/(.{4})(?=.)/g, '$1 ');
  const twos = `0x${unsigned
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(bits / 4), '0')}`;
  const ones = unsigned.toString(2).replace(/0/g, '').length;
  const rows = [
    ['DEC', String(interpreted)],
    ['HEX', `0x${unsigned.toString(16).toUpperCase()}`],
    ['OCT', `0o${unsigned.toString(8)}`],
    ['BIN', `0b${bin}`],
    [`Two's complement (${bits}-bit)`, twos],
    ['Set bits', String(ones)],
  ];
  return {
    output: JSON.stringify({ headers: ['Representation', 'Value'], rows }),
    render: 'table',
    stats: { bits, signed: String(signed) },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
