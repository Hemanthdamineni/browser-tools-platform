import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-to-pug.meta';

const MAX_LEN = 500_000;

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param',
  'source', 'track', 'wbr',
]);

const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

interface ElementNode {
  kind: 'element';
  tag: string;
  attrs: { name: string; value: string | null }[];
  children: Node[];
  selfClosing: boolean;
}

interface TextNode {
  kind: 'text';
  text: string;
}

interface CommentNode {
  kind: 'comment';
  text: string;
}

type Node = ElementNode | TextNode | CommentNode;

interface ParserState {
  src: string;
  pos: number;
  warnings: string[];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&');
}

function parseAttributes(state: ParserState, raw: string): { name: string; value: string | null }[] {
  const attrs: { name: string; value: string | null }[] = [];
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const name = m[1]!;
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : null;
    if (name === '/' || name === '') continue;
    attrs.push({ name, value: value === null ? null : decodeEntities(value) });
  }
  void state;
  return attrs;
}

function parseNodes(state: ParserState, stopTag: string | null): Node[] {
  const nodes: Node[] = [];
  const { src } = state;

  while (state.pos < src.length) {
    const lt = src.indexOf('<', state.pos);
    if (lt === -1) {
      const text = src.slice(state.pos);
      if (text !== '') nodes.push({ kind: 'text', text });
      state.pos = src.length;
      break;
    }
    if (lt > state.pos) {
      nodes.push({ kind: 'text', text: src.slice(state.pos, lt) });
      state.pos = lt;
    }

    // Comment.
    if (src.startsWith('<!--', state.pos)) {
      const end = src.indexOf('-->', state.pos + 4);
      if (end === -1) {
        state.warnings.push('Unterminated HTML comment was dropped.');
        state.pos = src.length;
        break;
      }
      nodes.push({ kind: 'comment', text: src.slice(state.pos + 4, end) });
      state.pos = end + 3;
      continue;
    }

    // Doctype or CDATA or processing instruction — skip.
    if (src.startsWith('<!', state.pos) || src.startsWith('<?', state.pos)) {
      const end = src.indexOf('>', state.pos);
      state.pos = end === -1 ? src.length : end + 1;
      continue;
    }

    // Closing tag.
    if (src.startsWith('</', state.pos)) {
      const end = src.indexOf('>', state.pos);
      if (end === -1) {
        state.pos = src.length;
        break;
      }
      const tag = src.slice(state.pos + 2, end).trim().toLowerCase();
      state.pos = end + 1;
      if (stopTag !== null && tag === stopTag) return nodes;
      // Stray closing tag — ignore, but note it once.
      if (stopTag === null) state.warnings.push('Stray closing tag </' + tag + '> was ignored.');
      continue;
    }

    // Opening tag.
    const tagMatch = /^<([A-Za-z][\w:-]*)/.exec(src.slice(state.pos));
    if (!tagMatch) {
      // A literal '<' that is not a tag — treat as text.
      nodes.push({ kind: 'text', text: '<' });
      state.pos += 1;
      continue;
    }
    const tag = tagMatch[1]!.toLowerCase();
    state.pos += tagMatch[0].length;

    // Find the end of the open tag, respecting quoted attribute values.
    let j = state.pos;
    let quote: string | null = null;
    let selfClosing = false;
    while (j < src.length) {
      const ch = src[j]!;
      if (quote !== null) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      j += 1;
    }
    if (j >= src.length) {
      state.warnings.push('Unterminated <' + tag + '> tag; treated as text.');
      nodes.push({ kind: 'text', text: src.slice(state.pos - tagMatch[0].length) });
      state.pos = src.length;
      break;
    }

    let attrRaw = src.slice(state.pos, j);
    if (attrRaw.trimEnd().endsWith('/')) {
      selfClosing = true;
      attrRaw = attrRaw.trimEnd().slice(0, -1);
    }
    state.pos = j + 1;

    const element: ElementNode = {
      kind: 'element',
      tag,
      attrs: parseAttributes(state, attrRaw),
      children: [],
      selfClosing: selfClosing || VOID_ELEMENTS.has(tag),
    };

    if (element.selfClosing) {
      nodes.push(element);
      continue;
    }

    if (RAW_TEXT_ELEMENTS.has(tag)) {
      const closeRe = new RegExp('</' + tag + '\\s*>', 'i');
      const rest = src.slice(state.pos);
      const closeMatch = closeRe.exec(rest);
      if (!closeMatch) {
        state.warnings.push('<' + tag + '> has no closing tag; its contents were taken to the end.');
        element.children.push({ kind: 'text', text: rest });
        state.pos = src.length;
      } else {
        element.children.push({ kind: 'text', text: rest.slice(0, closeMatch.index) });
        state.pos += closeMatch.index + closeMatch[0].length;
      }
      nodes.push(element);
      continue;
    }

    element.children = parseNodes(state, tag);
    nodes.push(element);
  }

  if (stopTag !== null) {
    state.warnings.push('Missing closing tag </' + stopTag + '>; it was closed implicitly.');
  }
  return nodes;
}

function attrValue(value: string | null, quote: string): string {
  if (value === null) return '';
  const needsEscape = value.includes(quote);
  const escaped = needsEscape ? value.replace(new RegExp(quote, 'g'), '\\' + quote) : value;
  return quote + escaped + quote;
}

function renderAttributes(attrs: { name: string; value: string | null }[], quote: string): string {
  const parts: string[] = [];
  for (const attr of attrs) {
    if (attr.name === 'class' || attr.name === 'id') continue;
    parts.push(attr.name + (attr.value === null ? '' : '=' + attrValue(attr.value, quote)));
  }
  return parts.length === 0 ? '' : '(' + parts.join(' ') + ')';
}

function selectorFor(element: ElementNode): string {
  let selector = '';
  const tag = element.tag;
  const idAttr = element.attrs.find((a) => a.name === 'id');
  const classAttr = element.attrs.find((a) => a.name === 'class');

  const classes = classAttr?.value ? classAttr.value.split(/\s+/).filter((c) => c !== '') : [];

  if (tag === 'div' && (idAttr !== undefined || classes.length > 0)) {
    selector = '';
  } else {
    selector = tag;
  }

  if (idAttr?.value) selector += '#' + idAttr.value;
  for (const cls of classes) selector += '.' + cls;
  return selector === '' ? tag : selector;
}

function normalizeText(text: string): string {
  return decodeEntities(text).replace(/\s+/g, ' ');
}

function emit(nodes: Node[], depth: number, indentUnit: string, quote: string, opts: {
  keepComments: boolean;
  inlineText: boolean;
}): string[] {
  const lines: string[] = [];
  const pad = indentUnit.repeat(depth);

  for (const node of nodes) {
    if (node.kind === 'comment') {
      if (!opts.keepComments) continue;
      lines.push(pad + '//- ' + node.text.trim().replace(/\s+/g, ' '));
      continue;
    }

    if (node.kind === 'text') {
      const text = normalizeText(node.text).trim();
      if (text === '') continue;
      lines.push(pad + '| ' + text);
      continue;
    }

    const selector = selectorFor(node);
    const attrText = renderAttributes(node.attrs, quote);

    // Raw text elements.
    if (RAW_TEXT_ELEMENTS.has(node.tag)) {
      const body = node.children.map((c) => (c.kind === 'text' ? c.text : '')).join('');
      const trimmed = body.replace(/^\n/, '').replace(/\s+$/, '');
      lines.push(pad + selector + attrText + '.');
      for (const rawLine of trimmed.split('\n')) {
        lines.push(pad + indentUnit + rawLine.trimEnd());
      }
      continue;
    }

    // Empty element.
    if (node.children.length === 0) {
      lines.push(pad + selector + attrText);
      continue;
    }

    const meaningful = node.children.filter((c) => c.kind !== 'text' || normalizeText(c.text).trim() !== '');
    const onlyText = meaningful.length > 0 && meaningful.every((c) => c.kind === 'text');

    if (onlyText) {
      const text = meaningful.map((c) => (c.kind === 'text' ? normalizeText(c.text).trim() : '')).join(' ').trim();
      if (opts.inlineText && text !== '' && !text.includes('\n')) {
        lines.push(pad + selector + attrText + ' ' + text);
      } else {
        lines.push(pad + selector + attrText);
        lines.push(pad + indentUnit + '| ' + text);
      }
      continue;
    }

    lines.push(pad + selector + attrText);
    const childLines = emit(node.children, depth + 1, indentUnit, quote, opts);
    lines.push(...childLines);
  }

  return lines;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const indentWidth = Math.max(2, Math.min(8, Number(o.indentWidth ?? 2)));
  const quoteStyle = String(o.quoteStyle ?? 'double');
  const keepComments = o.keepComments !== false;
  const inlineText = o.inlineText !== false;

  const quote = quoteStyle === 'single' ? "'" : '"';
  const raw = String(input.text ?? '').trim();
  if (raw === '') throw new ToolError('Paste some HTML to convert.');
  if (raw.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');

  const state: ParserState = { src: raw, pos: 0, warnings: [] };
  const nodes = parseNodes(state, null);
  if (nodes.length === 0 || countElements(nodes) === 0)
    throw new ToolError('No HTML elements found.', 'Paste markup such as <div class="card">…</div>.');

  const indentUnit = ' '.repeat(indentWidth);
  const lines = emit(nodes, 0, indentUnit, quote, { keepComments, inlineText });
  if (lines.length === 0) throw new ToolError('Nothing to convert after parsing.');

  const elements = countElements(nodes);
  const notes: string[] = [elements + ' element(s) converted to Pug.'];
  for (const warning of Array.from(new Set(state.warnings)).slice(0, 5)) notes.push('Warning: ' + warning);

  return {
    output: lines.join('\n') + '\n',
    render: 'text',
    language: 'pug',
    stats: { elements, lines: lines.length },
    notes,
  };
}

function countElements(nodes: Node[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.kind === 'element') {
      n += 1;
      n += countElements(node.children);
    }
  }
  return n;
}

const tool: TextToolModule = { meta, run };
export default tool;
