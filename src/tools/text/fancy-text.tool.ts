import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './fancy-text.meta';

type Style =
  | 'bold'
  | 'italic'
  | 'script'
  | 'fraktur'
  | 'double-struck'
  | 'monospace'
  | 'circled'
  | 'squared'
  | 'small-caps'
  | 'inverted'
  | 'fullwidth';

type Decoration = 'none' | 'underline' | 'overline' | 'strikethrough';

/** Combining marks appended to each character by the decoration option. */
const DECORATIONS: Record<Decoration, string> = {
  none: '',
  underline: '\u0332',
  overline: '\u0305',
  strikethrough: '\u0336',
};

/**
 * Build the code point map for a style. A–Z, a–z and 0–9 are mapped where the
 * style has a glyph; characters that are not in the map pass through unchanged.
 * Some mathematical families have holes (ℬ, ℭ, ℌ …) filled by the Letterlike
 * Symbols block, so those capitals are listed explicitly instead of a walk.
 */
function buildMap(style: Style): Map<number, number> {
  const map = new Map<number, number>();
  /** Map a contiguous ASCII run onto a contiguous target run. */
  const run = (from: number, to: number, count: number) => {
    for (let i = 0; i < count; i++) map.set(from + i, to + i);
  };
  /** Map A, B, C … onto an explicit list of targets. */
  const list = (targets: number[]) => {
    targets.forEach((target, i) => map.set(0x41 + i, target));
  };

  switch (style) {
    case 'bold':
      run(0x41, 0x1d400, 26); // 𝐀
      run(0x61, 0x1d41a, 26); // 𝐚
      run(0x30, 0x1d7ce, 10); // 𝟎
      break;
    case 'italic':
      run(0x41, 0x1d434, 26); // 𝐴
      run(0x61, 0x1d44e, 26); // 𝑎
      break;
    case 'script':
      list([
        0x1d49c, 0x212c, 0x1d49e, 0x1d49f, 0x2130, 0x2131, 0x1d4a2, 0x210b, 0x2110, 0x1d4a5,
        0x1d4a6, 0x2112, 0x2133, 0x1d4a9, 0x1d4aa, 0x1d4ab, 0x1d4ac, 0x211b, 0x1d4ae, 0x1d4af,
        0x1d4b0, 0x1d4b1, 0x1d4b2, 0x1d4b3, 0x1d4b4, 0x1d4b5,
      ]);
      run(0x61, 0x1d4b6, 26); // 𝒶
      break;
    case 'fraktur':
      list([
        0x1d504, 0x1d505, 0x212d, 0x1d507, 0x1d508, 0x1d509, 0x1d50a, 0x210c, 0x2111, 0x1d50d,
        0x1d50e, 0x1d50f, 0x1d510, 0x1d511, 0x1d512, 0x1d513, 0x1d514, 0x211c, 0x1d516, 0x1d517,
        0x1d518, 0x1d519, 0x1d51a, 0x1d51b, 0x1d51c, 0x2128,
      ]);
      run(0x61, 0x1d51e, 26); // 𝔞
      break;
    case 'double-struck':
      list([
        0x1d538, 0x1d539, 0x2102, 0x1d53b, 0x1d53c, 0x1d53d, 0x1d53e, 0x210d, 0x1d540, 0x1d541,
        0x1d542, 0x1d543, 0x1d544, 0x2115, 0x1d546, 0x2119, 0x211a, 0x211d, 0x1d54a, 0x1d54b,
        0x1d54c, 0x1d54d, 0x1d54e, 0x1d54f, 0x1d550, 0x2124,
      ]);
      run(0x61, 0x1d552, 26); // 𝕒
      run(0x30, 0x1d7d8, 10); // 𝟘
      break;
    case 'monospace':
      run(0x41, 0x1d670, 26); // 𝙰
      run(0x61, 0x1d68a, 26); // 𝚊
      run(0x30, 0x1d7f6, 10); // 𝟶
      break;
    case 'circled':
      run(0x41, 0x24b6, 26); // Ⓐ
      run(0x61, 0x24d0, 26); // ⓐ
      for (let i = 1; i <= 9; i++) map.set(0x30 + i, 0x2460 + i - 1); // ①–⑨
      map.set(0x30, 0x24ea); // ⓪
      break;
    case 'squared':
      run(0x41, 0x1f130, 26); // 🄰 (uppercase only)
      break;
    case 'small-caps':
      list([
        0x1d00, 0x0299, 0x1d04, 0x1d05, 0x1d07, 0xa730, 0x0262, 0x029c, 0x026a, 0x1d0a, 0x1d0b,
        0x029f, 0x1d0d, 0x0274, 0x1d0f, 0x1d18, 0xa7af, 0x0280, 0xa731, 0x1d1b, 0x1d1c, 0x1d20,
        0x1d21, 0x02e3, 0x028f, 0x1d22,
      ]);
      break;
    case 'inverted':
      run(0x41, 0x1f170, 26); // 🅰 (uppercase only)
      break;
    case 'fullwidth':
      run(0x41, 0xff21, 26); // Ａ
      run(0x61, 0xff41, 26); // ａ
      run(0x30, 0xff10, 10); // ０
      break;
  }
  return map;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const map = buildMap(String(o.style) as Style);
  const decoration = DECORATIONS[String(o.decorations) as Decoration] ?? DECORATIONS.none;

  let output = '';
  let styled = 0;
  for (const ch of input.text) {
    const target = map.get(ch.codePointAt(0) ?? 0);
    const glyph = target === undefined ? ch : String.fromCodePoint(target);
    if (target !== undefined) styled += 1;
    output += decoration ? glyph + decoration : glyph;
  }

  return {
    output,
    render: 'text',
    stats: { 'styled characters': styled, 'characters total': [...input.text].length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
