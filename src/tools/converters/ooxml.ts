/**
 * Zero-dependency helpers for reading Office Open XML (OOXML) packages.
 *
 * DOCX / XLSX / PPTX / ODP are ZIP archives whose parts are XML. Tool `run()`
 * functions must stay pure (no DOM) so they are unit-testable and portable to a
 * Web Worker — where `DOMParser` is **not** available. This module therefore
 * ships a small, purpose-built XML reader plus a handful of node/attribute
 * helpers, rather than depending on the browser's HTML parser.
 *
 * The reader is intentionally lenient: OOXML is machine-generated, well-formed
 * XML, and being tolerant of minor deviations is preferable to throwing.
 */

import { unzipSync } from 'fflate';
import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  XML tree                                                                  */
/* -------------------------------------------------------------------------- */

export interface XmlElement {
  type: 'element';
  /** Qualified name as written, e.g. `w:p`. */
  name: string;
  /** Name with any namespace prefix removed, e.g. `p`. */
  local: string;
  /** Attribute values keyed by their qualified name (entities already decoded). */
  attrs: Record<string, string>;
  children: XmlNode[];
}

export interface XmlText {
  type: 'text';
  /** Character data, with XML entities decoded. */
  text: string;
}

export type XmlNode = XmlElement | XmlText;

export function isElement(node: XmlNode): node is XmlElement {
  return node.type === 'element';
}

/* -------------------------------------------------------------------------- */
/*  Entity decoding                                                           */
/* -------------------------------------------------------------------------- */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

export function decodeEntities(input: string): string {
  if (!input.includes('&')) return input;
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.charCodeAt(0) === 35 /* '#' */) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      // Lone surrogates throw in fromCodePoint — fall back to the raw match.
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/* -------------------------------------------------------------------------- */
/*  XML parser                                                                */
/* -------------------------------------------------------------------------- */

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}

function localOf(name: string): string {
  const colon = name.lastIndexOf(':');
  return colon === -1 ? name : name.slice(colon + 1);
}

interface StartTag {
  name: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  next: number;
}

/** Parse a `<tag …>` / `<tag …/>` starting at `start` (which points at `<`). */
function parseStartTag(src: string, start: number): StartTag | null {
  const n = src.length;
  let i = start + 1;
  const nameStart = i;
  while (i < n) {
    const c = src[i] as string;
    if (isWhitespace(c) || c === '/' || c === '>' || c === '=') break;
    i++;
  }
  const name = src.slice(nameStart, i);
  if (!name) return null;

  const attrs: Record<string, string> = {};
  while (i < n) {
    while (i < n && isWhitespace(src[i] as string)) i++;
    if (i >= n) break;
    const c = src[i] as string;
    if (c === '>') return { name, attrs, selfClosing: false, next: i + 1 };
    if (c === '/') {
      if (src[i + 1] === '>') return { name, attrs, selfClosing: true, next: i + 2 };
      i++;
      continue;
    }
    // Attribute name.
    const attrStart = i;
    while (i < n) {
      const a = src[i] as string;
      if (isWhitespace(a) || a === '=' || a === '>' || a === '/') break;
      i++;
    }
    const attrName = src.slice(attrStart, i);
    while (i < n && isWhitespace(src[i] as string)) i++;
    let value = '';
    if (src[i] === '=') {
      i++;
      while (i < n && isWhitespace(src[i] as string)) i++;
      const quote = src[i];
      if (quote === '"' || quote === "'") {
        i++;
        const valueStart = i;
        while (i < n && src[i] !== quote) i++;
        value = src.slice(valueStart, i);
        i++; // closing quote
      } else {
        const valueStart = i;
        while (i < n) {
          const a = src[i] as string;
          if (isWhitespace(a) || a === '>' || a === '/') break;
          i++;
        }
        value = src.slice(valueStart, i);
      }
    }
    if (attrName) attrs[attrName] = decodeEntities(value);
  }
  // Unterminated tag at EOF — treat what we have as a self-closing tag.
  return { name, attrs, selfClosing: true, next: n };
}

/** Parse an XML document into a tree rooted at an artificial `#root` element. */
export function parseXml(input: string): XmlElement {
  const src = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const root: XmlElement = { type: 'element', name: '#root', local: '#root', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  const n = src.length;
  let i = 0;

  const appendText = (raw: string, decode: boolean) => {
    if (!raw) return;
    const text = decode ? decodeEntities(raw) : raw;
    const parent = stack[stack.length - 1];
    (parent as XmlElement).children.push({ type: 'text', text });
  };

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      appendText(src.slice(i), true);
      break;
    }
    if (lt > i) appendText(src.slice(i, lt), true);

    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9);
      appendText(end === -1 ? src.slice(lt + 9) : src.slice(lt + 9, end), false);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (src.startsWith('<?', lt)) {
      const end = src.indexOf('?>', lt + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (src.startsWith('<!', lt)) {
      // DOCTYPE / declaration — skip to `>`, ignoring any internal subset brackets.
      let j = lt + 2;
      let depth = 0;
      while (j < n) {
        const c = src[j] as string;
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth <= 0) {
          j++;
          break;
        }
        j++;
      }
      i = j;
      continue;
    }
    if (src.startsWith('</', lt)) {
      const end = src.indexOf('>', lt + 2);
      if (end === -1) {
        i = n;
        break;
      }
      const name = src.slice(lt + 2, end).trim();
      const local = localOf(name);
      // Pop to the matching open element (lenient about stray close tags).
      for (let depth = stack.length - 1; depth >= 1; depth--) {
        if (stack[depth]?.local === local) {
          stack.length = depth;
          break;
        }
      }
      i = end + 1;
      continue;
    }

    const tag = parseStartTag(src, lt);
    if (!tag) {
      appendText('<', true);
      i = lt + 1;
      continue;
    }
    const element: XmlElement = {
      type: 'element',
      name: tag.name,
      local: localOf(tag.name),
      attrs: tag.attrs,
      children: [],
    };
    stack[stack.length - 1]?.children.push(element);
    if (!tag.selfClosing) stack.push(element);
    i = tag.next;
  }

  return root;
}

/* -------------------------------------------------------------------------- */
/*  Node helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Every direct child element, optionally filtered by local name. */
export function childElements(el: XmlElement, local?: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (const child of el.children) {
    if (child.type === 'element' && (local === undefined || child.local === local)) out.push(child);
  }
  return out;
}

export function firstElement(el: XmlElement | undefined, local: string): XmlElement | undefined {
  if (!el) return undefined;
  for (const child of el.children) {
    if (child.type === 'element' && child.local === local) return child;
  }
  return undefined;
}

/** Attribute lookup by qualified OR local name (`val`, `r:id`, `xml:space`…). */
export function attr(el: XmlElement | undefined, name: string): string | undefined {
  if (!el) return undefined;
  const direct = el.attrs[name];
  if (direct !== undefined) return direct;
  for (const key of Object.keys(el.attrs)) {
    if (localOf(key) === name) return el.attrs[key];
  }
  return undefined;
}

/** `true` when a toggle element is present and not explicitly switched off. */
export function toggleOn(el: XmlElement | undefined): boolean {
  if (!el) return false;
  const val = attr(el, 'val');
  return val !== '0' && val !== 'false' && val !== 'off';
}

/** Concatenated text of every descendant text node, in document order. */
export function elementText(el: XmlElement): string {
  let out = '';
  const stack: XmlNode[] = [...el.children].reverse();
  while (stack.length) {
    const node = stack.pop() as XmlNode;
    if (node.type === 'text') {
      out += node.text;
    } else {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child) stack.push(child);
      }
    }
  }
  return out;
}

/** Depth-first search for the first descendant with the given local name. */
export function findDescendant(el: XmlElement, local: string): XmlElement | undefined {
  const stack: XmlElement[] = [];
  for (const child of el.children) if (child.type === 'element') stack.push(child);
  while (stack.length) {
    const node = stack.pop() as XmlElement;
    if (node.local === local) return node;
    for (const child of node.children) if (child.type === 'element') stack.push(child);
  }
  return undefined;
}

/** Lowest common ancestor depth of descendants matching `local` (search helper). */
export function descendants(el: XmlElement, local: string, out: XmlElement[] = []): XmlElement[] {
  for (const child of el.children) {
    if (child.type === 'element') {
      if (child.local === local) out.push(child);
      descendants(child, local, out);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  ZIP / package helpers                                                     */
/* -------------------------------------------------------------------------- */

export function looksLikeZip(bytes: Uint8Array): boolean {
  // "PK\x03\x04" (local file), "PK\x05\x06" (empty), "PK\x07\x08" (spanned).
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  );
}

export function looksLikeOle(bytes: Uint8Array): boolean {
  const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return bytes.length >= 8 && sig.every((b, i) => bytes[i] === b);
}

export function looksLikeRtf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x7b && // {
    bytes[1] === 0x5c && // \
    bytes[2] === 0x72 && // r
    bytes[3] === 0x74 && // t
    bytes[4] === 0x66 // f
  );
}

/**
 * Extract the entries of a ZIP package, optionally filtering by path. Throws a
 * friendly `ToolError` for anything that is not a readable deflate ZIP.
 */
export function unzipPackage(
  bytes: Uint8Array,
  filter?: (name: string) => boolean,
): Record<string, Uint8Array> {
  try {
    const opts = filter ? { filter: (file: { name: string }) => filter(file.name.replace(/\\/g, '/')) } : undefined;
    return unzipSync(bytes, opts);
  } catch {
    throw new ToolError(
      'Could not read this Office file.',
      'The package is corrupt or uses an unsupported compression method.',
    );
  }
}

/** Decode an UTF-8 XML part, ignoring a leading byte-order mark. */
export function decodeXmlPart(bytes: Uint8Array): string {
  let data = bytes;
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    data = data.subarray(3);
  }
  // TextDecoder without `fatal` replaces malformed sequences rather than throwing.
  return new TextDecoder('utf-8').decode(data);
}

/** Resolve a relationship target to a package path (`word/media/x.png`, …). */
export function resolvePartPath(baseDir: string, target: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return target; // external URI
  const absolute = target.startsWith('/');
  const segments = (absolute ? target : `${baseDir}/${target}`).split('/');
  const stack: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  return stack.join('/');
}
