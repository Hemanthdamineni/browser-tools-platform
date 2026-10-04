import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './unicode-styles.meta';

type Style = 'fullwidth' | 'circled' | 'squared' | 'monospace';

/** Build a code point map for the given style. Missing entries stay undefined. */
function buildMap(style: Style): Map<number, number> {
  const map = new Map<number, number>();
  if (style === 'fullwidth') {
    for (let i = 0x21; i <= 0x7e; i++) map.set(i, i + 0xfee0);
    map.set(0x20, 0x3000);
    return map;
  }
  // Circled / squared / monospace all cover A–Z, a–z and 0–9.
  let base: number;
  if (style === 'circled') {
    for (let i = 0; i < 26; i++) map.set(0x41 + i, 0x24b6 + i); // A-Z
    for (let i = 0; i < 26; i++) map.set(0x61 + i, 0x24d0 + i); // a-z
    for (let i = 1; i <= 9; i++) map.set(0x30 + i, 0x2460 + i - 1); // 1-9 -> ①-⑨
    map.set(0x30, 0x24ea); // 0 -> ⓪
  } else if (style === 'squared') {
    for (let i = 0; i < 26; i++) map.set(0x41 + i, 0x1f130 + i); // A-Z
  } else {
    base = 0x1d5a0; // mathematical sans-serif bold capital A
    for (let i = 0; i < 26; i++) map.set(0x41 + i, base + i);
    base = 0x1d5ba; // mathematical sans-serif bold small a
    for (let i = 0; i < 26; i++) map.set(0x61 + i, base + i);
    base = 0x1d7e2; // mathematical sans-serif bold digit 0
    for (let i = 0; i < 10; i++) map.set(0x30 + i, base + i);
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
  if (!input.text) return { output: '' };

  const style = String(options.style) as Style;
  const encode = options.conversion !== 'decode';
  const map = buildMap(style);
  const lookup = encode ? map : invert(map);

  let output = '';
  let changed = 0;
  for (const ch of input.text) {
    const target = lookup.get(ch.codePointAt(0)!);
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
    stats: { 'characters changed': changed, 'characters total': [...input.text].length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
