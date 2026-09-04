import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './wrap-text.meta';

/** Splits text into [para, gap, para, gap, ...]; odd indices are blank-line runs. */
const PARA_SPLIT = /(\n[ \t]*\n(?:[ \t]*\n)*)/;

function wrapParagraph(para: string, width: number, breakLongWords: boolean): string {
  const words = para.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';

  for (const raw of words) {
    let word = raw;
    if (breakLongWords && word.length > width) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      while (word.length > width) {
        lines.push(word.slice(0, width));
        word = word.slice(width);
      }
      cur = word;
      continue;
    }
    if (!cur) {
      cur = word;
    } else if (cur.length + 1 + word.length <= width) {
      cur += ` ${word}`;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.join('\n');
}

function wrap(
  text: string,
  width: number,
  breakLongWords: boolean,
  preserveParagraphs: boolean,
): string {
  if (!preserveParagraphs) {
    return wrapParagraph(text, width, breakLongWords);
  }
  const parts = text.split(PARA_SPLIT);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (i % 2 === 1) {
      out += part;
    } else {
      const collapsed = part.replace(/\s+/g, ' ').trim();
      out += collapsed ? wrapParagraph(collapsed, width, breakLongWords) : part;
    }
  }
  return out;
}

function unwrap(text: string, preserveParagraphs: boolean): string {
  if (!preserveParagraphs) {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ');
  }
  const parts = text.split(PARA_SPLIT);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (i % 2 === 1) {
      out += part;
    } else {
      out += part
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ');
    }
  }
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const mode = String(o.mode);
  const preserveParagraphs = Boolean(o.preserveParagraphs);

  if (mode === 'unwrap') {
    const output = unwrap(input.text, preserveParagraphs);
    return { output, stats: { lines: output.split('\n').length } };
  }

  const width = Math.floor(Number(o.width));
  if (!Number.isFinite(width) || width < 1) {
    throw new ToolError('Wrap width must be a positive number.', 'Use a width of at least 20.');
  }

  const output = wrap(input.text, width, Boolean(o.breakLongWords), preserveParagraphs);
  return {
    output,
    stats: {
      lines: output.split('\n').length,
      'longest line': output.split('\n').reduce((m, l) => Math.max(m, l.length), 0),
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
