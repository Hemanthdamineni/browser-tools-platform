import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './markdown-to-html.meta';
import { marked } from 'marked';

const MAX_INPUT = 500_000;

function slugify(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** marked (v14) emits bare `<h1>…</h6>` with no attributes; add slugged ids. */
function addHeaderIds(html: string): string {
  const seen = new Map<string, number>();
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
    let id = slugify(inner);
    if (!id) return `<h${level}>${inner}</h${level}>`;
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  if (input.text.length > MAX_INPUT) {
    throw new ToolError(
      'Markdown input is too large.',
      `Keep it under ${MAX_INPUT.toLocaleString('en-US')} characters.`,
    );
  }

  const gfm = Boolean(o.gfm);
  const breaks = Boolean(o.breaks);
  const headerIds = Boolean(o.headerIds);

  marked.setOptions({ gfm, breaks });
  let html = marked.parse(input.text) as string;
  if (headerIds) html = addHeaderIds(html);

  const trimmed = html.replace(/\n+$/, '');

  return {
    output: trimmed,
    render: 'code',
    language: 'html',
    stats: {
      'input chars': input.text.length,
      'output chars': trimmed.length,
      gfm: gfm ? 'on' : 'off',
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
