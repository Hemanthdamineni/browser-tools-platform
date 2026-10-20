import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-validator.meta';

const MAX_LEN = 500_000;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);

interface Entry {
  tag: string;
  line: number;
}

function lineAt(html: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset && i < html.length; i++) if (html.charCodeAt(i) === 10) n += 1;
  return n;
}

function validate(html: string, ignoreComments: boolean): { rows: string[][]; tags: number } {
  const rows: string[][] = [];
  const stack: Entry[] = [];
  let i = 0;
  let tags = 0;
  const len = html.length;

  while (i < len) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;

    // Comment
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end === -1) {
        if (!ignoreComments) rows.push([String(lineAt(html, lt)), 'Unclosed comment: <!--']);
      }
      i = end === -1 ? len : end + 3;
      continue;
    }

    // Doctype, CDATA or declaration
    if (html.startsWith('<!', lt)) {
      const gt = html.indexOf('>', lt);
      i = gt === -1 ? len : gt + 1;
      continue;
    }

    // Closing tag
    if (html.startsWith('</', lt)) {
      const gt = html.indexOf('>', lt);
      const inside = gt === -1 ? html.slice(lt + 2) : html.slice(lt + 2, gt);
      const name = (/^\s*([A-Za-z][A-Za-z0-9-]*)/.exec(inside)?.[1] ?? '').toLowerCase();
      i = gt === -1 ? len : gt + 1;
      if (!name) {
        rows.push([String(lineAt(html, lt)), 'Invalid closing tag: </' + inside.trim() + '>']);
        continue;
      }
      tags += 1;
      if (stack.length === 0) {
        rows.push([String(lineAt(html, lt)), 'Unexpected closing tag </' + name + '>']);
        continue;
      }
      const top = stack[stack.length - 1]!;
      if (top.tag === name) {
        stack.pop();
        continue;
      }
      const idx = stack.findIndex((e) => e.tag === name);
      if (idx === -1) {
        rows.push([String(lineAt(html, lt)), 'Closing tag </' + name + '> has no matching opener']);
        continue;
      }
      for (let k = stack.length - 1; k > idx; k--) {
        const unclosed = stack[k]!;
        rows.push([String(unclosed.line), 'Unclosed <' + unclosed.tag + '> before </' + name + '>']);
      }
      stack.splice(idx);
      continue;
    }

    // General: tag or stray '<'
    const gt = html.indexOf('>', lt);
    const raw = gt === -1 ? html.slice(lt + 1) : html.slice(lt + 1, gt);
    const m = /^([A-Za-z][A-Za-z0-9-]*)/.exec(raw);
    if (!m) {
      rows.push([String(lineAt(html, lt)), 'Stray <' + raw.slice(0, 20) + '']);
      i = gt === -1 ? len : gt + 1;
      continue;
    }
    const name = m[1]!.toLowerCase();
    // `raw` is the text between '<' and '>', so a self-closing tag ends with '/'.
    const selfClosing = /\/$/.test(raw.trim());
    tags += 1;
    if (RAW.has(name) && !selfClosing) {
      // Skip raw text until a matching closing tag.
      const closeRe = new RegExp('</\\s*' + name + '\\s*>', 'i');
      const rest = html.slice(gt + 1);
      const cm = closeRe.exec(rest);
      if (!cm) rows.push([String(lineAt(html, lt)), 'Unclosed raw-text element <' + name + '>']);
      i = cm ? gt + 1 + cm.index + cm[0].length : len;
      continue;
    }
    if (!selfClosing && !VOID.has(name)) {
      stack.push({ tag: name, line: lineAt(html, lt) });
    }
    i = gt === -1 ? len : gt + 1;
  }

  for (const e of stack) rows.push([String(e.line), 'Unclosed <' + e.tag + '>']);
  return { rows, tags };
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const ignoreComments = o.ignoreComments === true;
  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste some HTML to validate.');
  if (source.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under 500,000 characters.');

  const { rows, tags } = validate(source, ignoreComments);
  const unique = [...new Map(rows.map((r) => [r[0] + ':' + r[1], r])).values()];
  const sorted = unique.sort((a, b) => Number(a[0]) - Number(b[0]));
  const errors = sorted.length;

  return {
    output: JSON.stringify({ headers: ['Line', 'Issue'], rows: errors ? sorted : [['—', 'All tags are balanced.']] }),
    render: 'table',
    stats: { tags, errors },
    notes: errors
      ? ['Found ' + errors + ' structural issue(s) in the markup.']
      : ['No structural issues found — every tag is matched and balanced.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
