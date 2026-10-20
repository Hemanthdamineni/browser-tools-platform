import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './js-to-css.meta';

const MAX_LEN = 200_000;

const UNITLESS = new Set([
  'animationIterationCount', 'aspectRatio', 'borderImageSlice', 'columnCount', 'flex', 'flexGrow',
  'flexShrink', 'fontWeight', 'gridArea', 'gridColumn', 'gridColumnEnd', 'gridColumnStart', 'gridRow',
  'gridRowEnd', 'gridRowStart', 'lineHeight', 'opacity', 'order', 'orphans', 'tabSize', 'widows',
  'zIndex', 'zoom',
]);

/** Split on a separator at depth 0, respecting quotes and (), [], {}. */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let quote: string | null = null;
  let esc = false;
  for (const ch of text) {
    if (quote) {
      cur += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; cur += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth -= 1; cur += ch; continue; }
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** First index of `:` at depth 0 outside quotes. */
function indexOfTopColon(text: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ':' && depth === 0) return i;
  }
  return -1;
}

function unquoteKey(raw: string): string {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    const inner = t.slice(1, -1);
    return inner.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return t;
}

function dashKey(key: string): string {
  if (key.includes('-')) return key; // already kebab-case (or a custom property)
  return key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

function unquoteValue(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return t;
}

function cssValue(key: string, raw: string, pxForNumbers: boolean): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^(true|false|null|undefined)$/.test(value)) return null;
  if (value.startsWith('{') || value.startsWith('[')) return null; // nested handled as rules
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    if (!pxForNumbers) return value;
    return UNITLESS.has(key) || Number(value) === 0 ? value : value + 'px';
  }
  const unquoted = unquoteValue(value);
  return key === 'content' || key.startsWith('content-') ? JSON.stringify(unquoted) : unquoted;
}

function entriesOf(text: string): Array<[string, string]> {
  const t = text.trim().replace(/;$/, '');
  if (!t.startsWith('{')) throw new ToolError('Expected a JS object.', 'Example: { color: "red", fontSize: 12 }');
  if (!t.endsWith('}')) throw new ToolError('Unbalanced object literal.', 'Add the missing closing brace.');
  const inner = t.slice(1, -1).trim();
  if (!inner) return [];
  const out: Array<[string, string]> = [];
  for (const part of splitTop(inner, ',')) {
    if (!part.trim()) continue;
    const ci = indexOfTopColon(part);
    if (ci === -1) throw new ToolError('Could not parse an entry in the object.', 'Entries look like key: value, …');
    out.push([unquoteKey(part.slice(0, ci)), part.slice(ci + 1).trim()]);
  }
  return out;
}

function renderDecls(entries: Array<[string, string]>, pxForNumbers: boolean, node: string[]): string[] {
  const lines: string[] = [];
  for (const [key, raw] of entries) {
    const value = cssValue(key, raw, pxForNumbers);
    if (value === null) {
      node.push(key);
      continue;
    }
    lines.push('  ' + dashKey(key) + ': ' + value + ';');
  }
  return lines;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const pxForNumbers = o.pxForNumbers !== false;
  const source = (input.text ?? '').trim();
  if (!source) throw new ToolError('Paste a JS style object to convert to CSS.');
  if (source.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under 200,000 characters.');

  const entries = entriesOf(source);
  const skipped: string[] = [];
  const rules: string[] = [];
  const rootLines: string[] = [];

  for (const [key, raw] of entries) {
    const v = raw.trim();
    if (v.startsWith('{')) {
      const nested = entriesOf(v);
      const body = renderDecls(nested, pxForNumbers, skipped);
      rules.push(key + ' {\n' + body.join('\n') + '\n}');
    } else {
      const value = cssValue(key, v, pxForNumbers);
      if (value === null) { skipped.push(key); continue; }
      rootLines.push('  ' + dashKey(key) + ': ' + value + ';');
    }
  }

  const parts: string[] = [];
  if (rootLines.length) parts.push(rootLines.join('\n'));
  parts.push(...rules);
  if (!parts.length) throw new ToolError('Nothing to convert.', 'All entries were nested values, booleans or null.');

  const notes: string[] = ['camelCase keys converted to kebab-case.'];
  if (pxForNumbers) notes.push('Bare length numbers became px; unitless properties were left alone.');
  if (skipped.length) notes.push('Dropped (boolean, null or empty): ' + skipped.join(', '));

  return {
    output: parts.join('\n') + '\n',
    render: 'code',
    language: 'css',
    stats: { declarations: (parts.join('\n').match(/:/g) ?? []).length },
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
