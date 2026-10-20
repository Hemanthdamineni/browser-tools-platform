import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './markdown-toc.meta';

interface Heading {
  level: number;
  text: string;
  anchor: string;
}

const ATX = /^(#{1,6})\s+(.+)$/;
const CUSTOM_ANCHOR = /\s+\{#([^}]*)\}\s*$/;

function gitHubSlug(text: string): string {
  const custom = text.match(CUSTOM_ANCHOR);
  if (custom) return custom[1]!.replace(/[^\w-]/g, '').toLowerCase() || 'section';
  return text
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function headingText(text: string): string {
  return text.replace(CUSTOM_ANCHOR, '').trim();
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const maxDepth = Math.max(1, Math.min(6, Math.trunc(Number(o.depth) || 6)));
  const format = String(o.format) as 'github' | 'plain' | 'html';

  const text = input.text ?? '';
  if (!text.trim()) {
    throw new ToolError(
      'Paste a Markdown document with headings.',
      'ATX headings use 1-6 # characters before the title.',
    );
  }

  const headings: Heading[] = [];
  let inFence = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trimStart();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = trimmed.match(ATX);
    if (!m) continue;
    const level = m[1]!.length;
    if (level > maxDepth) continue;
    const title = m[2]!.trim();
    if (!title) continue;
    headings.push({ level, text: headingText(title), anchor: gitHubSlug(title) });
  }
  if (headings.length === 0) {
    throw new ToolError(
      'No headings found in the document.',
      'Headings are lines starting with # (h1) through ###### (h6) followed by the title.',
    );
  }

  let output = '';
  if (format === 'plain') {
    output = headings.map((h) => '  '.repeat(h.level - 1) + h.text).join('\n') + '\n';
  } else if (format === 'html') {
    const lines: string[] = ['<ul>'];
    let lastLevel = 0;
    for (const h of headings) {
      const delta = h.level - lastLevel;
      if (delta > 0) for (let i = 0; i < delta; i++) lines.push('<ul>');
      if (delta < 0) for (let i = 0; i < -delta; i++) lines.push('</ul>');
      lines.push(
        `  <li><a href="#${h.anchor}">${h.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a></li>`,
      );
      lastLevel = h.level;
    }
    for (let i = 0; i < lastLevel; i++) lines.push('</ul>');
    output = lines.join('\n') + '\n';
  } else {
    output =
      headings.map((h) => '  '.repeat(h.level - 1) + `- [${h.text}](#${h.anchor})`).join('\n') +
      '\n';
  }

  const maxLevel = Math.max(...headings.map((h) => h.level));
  return {
    output,
    render: 'code',
    stats: { headings: headings.length, maxLevel },
    notes: [
      `${headings.length} heading${headings.length === 1 ? '' : 's'} collected (max depth ${maxDepth}).`,
      format === 'plain'
        ? 'Plain indented list.'
        : format === 'html'
          ? 'Nested HTML list with GitHub-compatible anchors.'
          : 'GitHub-style links; anchors follow the GitHub slug rule.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
