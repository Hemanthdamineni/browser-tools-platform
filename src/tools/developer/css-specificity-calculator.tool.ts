import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './css-specificity-calculator.meta';

const MAX_LEN = 20_000;

/** Pseudo-classes that take the specificity of their argument list. */
const ARG_PSEUDOS = new Set(['not', 'is', 'has', 'matches', '-webkit-any', 'any']);
/** Pseudo-classes that contribute nothing at all. */
const ZERO_PSEUDOS = new Set(['where']);
/** Functional pseudo-elements / legacy single-colon pseudo-elements. */
const PSEUDO_ELEMENTS = new Set([
  'before',
  'after',
  'first-line',
  'first-letter',
  'selection',
  'placeholder',
  'marker',
  'backdrop',
  'file-selector-button',
  'cue',
  'part',
  'slotted',
  'highlight',
]);

interface Specificity {
  a: number;
  b: number;
  c: number;
}

function zero(): Specificity {
  return { a: 0, b: 0, c: 0 };
}

function add(target: Specificity, other: Specificity): void {
  target.a += other.a;
  target.b += other.b;
  target.c += other.c;
}

function compare(x: Specificity, y: Specificity): number {
  if (x.a !== y.a) return x.a - y.a;
  if (x.b !== y.b) return x.b - y.b;
  return x.c - y.c;
}

function maxOf(list: Specificity[]): Specificity {
  let best = zero();
  for (const item of list) if (compare(item, best) > 0) best = item;
  return best;
}

/** Find the index of the closing paren matching the open paren at `start`. */
function matchParen(text: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split a selector list on top-level commas (ignoring commas inside parens/brackets). */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote !== null) {
      current += ch;
      if (ch === '\\' && i + 1 < text.length) {
        current += text[i + 1]!;
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

/** Specificity of a single complex selector (no top-level commas). */
function specificityOf(selector: string): Specificity {
  const spec = zero();
  let i = 0;
  while (i < selector.length) {
    const ch = selector[i]!;

    // Skip whitespace and combinators.
    if (/[\s>+~]/.test(ch)) {
      i += 1;
      continue;
    }

    // Attribute selector.
    if (ch === '[') {
      let j = i + 1;
      let quote: string | null = null;
      while (j < selector.length) {
        const c = selector[j]!;
        if (quote !== null) {
          if (c === '\\') j += 1;
          else if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === ']') break;
        j += 1;
      }
      spec.b += 1;
      i = j + 1;
      continue;
    }

    // Universal selector — contributes nothing.
    if (ch === '*') {
      i += 1;
      continue;
    }

    // ID selector.
    if (ch === '#') {
      i += 1;
      while (i < selector.length && /[\w\-\u00a0-\uffff\\]/.test(selector[i]!)) {
        if (selector[i] === '\\') i += 1;
        i += 1;
      }
      spec.a += 1;
      continue;
    }

    // Class selector.
    if (ch === '.') {
      i += 1;
      while (i < selector.length && /[\w\-\u00a0-\uffff\\]/.test(selector[i]!)) {
        if (selector[i] === '\\') i += 1;
        i += 1;
      }
      spec.b += 1;
      continue;
    }

    // Pseudo-class or pseudo-element.
    if (ch === ':') {
      const isElement = selector[i + 1] === ':';
      i += isElement ? 2 : 1;
      let name = '';
      while (i < selector.length && /[\w-]/.test(selector[i]!)) {
        name += selector[i];
        i += 1;
      }
      name = name.toLowerCase();

      let args = '';
      if (selector[i] === '(') {
        const close = matchParen(selector, i);
        if (close === -1) throw new ToolError('Unbalanced parentheses in selector.', selector);
        args = selector.slice(i + 1, close);
        i = close + 1;
      }

      if (isElement || PSEUDO_ELEMENTS.has(name)) {
        spec.c += 1;
        continue;
      }
      if (ZERO_PSEUDOS.has(name)) continue;
      if (ARG_PSEUDOS.has(name) && args !== '') {
        const inner = splitTopLevel(args).map((part) => specificityOf(part));
        add(spec, maxOf(inner));
        continue;
      }
      if (name === 'nth-child' || name === 'nth-last-child') {
        spec.b += 1;
        const ofMatch = /(?:^|[\s)])of\s+([\s\S]+)$/i.exec(args);
        if (ofMatch) {
          const inner = splitTopLevel(ofMatch[1]!).map((part) => specificityOf(part));
          add(spec, maxOf(inner));
        }
        continue;
      }
      // Ordinary pseudo-class (:hover, :focus, :first-child, …).
      spec.b += 1;
      continue;
    }

    // Type selector (element name) — possibly namespaced or escaped.
    if (/[A-Za-z_\u00a0-\uffff\\-]/.test(ch)) {
      let name = '';
      while (i < selector.length && /[\w\-\u00a0-\uffff\\]/.test(selector[i]!)) {
        if (selector[i] === '\\' && i + 1 < selector.length) {
          name += selector[i]! + selector[i + 1]!;
          i += 2;
          continue;
        }
        name += selector[i];
        i += 1;
      }
      // Namespace prefix like svg|rect — count only the element name once.
      if (selector[i] === '|' && selector[i + 1] !== '|') {
        i += 1;
        while (i < selector.length && /[\w\-\u00a0-\uffff]/.test(selector[i]!)) i += 1;
      }
      void name;
      spec.c += 1;
      continue;
    }

    // Anything else (e.g. stray characters) — advance to avoid an infinite loop.
    i += 1;
  }
  return spec;
}

function format(spec: Specificity): string {
  return spec.a + ',' + spec.b + ',' + spec.c;
}

function explain(selector: string, spec: Specificity): string {
  const ids: string[] = [];
  const classes: string[] = [];
  const types: string[] = [];
  // A light second pass purely for human-readable notes.
  const tokens =
    selector.match(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|::?[\w-]+(?:\([^)]*\))?|[A-Za-z][\w-]*/g) ?? [];
  for (const token of tokens) {
    if (token.startsWith('#')) ids.push(token);
    else if (token.startsWith('.') || token.startsWith('[')) classes.push(token);
    else if (token.startsWith(':')) {
      const bare = token.replace(/^:+/, '').replace(/\(.*$/, '').toLowerCase();
      if (PSEUDO_ELEMENTS.has(bare) || token.startsWith('::')) types.push(token);
      else if (!ZERO_PSEUDOS.has(bare)) classes.push(token);
    } else types.push(token);
  }
  const parts: string[] = [];
  parts.push('(' + format(spec) + ')');
  if (ids.length) parts.push('IDs: ' + ids.join(' '));
  if (classes.length) parts.push('classes/attrs/pseudo-classes: ' + classes.join(' '));
  if (types.length) parts.push('types/pseudo-elements: ' + types.join(' '));
  return parts.join(' | ');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const showExplanation = o.showExplanation !== false;

  const raw = String(input.text ?? '').trim();
  if (!raw) throw new ToolError('Paste one or more CSS selectors to score.');
  if (raw.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');

  const selectors = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('//'));
  if (selectors.length === 0) throw new ToolError('No selectors found.');

  const scored = selectors.map((selector) => {
    const list = splitTopLevel(selector);
    if (list.length === 0) throw new ToolError('Empty selector: "' + selector + '".');
    const parts = list.map((s) => specificityOf(s));
    return { selector, spec: maxOf(parts), count: parts.length };
  });

  const ranked = [...scored].sort((x, y) => compare(y.spec, x.spec));
  const rows: string[][] = ranked.map((item, index) => [
    String(index + 1),
    item.selector,
    format(item.spec),
    String(item.spec.a * 100 + item.spec.b * 10 + item.spec.c),
    showExplanation ? explain(item.selector, item.spec) : '—',
  ]);

  const notes: string[] = [];
  if (ranked.length > 1) {
    const top = ranked[0]!;
    const runnerUp = ranked[1]!;
    const cmp = compare(top.spec, runnerUp.spec);
    if (cmp > 0) {
      notes.push('Highest specificity: ' + top.selector + ' (' + format(top.spec) + ').');
      notes.push(
        'It beats "' +
          runnerUp.selector +
          '" (' +
          format(runnerUp.spec) +
          ') when both match the same element.',
      );
    } else {
      const tied = ranked.filter((r) => compare(r.spec, top.spec) === 0);
      notes.push(
        tied.length + ' selectors tie at the highest specificity (' + format(top.spec) + ').',
      );
      notes.push(
        'For a tie, the later rule in source order wins — order matters, specificity does not.',
      );
    }
  } else {
    notes.push(
      'Specificity ' +
        format(scored[0]!.spec) +
        ' — compare with other rules targeting the same element.',
    );
  }
  notes.push(
    'Inline styles beat any selector; !important beats normal declarations regardless of specificity.',
  );

  return {
    output: JSON.stringify({
      headers: ['#', 'Selector', '(a,b,c)', 'Score', showExplanation ? 'Breakdown' : ''],
      rows,
    }),
    render: 'table',
    stats: { selectors: selectors.length },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
