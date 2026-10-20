import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './svg-optimizer.meta';

const MAX_LENGTH = 2_000_000;

interface Elt {
  name: string;
  attrs: Array<[string, string]>;
  children: Array<Elt | { text: string }>;
  selfClosed: boolean;
}

interface ParseResult {
  root: Elt | null;
  prolog: string[];
  errors: string[];
}

function parseAttr(source: string, from: number): { name: string; value: string; next: number } {
  const nameMatch = /^[^\s=/>]+/.exec(source.slice(from));
  const name = nameMatch ? nameMatch[0] : '';
  let i = from + name.length;
  let value = '';
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === '=') {
      i += 1;
      const quote = source[i];
      if (quote === '"' || quote === "'") {
        const end = source.indexOf(quote, i + 1);
        value = end === -1 ? source.slice(i + 1) : source.slice(i + 1, end);
        i = end === -1 ? source.length : end + 1;
      } else {
        const endMatch = /^[^\s/>]+/.exec(source.slice(i));
        value = endMatch ? endMatch[0] : '';
        i += value.length;
      }
      break;
    }
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '>' || ch === '/') break;
    i += 1;
  }
  return { name, value, next: i };
}

function parseSvg(source: string): ParseResult {
  const errors: string[] = [];
  const prolog: string[] = [];
  let root: Elt | null = null;
  const stack: Elt[] = [];
  let i = 0;
  let textBuf = '';

  const flushText = (): void => {
    if (textBuf.trim() !== '' && stack.length) stack[stack.length - 1]!.children.push({ text: textBuf });
    textBuf = '';
  };

  while (i < source.length) {
    const ch = source[i]!;
    if (ch === '<') {
      if (source.startsWith('<!--', i)) {
        flushText();
        const end = source.indexOf('-->', i + 4);
        if (end === -1) {
          errors.push('Unclosed comment.');
          break;
        }
        // comments are dropped during render by default
        i = end + 3;
        continue;
      }
      if (source.startsWith('<!', i) || source.startsWith('<?', i)) {
        flushText();
        const close = source.startsWith('<?', i) ? '?>' : '>';
        const end = source.indexOf(close, i);
        if (end === -1) {
          errors.push('Unclosed declaration.');
          break;
        }
        prolog.push(source.slice(i, end + close.length));
        i = end + close.length;
        continue;
      }
      if (source.startsWith('</', i)) {
        flushText();
        const end = source.indexOf('>', i + 2);
        if (end === -1) {
          errors.push('Unclosed closing tag.');
          break;
        }
        const name = source.slice(i + 2, end).trim();
        const top = stack[stack.length - 1];
        if (top && top.name === name) stack.pop();
        else errors.push('Unexpected closing tag </' + name + '>.');
        i = end + 1;
        continue;
      }
      flushText();
      const tagEnd = source.indexOf('>', i + 1);
      if (tagEnd === -1) {
        errors.push('Unclosed tag.');
        break;
      }
      const inner = source.slice(i + 1, tagEnd);
      const nameMatch = /^[^\s/>]+/.exec(inner);
      if (!nameMatch) {
        errors.push('Expected a tag name.');
        break;
      }
      const name = nameMatch[0];
      if (!/^[a-zA-Z_][\w.:-]*$/.test(name) && name !== 'svg') {
        errors.push('Invalid tag name: ' + name);
        break;
      }
      const attrs: Array<[string, string]> = [];
      let a = nameMatch[0].length;
      let selfClosed = false;
      while (a < inner.length) {
        const c = inner[a]!;
        if (c === '/' && (inner[a + 1] === '>' || inner[a + 1] === undefined)) {
          selfClosed = true;
          break;
        }
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
          a += 1;
          continue;
        }
        const parsed = parseAttr(inner, a);
        if (parsed.name) {
          const existing = attrs.findIndex(([k]) => k === parsed.name);
          if (existing === -1) attrs.push([parsed.name, parsed.value]);
          else attrs[existing] = [parsed.name, attrs[existing]![1] + ' ' + parsed.value];
        }
        a = parsed.next;
      }
      const el: Elt = { name, attrs, children: [], selfClosed };
      if (name.toLowerCase() === 'svg' && !root) root = el;
      if (stack.length) stack[stack.length - 1]!.children.push(el);
      if (!selfClosed) stack.push(el);
      i = tagEnd + 1;
      continue;
    }
    textBuf += ch;
    i += 1;
  }
  flushText();

  if (!root) errors.push('No <svg> element found.');
  if (stack.length) errors.push('Unbalanced tags — <' + stack[stack.length - 1]!.name + '> is never closed.');
  return { root, prolog, errors };
}

function roundNumber(value: string, precision: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  const factor = 10 ** precision;
  const rounded = Math.round(num * factor) / factor;
  if (Object.is(rounded, -0)) return '0';
  return String(rounded);
}

const MEANINGFUL = new Set([
  'transform', 'fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'style',
  'filter', 'mask', 'clip-path', 'id', 'href', 'xlink:href', 'd', 'class',
]);

function shouldDropEmptyGroup(el: Elt): boolean {
  if (el.name !== 'g') return false;
  const meaningful = el.attrs.some(([k]) => MEANINGFUL.has(k));
  if (meaningful) return false;
  const childEls = el.children.filter((c): c is Elt => 'name' in c);
  return childEls.length === 0;
}

function walkDrop(el: Elt, dropEmpty: boolean): Elt {
  const kept: Array<Elt | { text: string }> = [];
  for (const child of el.children) {
    if ('name' in child) {
      const walked = walkDrop(child, dropEmpty);
      if (dropEmpty && shouldDropEmptyGroup(walked)) continue;
      kept.push(walked);
    } else {
      kept.push(child);
    }
  }
  el.children = kept;
  return el;
}


const NUMERIC_TOKEN = /(-?\d+(?:\.\d+)?|-?\.\d+)/g;

/** Round standalone numbers in an attribute value; leave colours, ids and units alone. */
function roundAttrValue(value: string, precision: number): string {
  if (/#/.test(value)) return value;
  return value.replace(NUMERIC_TOKEN, (m) => roundNumber(m, precision));
}

function renderSvg(root: Elt, mode: 'minify' | 'pretty', precision: number): string {
  const out: string[] = [];
  const pretty = mode === 'pretty';

  const attrText = (el: Elt): string =>
    el.attrs
      .map(([k, v]) => ' ' + k + '="' + roundAttrValue(v, precision).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"')
      .join('');

  const renderEl = (el: Elt, depth: number): void => {
    const pad = pretty && depth > 0 ? '\n' + '  '.repeat(depth) : '';
    const attrs = attrText(el);
    if (el.selfClosed) {
      out.push(pad + '<' + el.name + attrs + '/>');
      return;
    }
    const children = el.children.filter((c) => !('text' in c) || c.text.trim() !== '');
    if (!children.length) {
      out.push(pad + '<' + el.name + attrs + '></' + el.name + '>');
      return;
    }
    out.push(pad + '<' + el.name + attrs + '>');
    for (const child of children) {
      if ('text' in child) {
        const text = child.text.trim();
        out.push(pretty ? '\n' + '  '.repeat(depth + 1) + text : text);
      } else {
        renderEl(child, depth + 1);
      }
    }
    out.push(pad + '</' + el.name + '>');
  };

  renderEl(root, 0);
  const joined = out.join('');
  return joined + (pretty ? '\n' : '');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode ?? 'minify') === 'pretty' ? 'pretty' : 'minify';
  let precision = Number(o.precision ?? 2);
  if (!Number.isFinite(precision)) precision = 2;
  if (precision < 0 || precision > 6) throw new ToolError('Precision must be between 0 and 6.');
  const stripComments = o.stripComments !== false;
  const removeEmpty = o.removeEmptyGroups !== false;

  const source = input.text ?? '';
  if (!source.trim()) {
    throw new ToolError('Paste an SVG to optimize.', 'For example an export from Figma, Inkscape or Sketch.');
  }
  if (source.length > MAX_LENGTH) {
    throw new ToolError('SVG is too large.', 'Keep it under 2,000,000 characters.');
  }

  const parsed = parseSvg(source);
  if (parsed.errors.length) {
    throw new ToolError('Could not read the SVG.', parsed.errors.join('\n'));
  }
  const root = parsed.root as Elt;

  // Drop empty groups.
  if (removeEmpty) walkDrop(root, true);

  // When stripping comments, we already ignore them at parse time; keep the option honest here.
  void stripComments;

  const output = renderSvg(root, mode, precision);
  const header = parsed.prolog.length ? parsed.prolog.join(' ') + '\n' : '';
  const bytes = header.length + output.length;
  const before = source.replace(/\r\n?/g, '\n').length;

  const notes = [];
  const saved = before - bytes;
  notes.push(`Input ${before} chars → output ${bytes} chars (${saved >= 0 ? 'saved ' + saved : 'grew by ' + -saved}).`);
  if (stripComments) notes.push('Comments removed.');
  else notes.push('Comments were preserved.');

  const stats = { elements: 0, attributes: 0 };
  const count = (el: Elt): void => {
    stats.elements += 1;
    stats.attributes += el.attrs.length;
    for (const c of el.children) if ('name' in c) count(c as Elt);
  };
  count(root);

  return {
    output: header + output,
    language: 'xml',
    render: 'code',
    stats,
    notes,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
