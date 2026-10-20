import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-prettifier.meta';

const MAX_LENGTH = 2_000_000;

/** Tags that never have children and never get an indented body. */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Elements whose content is copied verbatim and never re-indented. */
const RAW_TAGS = new Set(['pre', 'textarea', 'script', 'style', 'xmp']);

/** Elements that introduce a line break between siblings. */
const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'html',
  'li',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

type Token =
  | { kind: 'open'; name: string; raw: string; selfClosing: boolean }
  | { kind: 'close'; name: string; raw: string }
  | { kind: 'text'; raw: string }
  | { kind: 'comment'; raw: string }
  | { kind: 'raw'; raw: string };

type Node =
  | { type: 'element'; name: string; raw: string; selfClosing: boolean; children: Node[] }
  | { type: 'text'; raw: string }
  | { type: 'comment'; raw: string }
  | { type: 'verbatim'; raw: string };

type Ctx = { unit: string; maxWidth: number; prettyComments: boolean };

const isVoid = (name: string): boolean => VOID_TAGS.has(name);
const isRaw = (name: string): boolean => RAW_TAGS.has(name);
const isBlock = (name: string): boolean => BLOCK_TAGS.has(name);

/** Find the '>' that closes a tag, ignoring quotes and comments. */
function findTagEnd(src: string, start: number): number {
  let quote: string | null = null;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    if (src[i] !== '<') {
      let j = i + 1;
      while (j < n && src[j] !== '<') j += 1;
      tokens.push({ kind: 'text', raw: src.slice(i, j) });
      i = j;
      continue;
    }

    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      const stop = end === -1 ? n : end + 3;
      tokens.push({ kind: 'comment', raw: src.slice(i, stop) });
      i = stop;
      continue;
    }
    if (src[i + 1] === '!' || src[i + 1] === '?') {
      const end = findTagEnd(src, i + 2);
      const stop = end === -1 ? n : end + 1;
      tokens.push({ kind: 'comment', raw: src.slice(i, stop) });
      i = stop;
      continue;
    }

    if (src[i + 1] === '/') {
      const end = findTagEnd(src, i + 2);
      const stop = end === -1 ? n : end + 1;
      const name = src
        .slice(i + 2, end === -1 ? n : end)
        .trim()
        .toLowerCase();
      tokens.push({ kind: 'close', name, raw: src.slice(i, stop) });
      i = stop;
      continue;
    }

    const end = findTagEnd(src, i + 1);
    if (end === -1) {
      // Unterminated tag: treat the rest as text so nothing is lost.
      tokens.push({ kind: 'text', raw: src.slice(i) });
      break;
    }
    const raw = src.slice(i, end + 1);
    const name = (/^<\s*([a-zA-Z][a-zA-Z0-9:-]*)/.exec(raw)?.[1] ?? '').toLowerCase();
    const selfClosing = /\/\s*>$/.test(raw) || isVoid(name);
    const stop = end + 1;
    i = stop;

    if (isRaw(name) && !selfClosing) {
      const closeRe = new RegExp('</' + name + '\\s*>', 'i');
      const rest = src.slice(i);
      const match = closeRe.exec(rest);
      if (match) {
        const whole = raw + rest.slice(0, match.index + match[0].length);
        tokens.push({ kind: 'raw', raw: whole });
        i += match.index + match[0].length;
        continue;
      }
      tokens.push({ kind: 'raw', raw });
      continue;
    }

    tokens.push({ kind: 'open', name, raw, selfClosing });
  }

  return tokens;
}

function buildTree(tokens: Token[]): Node[] {
  const root: Node[] = [];
  const stack: Node[][] = [root];
  const open: Array<Node & { type: 'element' }> = [];

  for (const token of tokens) {
    const current = stack[stack.length - 1]!;
    if (token.kind === 'text') {
      current.push({ type: 'text', raw: token.raw });
      continue;
    }
    if (token.kind === 'comment') {
      current.push({ type: 'comment', raw: token.raw });
      continue;
    }
    if (token.kind === 'raw') {
      current.push({ type: 'verbatim', raw: token.raw });
      continue;
    }
    if (token.kind === 'open') {
      const node: Node = {
        type: 'element',
        name: token.name,
        raw: token.raw,
        selfClosing: token.selfClosing,
        children: [],
      };
      current.push(node);
      if (!token.selfClosing) {
        stack.push(node.children);
        open.push(node);
      }
      continue;
    }
    // Closing tag: unwind to the nearest matching open element, if any.
    let match = -1;
    for (let s = open.length - 1; s >= 0; s -= 1) {
      if (open[s]!.name === token.name) {
        match = s;
        break;
      }
    }
    if (match >= 0) {
      stack.length = match + 1;
      open.length = match;
    }
  }

  return root;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/** Split a raw opening tag into name + attribute list (quote aware). */
function parseTag(raw: string): { name: string; attrs: string[]; selfClosing: boolean } {
  const selfClosing = /\/\s*>$/.test(raw);
  const bodyEnd = raw.lastIndexOf('>');
  const inner = raw.slice(1, bodyEnd === -1 ? raw.length : bodyEnd).trim();
  const nameMatch = /^([a-zA-Z][a-zA-Z0-9:-]*)/.exec(inner);
  const name = nameMatch ? nameMatch[1]! : '';
  const rest = inner.slice(name.length).trim();
  const attrs = rest.match(/[^\s=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g) ?? [];
  return { name, attrs, selfClosing };
}

function renderInline(node: Node): string {
  switch (node.type) {
    case 'text':
      return collapse(node.raw);
    case 'comment':
    case 'verbatim':
      return node.raw;
    case 'element': {
      const inner = node.children.map(renderInline).join('');
      if (node.selfClosing || !node.children.length) return node.raw;
      return node.raw + inner + '</' + node.name + '>';
    }
  }
}

function openTagLines(node: { raw: string }, depth: number, ctx: Ctx): string[] {
  const pad = ctx.unit.repeat(depth);
  const line = pad + node.raw;
  if (line.length <= ctx.maxWidth) return [line];
  const parsed = parseTag(node.raw);
  if (parsed.attrs.length < 2) return [line];
  const close = parsed.selfClosing ? '/>' : '>';
  const attrLines = parsed.attrs.map((attr, index) =>
    index === parsed.attrs.length - 1 ? pad + ctx.unit + attr + close : pad + ctx.unit + attr,
  );
  return [pad + '<' + parsed.name, ...attrLines];
}

function renderElementLines(node: Node & { type: 'element' }, depth: number, ctx: Ctx): string[] {
  const pad = ctx.unit.repeat(depth);
  const openLines = openTagLines(node, depth, ctx);
  if (node.selfClosing) return openLines;

  const blockChildren = node.children.some(
    (child) =>
      (child.type === 'element' && isBlock(child.name)) ||
      (ctx.prettyComments && child.type === 'comment'),
  );
  const multiLineOpen = openLines.length > 1;
  const childLines =
    multiLineOpen || blockChildren ? renderChildLines(node.children, depth + 1, ctx) : [];
  const closeLine = pad + '</' + node.name + '>';

  if (!blockChildren && !multiLineOpen) {
    const inline = node.children.map(renderInline).join('').replace(/\s+/g, ' ').trim();
    const single = pad + node.raw + inline + '</' + node.name + '>';
    if (single.length <= ctx.maxWidth || !node.children.length) return [single];
    const lines = renderChildLines(node.children, depth + 1, ctx);
    if (!lines.length) return [pad + node.raw + '</' + node.name + '>'];
    return [pad + node.raw, ...lines, closeLine];
  }

  if (!childLines.length) return [pad + node.raw + '</' + node.name + '>'];

  return [...openLines, ...childLines, closeLine];
}

/** Render an element's children as indented lines, keeping inline runs together. */
function renderChildLines(children: Node[], depth: number, ctx: Ctx): string[] {
  const pad = ctx.unit.repeat(depth);
  const lines: string[] = [];
  let run = '';

  const flush = (): void => {
    const text = run.replace(/^\s+/, '').replace(/\s+$/, '');
    if (text) lines.push(pad + text);
    run = '';
  };

  for (const child of children) {
    if (child.type === 'comment' && ctx.prettyComments) {
      flush();
      lines.push(pad + child.raw);
      continue;
    }
    if (child.type === 'verbatim') {
      flush();
      lines.push(...child.raw.split('\n').map((line) => pad + line));
      continue;
    }
    if (child.type === 'element' && isBlock(child.name)) {
      flush();
      lines.push(...renderElementLines(child, depth, ctx));
      continue;
    }
    const piece = child.type === 'text' ? collapse(child.raw) : renderInline(child);
    run += piece;
  }

  flush();
  return lines;
}

function renderNodes(nodes: Node[], ctx: Ctx): string[] {
  return renderChildLines(nodes, 0, ctx);
}

function prettify(
  input: string,
  indentSize: number,
  useTabs: boolean,
  inlineMax: number,
  prettyComments: boolean,
): string {
  const tokens = tokenize(input);
  const tree = buildTree(tokens);
  const ctx: Ctx = {
    unit: useTabs ? '\t' : ' '.repeat(indentSize),
    maxWidth: inlineMax,
    prettyComments,
  };
  return renderNodes(tree, ctx).join('\n');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const indentSize = Number(o.indent ?? 2);
  const inlineMax = Number(o.inlineMax ?? 80);
  const prettyComments = o.prettyComments === true;
  const useTabs = o.tabs === true;

  if (!Number.isInteger(indentSize) || indentSize < 0 || indentSize > 8) {
    throw new ToolError('Indent must be a whole number from 0 to 8.');
  }
  if (!Number.isInteger(inlineMax) || inlineMax < 40 || inlineMax > 200) {
    throw new ToolError('Max width must be a whole number from 40 to 200.');
  }

  const html = input.text ?? '';
  if (!html.trim()) {
    throw new ToolError('Paste some HTML to prettify.', 'Example: <div><p>Hello</p></div>');
  }
  if (html.length > MAX_LENGTH) {
    throw new ToolError(
      'HTML is too large.',
      `Keep it under ${MAX_LENGTH.toLocaleString('en-US')} characters.`,
    );
  }

  const result = prettify(html, indentSize, useTabs, inlineMax, prettyComments);
  const originalBytes = new TextEncoder().encode(html).length;
  const prettyBytes = new TextEncoder().encode(result).length;

  return {
    output: result,
    render: 'code',
    language: 'html',
    stats: {
      originalBytes,
      prettyBytes,
      tags: (result.match(/<[a-zA-Z]/g) ?? []).length,
    },
    notes: [
      `Formatted ${originalBytes} → ${prettyBytes} bytes at indent ${useTabs ? 'tabs' : indentSize}.`,
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
