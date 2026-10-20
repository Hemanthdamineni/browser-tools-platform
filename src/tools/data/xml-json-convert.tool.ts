import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './xml-json-convert.meta';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9A-Fa-f]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    if (body.startsWith('#')) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

interface XmlNode {
  name: string;
  attrs: [string, string][];
  children: XmlNode[];
  text: string;
}

class XmlReader {
  private src: string;
  private i = 0;

  constructor(src: string) {
    this.src = src.startsWith('\ufeff') ? src.slice(1) : src;
  }

  private eof(): boolean {
    return this.i >= this.src.length;
  }

  private startsWith(token: string): boolean {
    return this.src.startsWith(token, this.i);
  }

  private err(msg: string): never {
    const line = this.src.slice(0, this.i).split('\n').length;
    throw new ToolError(`XML line ${line}: ${msg}`);
  }

  private expect(token: string): void {
    if (!this.startsWith(token)) this.err(`Expected "${token}"`);
    this.i += token.length;
  }

  private readUntil(token: string, what: string): string {
    const end = this.src.indexOf(token, this.i);
    if (end === -1) this.err(`Unterminated ${what}`);
    const body = this.src.slice(this.i, end);
    this.i = end + token.length;
    return body;
  }

  private skipMisc(): void {
    for (;;) {
      while (!this.eof() && /\s/.test(this.src[this.i]!)) this.i++;
      if (this.startsWith('<!--')) {
        this.readUntil('-->', 'comment');
        continue;
      }
      if (this.startsWith('<?')) {
        this.readUntil('?>', 'processing instruction');
        continue;
      }
      if (this.startsWith('<!DOCTYPE') || this.startsWith('<!doctype')) {
        let depth = 0;
        while (!this.eof()) {
          const ch = this.src[this.i]!;
          if (ch === '[') depth++;
          else if (ch === ']') depth--;
          else if (ch === '>' && depth <= 0) {
            this.i++;
            break;
          }
          this.i++;
        }
        continue;
      }
      break;
    }
  }

  private readName(): string {
    const match = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(this.src.slice(this.i));
    if (!match) this.err('Expected an element or attribute name');
    this.i += match[0].length;
    return match[0];
  }

  private readAttrs(): [string, string][] {
    const attrs: [string, string][] = [];
    for (;;) {
      while (!this.eof() && /\s/.test(this.src[this.i]!)) this.i++;
      if (this.eof()) this.err('Unterminated start tag');
      const ch = this.src[this.i]!;
      if (ch === '/' || ch === '>') return attrs;
      const name = this.readName();
      while (!this.eof() && /\s/.test(this.src[this.i]!)) this.i++;
      this.expect('=');
      while (!this.eof() && /\s/.test(this.src[this.i]!)) this.i++;
      const quote = this.src[this.i];
      if (quote !== '"' && quote !== "'") this.err(`Attribute "${name}" must be quoted`);
      this.i++;
      const end = this.src.indexOf(quote, this.i);
      if (end === -1) this.err(`Unterminated value for attribute "${name}"`);
      attrs.push([name, decodeEntities(this.src.slice(this.i, end))]);
      this.i = end + 1;
    }
  }

  private parseElement(): XmlNode {
    this.expect('<');
    const name = this.readName();
    const attrs = this.readAttrs();
    const node: XmlNode = { name, attrs, children: [], text: '' };
    if (this.startsWith('/>')) {
      this.i += 2;
      return node;
    }
    this.expect('>');
    for (;;) {
      if (this.eof()) this.err(`Element <${name}> is never closed`);
      if (this.startsWith('</')) {
        this.i += 2;
        const closing = this.readName();
        while (!this.eof() && /\s/.test(this.src[this.i]!)) this.i++;
        this.expect('>');
        if (closing !== name) this.err(`Closing tag </${closing}> does not match <${name}>`);
        return node;
      }
      if (this.startsWith('<!--')) {
        this.readUntil('-->', 'comment');
        continue;
      }
      if (this.startsWith('<![CDATA[')) {
        this.i += '<![CDATA['.length;
        node.text += this.readUntil(']]>', 'CDATA section');
        continue;
      }
      if (this.startsWith('<?')) {
        this.readUntil('?>', 'processing instruction');
        continue;
      }
      if (this.startsWith('<!')) this.err('Unexpected declaration inside an element');
      if (this.startsWith('<')) {
        node.children.push(this.parseElement());
        continue;
      }
      const next = this.src.indexOf('<', this.i);
      const end = next === -1 ? this.src.length : next;
      node.text += decodeEntities(this.src.slice(this.i, end));
      this.i = end;
    }
  }

  parse(): XmlNode {
    this.skipMisc();
    if (this.eof()) this.err('No root element found');
    if (!this.startsWith('<')) this.err('Content is not allowed before the root element');
    const root = this.parseElement();
    this.skipMisc();
    if (!this.eof()) {
      if (this.startsWith('<')) this.err('Only one root element is allowed');
      this.err('Content is not allowed after the root element');
    }
    return root;
  }
}

interface BuildOptions {
  attributes: string;
  textKey: string;
}

function buildValue(
  node: XmlNode,
  options: BuildOptions,
  stats: { elements: number; attributes: number },
): Json {
  stats.elements++;
  stats.attributes += node.attrs.length;
  const childrenByName = new Map<string, XmlNode[]>();
  for (const child of node.children) {
    const list = childrenByName.get(child.name);
    if (list) list.push(child);
    else childrenByName.set(child.name, [child]);
  }
  const keepAttrs = options.attributes !== 'ignore';
  const hasStructure = keepAttrs
    ? node.attrs.length > 0 || node.children.length > 0
    : node.children.length > 0;
  const trimmedText = node.text.trim();
  if (!hasStructure) return trimmedText;
  const out: { [k: string]: Json } = {};
  if (keepAttrs && node.attrs.length) {
    if (options.attributes === 'nest') {
      const grouped: { [k: string]: Json } = {};
      for (const [key, value] of node.attrs) grouped[key] = value;
      out['@attributes'] = grouped;
    } else {
      for (const [key, value] of node.attrs) out[`@${key}`] = value;
    }
  }
  for (const [name, list] of childrenByName) {
    const values = list.map((child) => buildValue(child, options, stats));
    out[name] = list.length === 1 ? values[0]! : values;
  }
  if (trimmedText) out[options.textKey] = trimmedText;
  return out;
}

function jsonToXml(
  value: Json,
  name: string,
  indent: string,
  depth: number,
  stats: { elements: number },
): string {
  const pad = indent.repeat(depth);
  stats.elements++;
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}<${name}/>`;
    return value.map((item) => jsonToXml(item, name, indent, depth, stats)).join('\n');
  }
  if (value === null) return `${pad}<${name}/>`;
  if (typeof value !== 'object') return `${pad}<${name}>${escapeText(String(value))}</${name}>`;
  const attrs: string[] = [];
  const children: string[] = [];
  let text = '';
  for (const [key, item] of Object.entries(value)) {
    if (key === '@attributes' && item && typeof item === 'object' && !Array.isArray(item)) {
      for (const [attrKey, attrValue] of Object.entries(item)) {
        if (!NAME_RE.test(attrKey))
          throw new ToolError(`"${attrKey}" is not a valid XML attribute name.`);
        attrs.push(`${attrKey}="${escapeAttr(String(attrValue ?? ''))}"`);
      }
      continue;
    }
    if (key.startsWith('@')) {
      const attrKey = key.slice(1);
      if (!NAME_RE.test(attrKey))
        throw new ToolError(`"${attrKey}" is not a valid XML attribute name.`);
      attrs.push(`${attrKey}="${escapeAttr(String(item ?? ''))}"`);
      continue;
    }
    if (key === '#text') {
      if (item !== null && typeof item !== 'object') text += String(item);
      continue;
    }
    children.push(jsonToXml(item, key, indent, depth + 1, stats));
  }
  const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
  if (!children.length && !text) return `${pad}<${name}${attrText}/>`;
  const inner = [];
  if (text) inner.push(`${indent.repeat(depth + 1)}${escapeText(text)}`);
  inner.push(...children);
  return `${pad}<${name}${attrText}>\n${inner.join('\n')}\n${pad}</${name}>`;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const attributes = String(o.attributes);
  const textKeyOption = String(o.textKey).trim();
  const textKey = textKeyOption || '#text';
  const indentSize = Math.max(0, Math.min(8, Number(o.indent)));
  const indent = ' '.repeat(Number.isFinite(indentSize) ? indentSize : 2);
  const source = input.text.trim();

  if (mode === 'json-to-xml') {
    if (!source) {
      return {
        output: JSON.stringify({ headers: ['Mode', 'Input', 'Result'], rows: [] as string[][] }),
        render: 'table',
        notes: ['Paste a JSON object with a single root key, e.g. {"book":{"title":"Dune"}}.'],
      };
    }
    let parsed: Json;
    try {
      parsed = JSON.parse(source) as Json;
    } catch {
      throw new ToolError('Invalid JSON — check for trailing commas, comments, or unquoted keys.');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ToolError(
        'The JSON root must be an object whose single key names the XML root element.',
      );
    }
    const entries = Object.entries(parsed);
    if (entries.length !== 1) {
      throw new ToolError(
        `Expected exactly one root key but found ${entries.length}. Wrap the document in a single element name.`,
      );
    }
    const [rootName, rootValue] = entries[0]!;
    if (!NAME_RE.test(rootName))
      throw new ToolError(`"${rootName}" is not a valid XML element name.`);
    const stats = { elements: 0 };
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n${jsonToXml(rootValue, rootName, indent, 0, stats)}`;
    return {
      output: body,
      render: 'code',
      language: 'html',
      filename: `${rootName}.xml`,
      stats: { elements: stats.elements },
      notes: [
        'Keys starting with @ become attributes; #text becomes text content; arrays repeat the element.',
      ],
    };
  }

  if (!source) {
    return {
      output: JSON.stringify({ headers: ['Mode', 'Input', 'Result'], rows: [] as string[][] }),
      render: 'table',
      notes: ['Paste an XML document, e.g. <book id="1"><title>Dune</title></book>.'],
    };
  }
  const root = new XmlReader(source).parse();
  const stats = { elements: 0, attributes: 0 };
  const data: { [k: string]: Json } = {
    [root.name]: buildValue(root, { attributes, textKey }, stats),
  };
  return {
    output: JSON.stringify(data, null, 2),
    render: 'code',
    language: 'json',
    filename: `${root.name}.json`,
    stats: { elements: stats.elements, attributes: stats.attributes, root: root.name },
    notes: [
      'Values stay strings so the conversion is lossless; repeated sibling elements become arrays.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
