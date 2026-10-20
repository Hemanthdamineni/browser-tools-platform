import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './unicode-lookup.meta';

const MAX_INPUT = 100_000;
const MAX_CHARS_LIMIT = 5_000;

const PLANES: Record<number, string> = {
  0: 'Basic Multilingual Plane (BMP)',
  1: 'Supplementary Multilingual Plane (SMP)',
  2: 'Supplementary Ideographic Plane (SIP)',
  3: 'Tertiary Ideographic Plane (TIP)',
  14: 'Supplementary Private Use Area-A',
  15: 'Supplementary Private Use Area-B',
};

function hex(value: number, width: number): string {
  return value.toString(16).toUpperCase().padStart(width, '0');
}

/** Visible stand-in for control characters, so a row is never blank. */
function display(char: string): string {
  const cp = char.codePointAt(0) ?? 0;
  if (cp === 0x20) return '␠';
  if (cp === 0x09) return '␉';
  if (cp === 0x0a) return '␊';
  if (cp === 0x0d) return '␍';
  if (cp < 0x20 || cp === 0x7f) return `␀${hex(cp, 2)}`;
  return char;
}

function planeOf(cp: number): string {
  if (cp >= 0xd800 && cp <= 0xdfff) return 'Lone surrogate';
  const plane = Math.floor(cp / 0x10000);
  return PLANES[plane] ?? `Plane ${plane} (unassigned)`;
}

function utf8Bytes(char: string): string {
  return Array.from(new TextEncoder().encode(char))
    .map((b) => hex(b, 2))
    .join(' ');
}

function utf16Bytes(char: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < char.length; i += 1) {
    const unit = char.charCodeAt(i);
    bytes.push(unit >> 8, unit & 0xff);
  }
  return bytes.map((b) => hex(b, 2)).join(' ');
}

function isNoncharacter(cp: number): boolean {
  return (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const format = o.format === 'lines' ? 'lines' : 'table';
  const maxChars = Math.max(1, Math.min(MAX_CHARS_LIMIT, Number(o.maxChars ?? 500)));

  const raw = String(input.text ?? '');
  if (raw === '') throw new ToolError('Paste some text to inspect.');
  if (raw.length > MAX_INPUT) {
    throw new ToolError('Input is too large.', 'Keep it under ' + MAX_INPUT + ' characters.');
  }

  const chars = Array.from(raw);
  const shown = chars.slice(0, maxChars);
  const truncated = chars.length - shown.length;

  const rows: string[][] = shown.map((char) => {
    const cp = char.codePointAt(0) ?? 0;
    const astral = cp > 0xffff;
    return [
      display(char),
      'U+' + hex(cp, astral ? 5 : 4),
      String(cp),
      planeOf(cp),
      utf8Bytes(char),
      utf16Bytes(char),
    ];
  });

  const notes: string[] = [];
  const warnings: string[] = [];
  if (truncated > 0) {
    notes.push('Showing the first ' + shown.length + ' of ' + chars.length + ' characters.');
  }
  if (shown.some((c) => (c.codePointAt(0) ?? 0) > 0xffff)) {
    notes.push('Astral characters use 4 UTF-8 bytes and a UTF-16 surrogate pair.');
  }
  if (shown.some((c) => isNoncharacter(c.codePointAt(0) ?? 0))) {
    warnings.push('The input contains Unicode noncharacters — they are not valid for interchange.');
  }

  if (format === 'table') {
    return {
      output: JSON.stringify({
        headers: ['Char', 'Code point', 'Decimal', 'Plane', 'UTF-8 bytes', 'UTF-16 bytes'],
        rows,
      }),
      render: 'table',
      notes,
      warnings,
      stats: { characters: chars.length, shown: shown.length, truncated },
    };
  }

  const output = rows
    .map((row) => `${row[1]}  ${row[3]}  utf8:${row[4]}  utf16:${row[5]}  ${row[0]}`)
    .join('\n');

  return {
    output,
    render: 'code',
    notes,
    warnings,
    stats: { characters: chars.length, shown: shown.length, truncated },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
