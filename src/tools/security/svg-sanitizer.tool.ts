import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './svg-sanitizer.meta';

const MAX_BYTES = 10 * 1024 * 1024;
const PREVIEW_LIMIT = 200_000;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Elements that can execute script, embed another document, or install scripted behaviour. */
const DROP_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'handler',
  'listener',
  'audiolistener',
  'animation',
]);

interface Change {
  action: string;
  target: string;
  detail: string;
}

function reasonFor(name: string): string {
  switch (name) {
    case 'script':
      return 'Script elements execute code.';
    case 'foreignobject':
      return 'foreignObject can carry arbitrary HTML, including scripts.';
    case 'iframe':
    case 'embed':
    case 'object':
      return 'It can load and run content from another document.';
    case 'handler':
    case 'listener':
    case 'audiolistener':
    case 'animation':
      return 'SVG 1.2 scripted behaviour is not needed in static artwork.';
    default:
      return 'It is not allowed in a hardened SVG.';
  }
}

/** Whitespace and control characters are stripped so "java\nscript:" cannot slip through. */
function compact(value: string): string {
  return value.replace(/[\u0000-\u0020]/gu, '').toLowerCase();
}

function unsafeCss(value: string): boolean {
  const flat = compact(value);
  return flat.includes('javascript:') || flat.includes('vbscript:') || /expression\(/u.test(flat);
}

function isAttached(node: Node, root: Node): boolean {
  let current: Node | null = node;
  while (current !== null) {
    if (current === root) return true;
    current = current.parentNode;
  }
  return false;
}

function allNodes(root: Node): Node[] {
  const out: Node[] = [];
  const stack: Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) continue;
    for (const child of Array.from(node.childNodes)) {
      out.push(child);
      stack.push(child);
    }
  }
  return out;
}

function describe(element: Element): string {
  const id = element.getAttribute('id');
  if (id !== null && id !== '') return element.localName + '#' + id;
  const classes = element.getAttribute('class');
  if (classes !== null && classes.trim() !== '') {
    return element.localName + '.' + (classes.trim().split(/\s+/u)[0] ?? '');
  }
  return element.localName;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const action = String(o.action ?? 'clean');
  const externalRefs = String(o.externalRefs ?? 'strip');
  const stripComments = o.stripComments !== false;

  const source = input.files[0];
  let text: string;
  let sourceName = 'image.svg';
  if (source !== undefined) {
    if (source.size === 0) throw new ToolError('That file is empty.');
    if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 10 MB.');
    text = await source.text();
    if (source.name !== '') sourceName = source.name;
  } else {
    text = String(input.text ?? '');
  }
  if (text.trim() === '') throw new ToolError('No SVG was provided.', 'Paste SVG markup, or drop an .svg file.');
  if (text.length > MAX_BYTES) throw new ToolError('That is more than 10 MB of SVG.');

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch {
    throw new ToolError('That is not well-formed XML.', 'Check for unclosed tags or stray ampersands.');
  }
  const root = doc.documentElement;
  if (root === null || root.localName === 'parsererror' || doc.querySelector('parsererror') !== null) {
    throw new ToolError(
      'That is not well-formed SVG.',
      'The markup could not be parsed as XML; check for unclosed tags or a missing </svg>.',
    );
  }
  if (root.localName.toLowerCase() !== 'svg') {
    throw new ToolError(
      'The root element is <' + root.localName + '>, not <svg>.',
      'Paste a single SVG document.',
    );
  }

  const changes: Change[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  if (doc.doctype !== null) {
    changes.push({
      action: 'Removed DOCTYPE',
      target: doc.doctype.name,
      detail: 'A document type declaration can define entities and is not needed by renderers.',
    });
    doc.doctype.remove();
  }

  const nodes = allNodes(doc);

  for (const node of nodes) {
    if (node.nodeType === 7 && isAttached(node, doc)) {
      changes.push({
        action: 'Removed processing instruction',
        target: node.nodeName,
        detail: 'Instructions such as xml-stylesheet can pull in an external resource.',
      });
      node.parentNode?.removeChild(node);
    }
  }

  if (stripComments) {
    for (const node of nodes) {
      if (node.nodeType === 8 && isAttached(node, doc)) {
        const preview = (node.nodeValue ?? '').trim().slice(0, 60);
        changes.push({
          action: 'Removed comment',
          target: preview === '' ? '(empty comment)' : preview,
          detail: 'Comments are not rendered and can hide payloads.',
        });
        node.parentNode?.removeChild(node);
      }
    }
  }

  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    if (!isAttached(element, doc)) continue;
    const name = element.localName.toLowerCase();

    if (DROP_ELEMENTS.has(name)) {
      changes.push({ action: 'Removed element', target: describe(element), detail: reasonFor(name) });
      element.remove();
      continue;
    }

    if (name === 'set' || name === 'animate') {
      const attributeName = (element.getAttribute('attributeName') ?? '').trim().toLowerCase();
      const value = compact(element.getAttribute('to') ?? element.getAttribute('values') ?? '');
      if ((attributeName === 'href' || attributeName === 'xlink:href') && value.startsWith('javascript:')) {
        changes.push({
          action: 'Removed element',
          target: describe(element),
          detail: 'It animates an href to a javascript: URL.',
        });
        element.remove();
        continue;
      }
    }

    if (name === 'style') {
      const css = element.textContent ?? '';
      if (/@import/iu.test(css) || unsafeCss(css)) {
        changes.push({
          action: 'Removed element',
          target: describe(element),
          detail: 'The stylesheet imports an external resource or contains scriptable CSS.',
        });
        element.remove();
        continue;
      }
    }

    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase();
      const local = (attribute.localName ?? attributeName).toLowerCase();

      if (attributeName.startsWith('on')) {
        changes.push({
          action: 'Removed attribute',
          target: describe(element) + ' ' + attribute.name,
          detail: 'Event handler attributes run script.',
        });
        element.removeAttributeNode(attribute);
        continue;
      }

      if (local === 'href' || local === 'src') {
        const value = compact(attribute.value);
        if (value.startsWith('javascript:') || value.startsWith('vbscript:')) {
          changes.push({
            action: 'Removed attribute',
            target: describe(element) + ' ' + attribute.name,
            detail: 'It points at a javascript: URL.',
          });
          element.removeAttributeNode(attribute);
          continue;
        }
        const fragment = value.startsWith('#');
        const safeData = /^data:image\/(?:png|jpe?g|gif|webp|avif)[;,]/.test(value);
        if (externalRefs === 'strip' && !fragment && !safeData) {
          changes.push({
            action: 'Removed attribute',
            target: describe(element) + ' ' + attribute.name,
            detail: 'It references a resource outside the document.',
          });
          element.removeAttributeNode(attribute);
          continue;
        }
      }

      if (local === 'style' && unsafeCss(attribute.value)) {
        changes.push({
          action: 'Removed attribute',
          target: describe(element) + ' style',
          detail: 'The inline style contains scriptable CSS.',
        });
        element.removeAttributeNode(attribute);
      }
    }
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  const cleaned = '<?xml version="1.0" encoding="UTF-8"?>\n' + serialized.trim();

  if (root.namespaceURI !== SVG_NS) {
    warnings.push(
      'The root <svg> element is not in the SVG namespace (' + SVG_NS + '), so some renderers may reject it.',
    );
  }

  const removedElements = changes.filter((change) => change.action === 'Removed element').length;
  const removedAttributes = changes.filter((change) => change.action === 'Removed attribute').length;
  const otherRemovals = changes.length - removedElements - removedAttributes;
  const active = removedElements + removedAttributes;

  notes.push(
    'Sanitizing is a hardening filter, not a sandbox: keep treating output from untrusted sources as untrusted.',
  );
  if (externalRefs === 'keep') {
    notes.push('References outside the document were kept, so opening this file may still make network requests.');
  }
  if (changes.length === 0) {
    notes.push('No risky constructs were found; the artwork was left as it was.');
  }
  if (active > 0) warnings.push(active + ' active construct(s) were removed.');

  const outputs: OutputFile[] = [];
  if (action === 'clean') {
    const base = sourceName.replace(/\.svg$/iu, '');
    const filename = (base === '' ? 'image' : base) + '.sanitized.svg';
    const output: OutputFile = { filename, blob: new Blob([cleaned], { type: 'image/svg+xml' }) };
    if (cleaned.length <= PREVIEW_LIMIT) {
      output.previewUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cleaned);
    }
    outputs.push(output);
  } else {
    notes.push('Audit only: no file was produced.');
  }

  const rows =
    changes.length === 0
      ? [['none', '-', 'No risky constructs were found.']]
      : changes.map((change) => [change.action, change.target, change.detail]);

  return {
    outputs,
    report: {
      output: JSON.stringify({ headers: ['Action', 'Target', 'Detail'], rows }),
      render: 'table',
    },
    notes,
    warnings,
    stats: {
      removedElements,
      removedAttributes,
      otherRemovals,
      bytesBefore: text.length,
      bytesAfter: cleaned.length,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
