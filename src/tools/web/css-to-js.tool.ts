import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './css-to-js.meta';

const MAX_LEN = 200_000;

function splitDeclarations(body: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (const ch of body) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === ';') { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function findRuleBlocks(text: string): Array<{ selector: string | null; body: string }> {
  const blocks: Array<{ selector: string | null; body: string }> = [];
  let buf = '';
  let quote: string | null = null;
  let open = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '{') {
      if (!open) {
        const selector = buf.trim();
        blocks.push({ selector: selector || null, body: '' });
        open = true;
        buf = '';
      } else {
        buf += ch;
      }
      continue;
    }
    if (ch === '}' && open) {
      const last = blocks[blocks.length - 1]!;
      last.body = buf;
      open = false;
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (open) throw new ToolError('Unbalanced braces in the CSS.', 'One { was not closed with a matching }.');
  // Trailing text after the last rule (e.g. bare declarations) becomes a no-selector block.
  const trailing = buf.trim();
  if (trailing) blocks.push({ selector: null, body: trailing });
  return blocks;
}

function camelProp(name: string): string {
  if (name.startsWith('--')) return name;
  if (!name.includes('-')) return name;
  return name.replace(/-([a-z0-9])/gi, (_, c: string) => c.toUpperCase());
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

function declToEntry(decl: string): [string, string] | null {
  const colon = decl.indexOf(':');
  if (colon === -1) return null; // stray text without a colon is ignored
  const prop = decl.slice(0, colon).trim();
  const value = decl.slice(colon + 1).trim();
  if (!prop) return null;
  return [prop, value];
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const camel = o.camelCase !== false;
  const source = (input.text ?? '').replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments
  if (!source.trim()) throw new ToolError('Paste some CSS to convert to a JS object.');
  if (source.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under 200,000 characters.');

  let blocks: Array<{ selector: string | null; body: string }>;
  try {
    blocks = findRuleBlocks(source);
  } catch {
    throw new ToolError('Unbalanced braces in the CSS.', 'One { was not closed with a matching }.');
  }

  const entriesToJs = (decls: string[]): string =>
    decls
      .map((d) => {
        const e = declToEntry(d);
        if (!e) return null;
        const [prop, value] = e;
        const key = camel ? camelProp(prop) : prop;
        const keyStr = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
        return keyStr + ': ' + jsString(value);
      })
      .filter(Boolean)
      .join(', ');

  let output: string;
  let stats: Record<string, number>;
  if (blocks.some((b) => b.selector !== null)) {
    const lines = blocks
      .map((b) => {
        const body = entriesToJs(splitDeclarations(b.body));
        return JSON.stringify(b.selector) + ': { ' + body + ' }';
      })
      .join(',\n  ');
    output = '{ ' + lines + ' }';
    stats = { rules: blocks.length };
  } else {
    const decls = blocks.flatMap((b) => splitDeclarations(b.body));
    output = '{ ' + entriesToJs(decls) + ' }';
    stats = { properties: decls.length };
  }

  return {
    output: output + (output.endsWith('}') ? '' : ''),
    render: 'code',
    language: 'js',
    stats,
    notes: [
      camel ? 'Property names converted to camelCase (font-size → fontSize).' : 'Property names kept verbatim.',
      'Object is plain JS — paste it into your inline-style or CSS-in-JS component and drop the outer braces where React expects a style object.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
