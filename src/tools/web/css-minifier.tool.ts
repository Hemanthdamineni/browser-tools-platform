import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './css-minifier.meta';

const MAX_LENGTH = 2_000_000;

/** Functions whose arguments are math expressions, so spaces around + must survive. */
const MATH_FUNCS = new Set([
  'calc',
  'min',
  'max',
  'clamp',
  'minmax',
  'abs',
  'sign',
  'round',
  'mod',
  'rem',
  'pow',
  'sqrt',
  'hypot',
  'log',
  'exp',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
]);

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Decide whether a collapsed run of whitespace must stay between two characters.
 * Everything here is conservative: whitespace is only dropped where CSS never needs it.
 */
function keepSpace(prev: string, next: string, inMath: boolean): boolean {
  if (!prev || !next) return false;
  if (
    next === '{' ||
    next === '}' ||
    next === ';' ||
    next === ',' ||
    next === ')' ||
    next === '!'
  ) {
    return false;
  }
  if (
    prev === '{' ||
    prev === '}' ||
    prev === ';' ||
    prev === ',' ||
    prev === '(' ||
    prev === '!'
  ) {
    return false;
  }
  // Space after a colon is never needed; space before one can be a descendant combinator.
  if (prev === ':') return false;
  if (next === ':') return true;
  // Minus may introduce a negative value, so keep the separating space.
  if (next === '-' || prev === '-') return true;
  if (next === '+') return inMath;
  if (prev === '+') return inMath;
  if (next === '>' || prev === '>' || next === '~' || prev === '~') return false;
  return true;
}

type MinifyResult = { css: string; removedComments: number };

function minifyCss(input: string, keepImportantComments: boolean): MinifyResult {
  let out = '';
  let pendingSpace = false;
  let dropNextSpace = false;
  let removedComments = 0;
  let i = 0;
  const n = input.length;
  const mathStack: boolean[] = [];

  const lastChar = (): string => (out.length > 0 ? out[out.length - 1]! : '');
  const inMath = (): boolean => mathStack.length > 0 && mathStack[mathStack.length - 1] === true;
  const flushSpace = (next: string): void => {
    if (!pendingSpace) return;
    pendingSpace = false;
    if (dropNextSpace) {
      dropNextSpace = false;
      return;
    }
    if (keepSpace(lastChar(), next, inMath())) out += ' ';
  };
  const isIdentChar = (ch: string): boolean => /[\w-]/.test(ch);

  while (i < n) {
    const ch = input[i]!;

    // Whitespace: collapse runs and defer the decision.
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      pendingSpace = true;
      i += 1;
      continue;
    }

    // Comments.
    if (ch === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      const isImportant = input[i + 2] === '!';
      if (isImportant && keepImportantComments) {
        if (pendingSpace && out.length > 0) out += ' ';
        pendingSpace = false;
        const prevSignificant = out.replace(/\s+$/, '').slice(-1);
        // Peek past the comment (and any later comments) to find the next real character.
        let k = stop;
        while (k < n && /\s/.test(input[k]!)) k += 1;
        while (input[k] === '/' && input[k + 1] === '*') {
          const nestedEnd = input.indexOf('*/', k + 2);
          if (nestedEnd === -1) {
            k = n;
            break;
          }
          k = nestedEnd + 2;
          while (k < n && /\s/.test(input[k]!)) k += 1;
        }
        const nextSignificant = k < n ? input[k]! : '';
        const bothIdent = /[\w-]/.test(prevSignificant) && /[\w-]/.test(nextSignificant);
        dropNextSpace = !bothIdent;
        out += input.slice(i, stop);
      } else {
        removedComments += 1;
        pendingSpace = true;
      }
      i = stop;
      continue;
    }

    // Strings: copy verbatim.
    if (ch === '"' || ch === "'") {
      flushSpace(ch);
      let j = i + 1;
      while (j < n) {
        const c = input[j]!;
        if (c === '\\') {
          j += 2;
          continue;
        }
        if (c === ch || c === '\n') {
          j += 1;
          break;
        }
        j += 1;
      }
      out += input.slice(i, Math.min(j, n));
      i = Math.min(j, n);
      continue;
    }

    // url( ... ): keep the contents byte for byte, minus the padding.
    if (
      (ch === 'u' || ch === 'U') &&
      (i === 0 || !isIdentChar(input[i - 1]!)) &&
      /^url\(/i.test(input.slice(i, i + 4))
    ) {
      let j = i + 4;
      let quote: string | null = null;
      while (j < n) {
        const c = input[j]!;
        if (quote) {
          if (c === '\\') {
            j += 2;
            continue;
          }
          if (c === quote) quote = null;
          j += 1;
          continue;
        }
        if (c === '"' || c === "'") {
          quote = c;
          j += 1;
          continue;
        }
        if (c === ')') break;
        j += 1;
      }
      const inner = input.slice(i + 4, Math.min(j, n)).trim();
      const call = 'url(' + inner + ')';
      flushSpace('u');
      out += call;
      i = Math.min(j + 1, n);
      continue;
    }

    if (ch === '(') {
      const match = /([a-zA-Z-]+)$/.exec(out);
      mathStack.push(match ? MATH_FUNCS.has(match[1]!.toLowerCase()) : false);
    } else if (ch === ')') {
      mathStack.pop();
    }

    flushSpace(ch);
    if (ch === '}' && out.endsWith(';')) out = out.slice(0, -1);
    out += ch;
    i += 1;
  }

  return { css: out, removedComments };
}

/**
 * Delete rule blocks whose body is empty, repeatedly so nested shells collapse too.
 * Skips string contents, parentheses and custom-property values that legitimately contain braces.
 */
function stripEmptyRules(css: string): { css: string; removed: number } {
  let current = css;
  let removedTotal = 0;

  for (let pass = 0; pass < 100; pass += 1) {
    let out = '';
    let removed = 0;
    let inString: string | null = null;
    let parenDepth = 0;
    let i = 0;

    while (i < current.length) {
      const ch = current[i]!;

      if (inString) {
        out += ch;
        if (ch === '\\') {
          out += current[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (ch === inString) inString = null;
        i += 1;
        continue;
      }

      if (ch === '"' || ch === "'") {
        inString = ch;
        out += ch;
        i += 1;
        continue;
      }

      if (ch === '(') parenDepth += 1;
      if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);

      if (ch === '{' && parenDepth === 0 && current[i + 1] === '}') {
        const boundary = Math.max(out.lastIndexOf('}'), out.lastIndexOf('{'), out.lastIndexOf(';'));
        const selector = out.slice(boundary + 1);
        const isCustomPropValue = /--[\w-]+\s*:\s*$/.test(selector);
        if (!isCustomPropValue) {
          out = out.slice(0, boundary + 1);
          removed += 1;
          i += 2;
          continue;
        }
      }

      out += ch;
      i += 1;
    }

    removedTotal += removed;
    if (removed === 0) break;
    current = out;
  }

  return { css: current, removed: removedTotal };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const keepImportantComments = o.keepImportantComments === true;
  const removeEmptyRules = o.removeEmptyRules === true;
  const css = input.text ?? '';

  if (!css.trim()) {
    throw new ToolError(
      'Paste some CSS to minify.',
      'Example: .btn { color: red; padding: 8px 12px; }',
    );
  }
  if (css.length > MAX_LENGTH) {
    throw new ToolError(
      'CSS is too large.',
      `Keep it under ${MAX_LENGTH.toLocaleString('en-US')} characters.`,
    );
  }

  const minified = minifyCss(css, keepImportantComments);
  let result = minified.css;
  let removedRules = 0;
  if (removeEmptyRules) {
    const stripped = stripEmptyRules(result);
    result = stripped.css;
    removedRules = stripped.removed;
  }

  const originalBytes = byteLength(css);
  const minifiedBytes = byteLength(result);
  const savedBytes = Math.max(0, originalBytes - minifiedBytes);
  const savedPercent =
    originalBytes === 0 ? 0 : Math.round((savedBytes / originalBytes) * 1000) / 10;

  return {
    output: result,
    render: 'code',
    stats: {
      originalBytes,
      minifiedBytes,
      savedBytes,
      savedPercent,
      removedComments: minified.removedComments,
      removedRules,
    },
    notes: [
      `${originalBytes} → ${minifiedBytes} bytes (${savedPercent}% smaller, ${minified.removedComments} comment(s) and ${removedRules} empty rule(s) removed).`,
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
