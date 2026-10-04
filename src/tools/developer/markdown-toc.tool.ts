import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { marked } from 'marked';
import { meta } from './markdown-toc.meta';

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

function plainHeadingText(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_~]/g, '')
    .replace(/\\(.)/g, '$1')
    .trim();
}

function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };
  if (input.text.length > MAX_INPUT) {
    throw new ToolError(
      'Markdown input is too large.',
      `Keep it under ${MAX_INPUT.toLocaleString('en-US')} characters.`,
    );
  }

  const headings = marked.lexer(input.text).filter((token) => token.type === 'heading');
  const seen = new Map<string, number>();
  const lines = headings.map((token) => {
    if (token.type !== 'heading') return '';
    const title = plainHeadingText(token.text);
    let slug = slugify(title);
    if (slug) {
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      if (count > 0) slug = `${slug}-${count}`;
    }
    const indent = '  '.repeat(token.depth - 1);
    const label = title.replace(/[\\[\\]]/g, '\\\\$&');
    return slug ? `${indent}- [${label}](#${slug})` : `${indent}- ${label}`;
  });
  const output = lines.join('\n');

  return {
    output,
    render: 'code',
    language: 'markdown',
    filename: 'table-of-contents.md',
    notes: headings.length ? undefined : ['No Markdown headings were found.'],
    stats: {
      headings: headings.length,
      'input chars': input.text.length,
      'output chars': output.length,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
