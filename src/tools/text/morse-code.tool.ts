import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './morse-code.meta';

const MORSE: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.',
};

const FROM_MORSE: Record<string, string> = (() => {
  const rev: Record<string, string> = {};
  for (const key of Object.keys(MORSE)) {
    const code = MORSE[key]!;
    rev[code] = key;
  }
  return rev;
})();

function encode(text: string): TextRunResult {
  const unknown = new Set<string>();
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const output = words
    .map((word) =>
      Array.from(word)
        .map((ch) => {
          const code = MORSE[ch];
          if (code) return code;
          unknown.add(ch);
          return '?';
        })
        .join(' '),
    )
    .join(' / ');

  const warnings =
    unknown.size > 0
      ? [`Unsupported characters replaced with "?": ${[...unknown].join(' ')}`]
      : undefined;

  return {
    output,
    render: 'code',
    stats: { words: words.length },
    warnings,
  };
}

function decode(text: string): TextRunResult {
  const normalized = text
    .replace(/\r\n?|\n|\t/g, ' ')
    .trim()
    .replace(/\s*[/|]\s*/g, ' / ');
  if (!normalized) return { output: '' };

  // Words are separated only by an explicit "/" (or "|"); every other run of
  // whitespace just separates letters, so extra spaces are tolerated.
  const words = normalized.split(' / ');
  const decoded = words
    .map((word) => {
      const letters = word.trim().split(/\s+/).filter(Boolean);
      return letters
        .map((group) => {
          const ch = FROM_MORSE[group];
          if (!ch) {
            throw new ToolError(
              `"${group}" is not a valid Morse letter.`,
              'Use only dots and dashes, a space between letters and "/" between words.',
            );
          }
          return ch;
        })
        .join('');
    })
    .filter((word) => word.length > 0)
    .join(' ');

  return { output: decoded, stats: { characters: decoded.length } };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  return o.mode === 'morse-to-text' ? decode(input.text) : encode(input.text);
}

const tool: TextToolModule = { meta, run };
export default tool;
