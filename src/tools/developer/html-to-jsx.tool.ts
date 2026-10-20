import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-to-jsx.meta';

const VOID_ELEMENTS = new Set([
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

const ATTR_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  contenteditable: 'contentEditable',
};

interface ENode {
  tag: string;
  attrs: Array<[string, string]>;
  children: Child[];
}

type Child =
  | { kind: 'element'; node: ENode }
  | { kind: 'text'; value: string }
  | { kind: 'comment'; value: string };

interface Fragment {
  roots: ENode[];
  errors: string[];
}

function parseHtml(source: string): Fragment {
  const roots: ENode[] = [];
  const errors: string[] = [];
  const stack: ENode[] = [];

  const addChild = (c: Child): void => {
    if (stack.length) stack[stack.length - 1]!.children.push(c);
    else if (c.kind === 'element') roots.push(c.node);
  };
  let i = 0;
  let text = '';

  const flush = (): void => {
    if (text !== '') {
      addChild({ kind: 'text', value: text });
      text = '';
    }
  };

  while (i < source.length) {
    const ch = source[i]!;
    if (ch !== '<') {
      text += ch;
      i += 1;
      continue;
    }
    if (source.startsWith('<!--', i)) {
      flush();
      const end = source.indexOf('-->', i + 4);
      if (end === -1) {
        errors.push('Unclosed comment.');
        break;
      }
      addChild({ kind: 'comment', value: source.slice(i + 4, end) });
      i = end + 3;
      continue;
    }
    if (source.startsWith('</', i)) {
      flush();
      const end = source.indexOf('>', i + 2);
      if (end === -1) {
        errors.push('Unclosed closing tag.');
        break;
      }
      const name = source
        .slice(i + 2, end)
        .trim()
        .toLowerCase();
      const top = stack[stack.length - 1];
      if (top && top.tag === name) stack.pop();
      else errors.push('Unexpected closing tag </' + name + '>.');
      i = end + 1;
      continue;
    }
    flush();
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
    const rawName = nameMatch[0];
    const tag = rawName.toLowerCase();
    if (!/^[a-zA-Z][\w.:-]*$/.test(tag)) {
      errors.push('Invalid tag name: ' + rawName);
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
      const nameStart = a;
      while (a < inner.length && !/[\s=/>]/.test(inner[a]!)) a += 1;
      const attrName = inner.slice(nameStart, a);
      let attrValue = '';
      while (a < inner.length && /[\s]/.test(inner[a]!)) a += 1;
      if (inner[a] === '=') {
        a += 1;
        while (a < inner.length && /[\s]/.test(inner[a]!)) a += 1;
        const q = inner[a];
        if (q === '"' || q === "'") {
          const end = inner.indexOf(q, a + 1);
          attrValue = end === -1 ? inner.slice(a + 1) : inner.slice(a + 1, end);
          a = end === -1 ? inner.length : end + 1;
        } else {
          const vStart = a;
          while (a < inner.length && !/[\s/>]/.test(inner[a]!)) a += 1;
          attrValue = inner.slice(vStart, a);
        }
      }
      if (attrName) {
        const existing = attrs.findIndex(([k]) => k === attrName);
        if (existing === -1) attrs.push([attrName, attrValue]);
        else attrs[existing] = [attrName, attrs[existing]![1] + ' ' + attrValue];
      }
    }
    const node: ENode = { tag, attrs, children: [] };
    addChild({ kind: 'element', node });
    if (!VOID_ELEMENTS.has(tag) && !selfClosed) stack.push(node);
    i = tagEnd + 1;
  }
  flush();
  if (stack.length)
    errors.push('Unbalanced — <' + stack[stack.length - 1]!.tag + '> is never closed.');
  return { roots, errors };
}

function jsAttrName(raw: string): string {
  return ATTR_MAP[raw.toLowerCase()] ?? raw;
}

function jsAttrValue(raw: string): string {
  if (raw === '') return '""';
  if (raw.includes('"')) return '{' + JSON.stringify(raw) + '}';
  return '"' + raw + '"';
}

const collapseSpace = (s: string): string => s.replace(/\s+/g, ' ');

function jsxComment(inner: string): string {
  return '{/* ' + inner.replace(/\*\//g, '*\\/').trim() + ' */}';
}

function attrText(node: ENode): string {
  return node.attrs
    .map(([k, v]) => (v === '' ? ' ' + jsAttrName(k) : ' ' + jsAttrName(k) + '=' + jsAttrValue(v)))
    .join('');
}

function renderNode(node: ENode, depth: number, inline: boolean): string {
  const pad = '  '.repeat(depth);
  if (VOID_ELEMENTS.has(node.tag)) return pad + '<' + node.tag + attrText(node) + ' />';
  const hasText = node.children.some((c) => c.kind === 'text' && c.value.trim() !== '');
  if (inline || hasText) {
    const content = node.children
      .map((c) => {
        if (c.kind === 'text') return collapseSpace(c.value);
        if (c.kind === 'comment') return ' ' + jsxComment(c.value) + ' ';
        return renderNode(c.node, 0, true);
      })
      .join('')
      .trim();
    if (content === '') return pad + '<' + node.tag + attrText(node) + ' />';
    return pad + '<' + node.tag + attrText(node) + '>' + content + '</' + node.tag + '>';
  }
  const body: string[] = [];
  for (const c of node.children) {
    if (c.kind === 'comment') body.push('  '.repeat(depth + 1) + jsxComment(c.value));
    else if (c.kind === 'text') {
      const t = c.value.trim();
      if (t) body.push('  '.repeat(depth + 1) + t);
    } else body.push(renderNode(c.node, depth + 1, false));
  }
  const full = body.filter((s) => s.trim() !== '');
  if (!full.length) return pad + '<' + node.tag + attrText(node) + ' />';
  return (
    pad +
    '<' +
    node.tag +
    attrText(node) +
    '>\n' +
    full.join('\n') +
    '\n' +
    pad +
    '</' +
    node.tag +
    '>'
  );
}

function countElements(nodes: ENode[]): number {
  let n = 0;
  const walk = (list: ENode[]): void => {
    for (const node of list) {
      n += 1;
      for (const c of node.children) if (c.kind === 'element') walk([c.node]);
    }
  };
  walk(nodes);
  return n;
}

function removeComments(node: ENode): ENode {
  const children: ENode['children'] = [];
  for (const c of node.children) {
    if (c.kind === 'element') children.push({ kind: 'element', node: removeComments(c.node) });
    else if (c.kind === 'text') children.push(c);
  }
  return { ...node, children };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const useFragment = o.fragment !== false;
  const preserveComments = o.preserveComments !== false;
  const source = input.text ?? '';
  if (!source.trim()) {
    throw new ToolError('Paste some HTML to convert.', 'Example: <p class="lead">Hello</p>');
  }
  if (source.length > 1_000_000) {
    throw new ToolError('HTML is too large.', 'Keep it under 1,000,000 characters.');
  }

  const parsed = parseHtml(source);
  if (parsed.errors.length) {
    throw new ToolError('Could not read the HTML.', parsed.errors.join('\n'));
  }

  const roots = preserveComments ? parsed.roots : parsed.roots.map((r) => removeComments(r));
  const multiple = roots.length > 1 && useFragment;
  const output = roots.map((r) => renderNode(r, multiple ? 1 : 0, false)).join('\n');
  const finalOutput = multiple ? '<>\n' + output + '\n</>\n' : output + '\n';

  return {
    output: finalOutput,
    render: 'code',
    language: 'jsx',
    stats: { elements: countElements(roots) },
    notes: [
      preserveComments ? 'Comments kept as {/* … */}.' : 'Comments removed.',
      'Inline styles stay strings — replace with objects where you need dynamic values.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
