import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './lorem-ipsum.meta';

const WORDS =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum sed perspiciatis unde omnis iste natus error voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis quasi architecto beatae vitae dicta explicabo nemo ipsam voluptatem quia voluptas aspernatur aut odit fugit consequuntur magni dolores eos ratione sequi nesciunt neque porro quisquam dolorem adipisci numquam eius modi tempora incidunt magnam quaerat etiam'.split(
    ' ',
  );

function randInt(maxExclusive: number): number {
  const buf = new Uint8Array(2);
  const limit = 65536 - (65536 % maxExclusive);
  let v: number;
  do {
    crypto.getRandomValues(buf);
    v = buf[0]! * 256 + buf[1]!;
  } while (v >= limit);
  return v % maxExclusive;
}

function sentence(first: boolean): string {
  let words: string[];
  if (first) {
    const opening = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit'];
    words = [...opening];
    while (words.length < 8 + randInt(8)) words.push(WORDS[randInt(WORDS.length)]!);
  } else {
    words = Array.from({ length: 8 + randInt(8) }, () => WORDS[randInt(WORDS.length)]!);
  }
  const s = words.join(' ');
  return s[0]!.toUpperCase() + s.slice(1) + '.';
}

function paragraph(first: boolean): string {
  const n = 3 + randInt(4);
  return Array.from({ length: n }, (_, i) => sentence(first && i === 0)).join(' ');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const unit = String(o.unit ?? 'paragraphs');
  const count = Math.max(1, Math.floor(Number(o.count ?? 3)));
  const start = Boolean(o.startWithLorem);
  const format = String(o.format ?? 'plain');

  let parts: string[];
  if (unit === 'words') {
    const words: string[] = [];
    if (start)
      words.push(...['lorem', 'ipsum', 'dolor', 'sit', 'amet'].slice(0, Math.min(5, count)));
    while (words.length < count) words.push(WORDS[randInt(WORDS.length)]!);
    parts = [words.slice(0, count).join(' ')];
  } else if (unit === 'sentences') {
    parts = Array.from({ length: count }, (_, i) => sentence(start && i === 0));
  } else if (unit === 'list-items') {
    parts = Array.from({ length: count }, (_, i) => sentence(start && i === 0));
  } else {
    parts = Array.from({ length: count }, (_, i) => paragraph(start && i === 0));
  }

  let output: string;
  let render: TextRunResult['render'] = 'text';
  if (format === 'html') {
    render = 'code';
    output =
      unit === 'list-items'
        ? `<ul>\n${parts.map((p) => `  <li>${p}</li>`).join('\n')}\n</ul>`
        : parts.map((p) => `<p>${p}</p>`).join('\n');
  } else if (format === 'markdown') {
    render = 'code';
    output = unit === 'list-items' ? parts.map((p) => `- ${p}`).join('\n') : parts.join('\n\n');
  } else {
    output = unit === 'list-items' ? parts.join('\n') : parts.join('\n\n');
  }

  return {
    output,
    render,
    language: render === 'code' ? format : undefined,
    stats: { unit, count },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
