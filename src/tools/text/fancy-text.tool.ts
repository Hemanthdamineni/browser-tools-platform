import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './fancy-text.meta';

type Style =
  | 'bold'
  | 'italic'
  | 'bold-italic'
  | 'script'
  | 'bold-script'
  | 'fraktur'
  | 'bold-fraktur'
  | 'double-struck'
  | 'monospace'
  | 'sans-serif'
  | 'sans-serif-bold'
  | 'sans-serif-italic'
  | 'sans-serif-bold-italic'
  | 'circled'
  | 'circled-negative'
  | 'parenthesized'
  | 'squared'
  | 'fullwidth';

const STYLE_BASES: Record<Style, { upper: number; lower: number; digit?: number }> = {
  bold: { upper: 0x1d400, lower: 0x1d41a },
  italic: { upper: 0x1d434, lower: 0x1d44e },
  'bold-italic': { upper: 0x1d468, lower: 0x1d482 },
  script: { upper: 0x1d49c, lower: 0x1d4b6 },
  'bold-script': { upper: 0x1d4d0, lower: 0x1d4ea },
  fraktur: { upper: 0x1d504, lower: 0x1d51e },
  'bold-fraktur': { upper: 0x1d56c, lower: 0x1d586 },
  'double-struck': { upper: 0x1d538, lower: 0x1d552, digit: 0x1d7e2 },
  monospace: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
  'sans-serif': { upper: 0x1d5a0, lower: 0x1d5ba, digit: 0x1d7e2 },
  'sans-serif-bold': { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  'sans-serif-italic': { upper: 0x1d608, lower: 0x1d622, digit: 0x1d7ec },
  'sans-serif-bold-italic': { upper: 0x1d63c, lower: 0x1d656, digit: 0x1d7ec },
  circled: { upper: 0x24b6, lower: 0x24d0, digit: 0x2460 },
  'circled-negative': { upper: 0x1f150, lower: 0x1f150 + 26, digit: 0x24ea },
  parenthesized: { upper: 0x249c, lower: 0x249c, digit: 0x249c }, // Limited: only upper A-Z
  squared: { upper: 0x1f130, lower: 0x1f130, digit: 0x1f130 }, // Only upper A-Z
  fullwidth: { upper: 0xff21, lower: 0xff41, digit: 0xff10 },
};

function buildMap(style: Style): Map<number, number> {
  const map = new Map<number, number>();
  const bases = STYLE_BASES[style];

  // Uppercase A-Z
  for (let i = 0; i < 26; i++) {
    const from = 0x41 + i; // 'A'
    const to = bases.upper + i;
    map.set(from, to);
  }

  // Lowercase a-z (if different from upper)
  if (bases.lower !== bases.upper) {
    for (let i = 0; i < 26; i++) {
      const from = 0x61 + i; // 'a'
      const to = bases.lower + i;
      map.set(from, to);
    }
  }

  // Digits 0-9 (if supported)
  if (bases.digit !== undefined) {
    for (let i = 0; i < 10; i++) {
      const from = 0x30 + i; // '0'
      let to: number;
      if (style === 'circled') {
        // Circled digits: 1-9 at 0x2460-0x2468, 0 at 0x24EA
        to = i === 0 ? 0x24ea : bases.digit + i - 1;
      } else {
        to = bases.digit + i;
      }
      map.set(from, to);
    }
  }

  // Fullwidth also covers punctuation and space
  if (style === 'fullwidth') {
    for (let i = 0x21; i <= 0x7e; i++) {
      if (!map.has(i)) map.set(i, i + 0xfee0);
    }
    map.set(0x20, 0x3000); // space -> ideographic space
  }

  return map;
}

function invert(map: Map<number, number>): Map<number, number> {
  const reverse = new Map<number, number>();
  for (const [from, to] of map) reverse.set(to, from);
  return reverse;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const style = String(options.style) as Style;
  const text = input.text;

  if (!text) return { output: '' };

  const map = buildMap(style);

  let output = '';
  let changed = 0;
  for (const ch of text) {
    const target = map.get(ch.codePointAt(0)!);
    if (target !== undefined) {
      output += String.fromCodePoint(target);
      changed += 1;
    } else {
      output += ch;
    }
  }

  return {
    output,
    render: 'code',
    stats: { 'characters changed': changed, 'characters total': [...text].length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;