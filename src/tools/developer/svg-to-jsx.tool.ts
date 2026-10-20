import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './svg-to-jsx.meta';

const MAX_LENGTH = 1_000_000;

/** Attribute names where camelCasing alone is not enough. */
const RENAMES: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  'xlink:href': 'xlinkHref',
  'xlink:title': 'xlinkTitle',
  'xlink:role': 'xlinkRole',
  'xlink:show': 'xlinkShow',
  'xlink:type': 'xlinkType',
  'xlink:actuate': 'xlinkActuate',
  'xlink:arcrole': 'xlinkArcrole',
  'xml:lang': 'xmlLang',
  'xml:space': 'xmlSpace',
  'xmlns:xlink': 'xmlnsXlink',
  'http-equiv': 'httpEquiv',
  'accept-charset': 'acceptCharset',
  'tabindex': 'tabIndex',
  'readonly': 'readOnly',
  'maxlength': 'maxLength',
  'colspan': 'colSpan',
  'rowspan': 'rowSpan',
  'contenteditable': 'contentEditable',
};

/** Content of these elements is emitted as a template-literal child in JSX. */
const RAW_TEXT_TAGS = new Set(['style', 'script']);

type Attr = { name: string; value: string | null };

type El = { type: 'element'; name: string; attrs: Attr[]; children: Node[] };
type Text = { type: 'text'; raw: string };
type Comment = { type: 'comment'; raw: string };
type Raw = { type: 'rawText'; name: string; attrs: Attr[]; content: string };
type Node = El | Text | Comment | Raw;

type Ctx = {
  unit: string;
  styleObjects: boolean;
  stats: { elements: number; attributes: number; styles: number };
  spread: boolean;
  spreadUsed: boolean;
};

function camelCase(name: string): string {
  return name.replace(/[-:]([a-z0-9])/g, (_all, char: string) => char.toUpperCase());
}

function convertAttrName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return name;
  if (RENAMES[lower]) return RENAMES[lower]!;
  if (!name.includes('-') && !name.includes(':')) return name;
  return camelCase(lower);
}

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

function parseAttrs(inner: string): Attr[] {
  const attrs: Attr[] = [];
  const re = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(inner)) !== null) {
    const name = match[1]!;
    const value = match[2] ?? match[3] ?? match[4] ?? null;
    attrs.push({ name, value });
  }
  return attrs;
}

function tokenize(src: string): Node[] {
  const root: Node[] = [];
  const stack: Node[][] = [root];
  const openNames: string[] = [];
  let i = 0;
  const n = src.length;

  const push = (node: Node): void => {
    stack[stack.length - 1]!.push(node);
  };

  while (i < n) {
    if (src[i] !== '<') {
      let j = i + 1;
      while (j < n && src[j] !== '<') j += 1;
      push({ type: 'text', raw: src.slice(i, j) });
      i = j;
      continue;
    }

    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      const stop = end === -1 ? n : end + 3;
      push({ type: 'comment', raw: src.slice(i + 4, end === -1 ? n : end) });
      i = stop;
      continue;
    }
    if (src[i + 1] === '!' || src[i + 1] === '?') {
      const end = findTagEnd(src, i + 2);
      i = end === -1 ? n : end + 1;
      continue;
    }

    if (src[i + 1] === '/') {
      const end = findTagEnd(src, i + 2);
      const name = src.slice(i + 2, end === -1 ? n : end).trim().toLowerCase();
      i = end === -1 ? n : end + 1;
      for (let s = openNames.length - 1; s >= 0; s -= 1) {
        if (openNames[s] === name) {
          stack.length = s + 1;
          openNames.length = s;
          break;
        }
      }
      continue;
    }

    const end = findTagEnd(src, i + 1);
    if (end === -1) {
      push({ type: 'text', raw: src.slice(i) });
      break;
    }
    const raw = src.slice(i, end + 1);
    const name = (/^<\s*([a-zA-Z][a-zA-Z0-9:-]*)/.exec(raw)?.[1] ?? '').toLowerCase();
    const selfClosing = /\/\s*>$/.test(raw);
    const inner = raw.slice(1 + (name.length || 0), raw.lastIndexOf('>'));
    const attrs = parseAttrs(inner);
    i = end + 1;

    if (RAW_TEXT_TAGS.has(name) && !selfClosing) {
      const closeRe = new RegExp('</' + name + '\\s*>', 'i');
      const match = closeRe.exec(src.slice(i));
      if (match) {
        push({ type: 'rawText', name, attrs, content: src.slice(i, i + match.index) });
        i += match.index + match[0].length;
        continue;
      }
      push({ type: 'rawText', name, attrs, content: '' });
      continue;
    }

    const el: El = { type: 'element', name, attrs, children: [] };
    push(el);
    if (!selfClosing) {
      stack.push(el.children);
      openNames.push(name);
    }
  }

  return root;
}

function styleExpression(value: string, ctx: Ctx): string {
  const decls = value.split(';').map((part) => part.trim()).filter(Boolean);
  ctx.stats.styles += 1;
  if (!decls.length) return '{{}}';
  const entries = decls.map((decl) => {
    const index = decl.indexOf(':');
    if (index === -1) return null;
    const prop = decl.slice(0, index).trim();
    const val = decl.slice(index + 1).trim();
    const key = prop.startsWith('--') ? `'${prop}'` : camelCase(prop);
    return `${key}: '${val.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  });
  const kept = entries.filter((entry): entry is string => entry !== null);
  return '{' + '{' + kept.join(', ') + '}' + '}';
}

function renderAttrs(attrs: Attr[], ctx: Ctx): string {
  const parts: string[] = [];
  for (const attr of attrs) {
    ctx.stats.attributes += 1;
    const name = convertAttrName(attr.name);
    if (attr.value === null) {
      parts.push(name);
      continue;
    }
    if (name === 'style' && ctx.styleObjects) {
      parts.push('style=' + styleExpression(attr.value, ctx));
      continue;
    }
    const escaped = attr.value.replace(/"/g, '&quot;');
    parts.push(`${name}="${escaped}"`);
  }
  if (ctx.spread && !ctx.spreadUsed) {
    ctx.spreadUsed = true;
    parts.push('{...props}');
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

/** Text nodes must not contain bare braces in JSX. Single pass so inserted braces are not re-escaped. */
function jsxText(raw: string): string {
  return raw.replace(/[{}]/g, (char) => (char === '{' ? "{'{'}" : "{'}'}"));
}

function childLines(nodes: Node[], depth: number, ctx: Ctx): string[] {
  const pad = ctx.unit.repeat(depth);
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      const text = node.raw.replace(/\s+/g, ' ').trim();
      if (text) lines.push(pad + jsxText(text));
      continue;
    }
    if (node.type === 'comment') {
      lines.push(`${pad}{/* ${node.raw.trim()} */}`);
      continue;
    }
    lines.push(...renderNode(node, depth, ctx));
  }
  return lines;
}

function renderNode(node: Node, depth: number, ctx: Ctx): string[] {
  const pad = ctx.unit.repeat(depth);

  if (node.type === 'rawText') {
    ctx.stats.elements += 1;
    const attrs = renderAttrs(node.attrs, ctx);
    if (!node.content.trim()) return [`${pad}<${node.name}${attrs} />`];
    const body = node.content.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return [`${pad}<${node.name}${attrs}>{\``, body, `\`}</${node.name}>`];
  }

  if (node.type !== 'element') return childLines([node], depth, ctx);

  ctx.stats.elements += 1;
  const attrs = renderAttrs(node.attrs, ctx);
  const open = `<${node.name}${attrs}`;

  if (!node.children.length) return [`${pad}${open} />`];

  const onlyText = node.children.every((child) => child.type === 'text');
  if (onlyText) {
    const text = node.children.map((child) => (child.type === 'text' ? jsxText(child.raw.replace(/\s+/g, ' ')) : '')).join('');
    return [`${pad}${open}>${text.trim()}</${node.name}>`];
  }

  const inner = childLines(node.children, depth + 1, ctx);
  return [`${pad}${open}>`, ...inner, `${pad}</${node.name}>`];
}

function toJsx(src: string, ctx: Ctx, startDepth: number): string {
  const nodes = tokenize(src);
  return childLines(nodes, startDepth, ctx).join('\n');
}

function sanitizeComponentName(raw: string): string {
  const parts = raw.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!parts.length) return 'Icon';
  const name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  return /^[A-Za-z_]/.test(name) ? name : 'Icon' + name;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const component = o.component === true;
  const typescript = o.typescript === true;
  const styleObjects = o.styleObjects !== false;
  const indentSize = Number(o.indent ?? 2);
  const componentName = sanitizeComponentName(String(o.componentName ?? 'Icon'));

  if (!Number.isInteger(indentSize) || indentSize < 0 || indentSize > 8) {
    throw new ToolError('Indent must be a whole number from 0 to 8.');
  }

  const svg = input.text ?? '';
  if (!svg.trim()) {
    throw new ToolError('Paste some SVG or markup to convert.', 'Example: <svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>');
  }
  if (svg.length > MAX_LENGTH) {
    throw new ToolError('Input is too large.', `Keep it under ${MAX_LENGTH.toLocaleString('en-US')} characters.`);
  }

  const stats = { elements: 0, attributes: 0, styles: 0 };
  const ctx: Ctx = {
    unit: ' '.repeat(indentSize),
    styleObjects,
    stats,
    spread: component,
    spreadUsed: false,
  };
  const body = toJsx(svg, ctx, component ? 2 : 0);

  let output = body;
  if (component) {
    const pad1 = ' '.repeat(indentSize);
    const props = typescript ? 'props: SVGProps<SVGSVGElement>' : 'props';
    const lines: string[] = [];
    if (typescript) lines.push("import type { SVGProps } from 'react';", '');
    lines.push(`export function ${componentName}(${props}) {`, `${pad1}return (`, body, `${pad1});`, '}');
    output = lines.join('\n');
  }

  return {
    output,
    render: 'code',
    language: component ? 'tsx' : 'jsx',
    stats: { elements: stats.elements, attributes: stats.attributes, styleObjects: stats.styles },
    notes: [
      component
        ? `Converted ${stats.elements} element(s) into the ${componentName} component (${typescript ? 'TSX' : 'JSX'}).`
        : `Converted ${stats.elements} element(s) to JSX.`,
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
