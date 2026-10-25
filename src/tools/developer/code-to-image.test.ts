import { describe, expect, it } from 'vitest';
import {
  CHROME_HEIGHT,
  MONO_ADVANCE,
  buildSvg,
  layout,
  layoutOptionsOf,
  lineToSpans,
  measureText,
  resolveBackground,
  resolveSettings,
  readableColorFor,
  imageColorsFor,
  wrapSpanLine,
  type LayoutOptions,
  type TokenLineLike,
} from '@/components/panels/code-to-image-panel';
import {
  guessLanguage,
  renderFromHighlight,
  type HighlightResult,
} from '../../tools/developer/code-to-image.tool';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const baseOpts: LayoutOptions = {
  codeWidth: 300,
  lineHeight: 24,
  fontSize: 14,
  padding: 16,
  chrome: false,
};

/** A token line from a single, uncoloured run of text. */
const one = (text: string, color = '', fontStyle = 0): TokenLineLike => [
  { content: text, color, fontStyle },
];

/** The fake token stream a test injects instead of a real Shiki highlight. */
const fakeHighlight = (lines: TokenLineLike[], fg = '#c9d1d9', bg = '#0d1117'): HighlightResult => ({
  tokens: lines,
  fg,
  bg,
  lang: 'typescript',
});

/* -------------------------------------------------------------------------- */
/*  Measurement                                                                */
/* -------------------------------------------------------------------------- */

describe('measureText', () => {
  it('gives every glyph the same monospace advance (0.6 × font size)', () => {
    // measureText accumulates glyph-by-glyph, so the result can differ from
    // the single-expression product by one rounding ulp — compare with a
    // tolerance instead of exact float equality.
    expect(measureText('abc', 14)).toBeCloseTo(3 * MONO_ADVANCE * 14, 10);
    expect(measureText('a', 20)).toBe(MONO_ADVANCE * 20);
    expect(measureText('', 14)).toBe(0);
  });

  it('counts a tab as two glyphs', () => {
    expect(measureText('\t', 14)).toBe(2 * MONO_ADVANCE * 14);
    expect(measureText('a\tb', 14)).toBe(4 * MONO_ADVANCE * 14);
  });

  it('measures by code point, not UTF-16 unit', () => {
    // '😀' is one code point in two UTF-16 units — still one glyph wide.
    expect(measureText('😀', 14)).toBe(MONO_ADVANCE * 14);
  });
});

/* -------------------------------------------------------------------------- */
/*  lineToSpans                                                                */
/* -------------------------------------------------------------------------- */

describe('lineToSpans', () => {
  it('flattens tokens into spans, keeping colour and font style', () => {
    expect(
      lineToSpans([
        { content: 'const ', color: '#ff7b72', fontStyle: 0 },
        { content: 'x', color: '#79c0ff', fontStyle: 1 },
      ]),
    ).toEqual([
      { text: 'const ', color: '#ff7b72', fontStyle: 0 },
      { text: 'x', color: '#79c0ff', fontStyle: 1 },
    ]);
  });

  it('drops empty tokens and defaults missing colour/style', () => {
    expect(
      lineToSpans([{ content: '' }, { content: 'y' }, { content: '' }]),
    ).toEqual([{ text: 'y', color: '', fontStyle: 0 }]);
  });
});

/* -------------------------------------------------------------------------- */
/*  wrapSpanLine                                                               */
/* -------------------------------------------------------------------------- */

describe('wrapSpanLine', () => {
  it('keeps a short line on one visual line', () => {
    const spans = lineToSpans(one('short'));
    expect(wrapSpanLine(spans, 300, 14)).toEqual([{ spans }]);
  });

  it('wraps a long line at the code width, splitting the token', () => {
    // 'abcdefghijkl' at fontSize 14: each char is 8.4px. codeWidth 42 is
    // exactly 5 glyphs, so the line flushes there and wrapping kicks in.
    const spans = lineToSpans(one('abcdefghijkl', '#ff0000'));
    const lines = wrapSpanLine(spans, 42, 14);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.spans.map((s) => s.text).join(''))).toEqual([
      'abcde',
      'fghij',
      'kl',
    ]);
    // The split pieces keep the token's colour.
    for (const line of lines) {
      expect(line.spans[0]).toMatchObject({ color: '#ff0000' });
    }
  });

  it('does not split a token mid-line when later tokens fit', () => {
    const spans = lineToSpans([
      { content: 'ab', color: '#111111' },
      { content: 'cd', color: '#222222' },
    ]);
    const lines = wrapSpanLine(spans, 40, 14);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.spans).toEqual([
      { text: 'ab', color: '#111111', fontStyle: 0 },
      { text: 'cd', color: '#222222', fontStyle: 0 },
    ]);
  });

  it('emits one empty visual line for an empty logical line', () => {
    expect(wrapSpanLine([], 300, 14)).toEqual([{ spans: [] }]);
  });

  it('gives an over-wide single glyph its own line rather than dropping it', () => {
    const lines = wrapSpanLine(lineToSpans(one('W')), 5, 14);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.spans[0]!.text).toBe('W');
  });
});

/* -------------------------------------------------------------------------- */
/*  layout                                                                     */
/* -------------------------------------------------------------------------- */

describe('layout', () => {
  it('computes geometry for a snippet that fits', () => {
    const result = layout([one('const a = 1;'), one('const b = 2;')], baseOpts);
    expect(result.lineCount).toBe(2);
    expect(result.codeHeight).toBe(2 * 24);
    expect(result.imageWidth).toBe(300 + 2 * 16);
    expect(result.contentTop).toBe(0);
    expect(result.imageHeight).toBe(0 + 16 + 48 + 16);
  });

  it('adds chrome height to the top when chrome is on', () => {
    const result = layout([one('hi')], { ...baseOpts, chrome: true });
    expect(result.contentTop).toBe(CHROME_HEIGHT);
    expect(result.imageHeight).toBe(CHROME_HEIGHT + 16 + 24 + 16);
  });

  it('counts wrapped lines, not logical lines, in the height', () => {
    // 60 chars × 8.4px = 504px. The default tool width (680) fits it on one
    // line only up to 80 glyphs; here use a width that wraps at exact
    // multiples: 504px is 60 glyphs, so clamp to 240 (28 glyphs/line).
    const long = one('z'.repeat(60));
    const result = layout([long], { ...baseOpts, codeWidth: 240 });
    expect(result.lineCount).toBe(3); // 28 + 28 + 4 glyphs
    expect(result.codeHeight).toBe(72);
    expect(result.visualLines).toHaveLength(3);
  });

  it('preserves blank lines in the line count', () => {
    const result = layout([one('a'), one(''), one('b')], baseOpts);
    expect(result.lineCount).toBe(3);
    expect(result.visualLines[1]!.spans).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  resolveSettings                                                            */
/* -------------------------------------------------------------------------- */

describe('resolveSettings', () => {
  it('returns the declared defaults for an empty form', () => {
    expect(resolveSettings({})).toEqual({
      language: 'auto',
      theme: 'github-dark',
      chrome: true,
      title: '',
      padding: 16,
      lineHeight: 24,
      fontSize: 14,
      codeWidth: 680,
      background: 'theme',
      format: 'png',
    });
  });

  it('clamps numeric options into their ranges, rounding them', () => {
    const s = resolveSettings({ padding: 3, lineHeight: 999, fontSize: 13.6, width: 'x' });
    expect(s.padding).toBe(8);
    expect(s.lineHeight).toBe(48);
    expect(s.fontSize).toBe(14);
    expect(s.codeWidth).toBe(680); // unusable value → fallback
  });

  it('accepts the high end of every range', () => {
    const s = resolveSettings({ padding: 64, lineHeight: 48, fontSize: 24, width: 1400 });
    expect(s.padding).toBe(64);
    expect(s.lineHeight).toBe(48);
    expect(s.fontSize).toBe(24);
    expect(s.codeWidth).toBe(1400);
  });

  it('defaults language/theme but keeps non-empty strings', () => {
    expect(resolveSettings({ language: 'python', theme: 'nord' })).toMatchObject({
      language: 'python',
      theme: 'nord',
    });
    expect(resolveSettings({ language: '' }).language).toBe('auto');
    expect(resolveSettings({ theme: 42 }).theme).toBe('github-dark');
  });

  it('reads windowChrome as a boolean, string or absence', () => {
    expect(resolveSettings({ windowChrome: false }).chrome).toBe(false);
    expect(resolveSettings({ windowChrome: 'false' }).chrome).toBe(false);
    expect(resolveSettings({ windowChrome: true }).chrome).toBe(true);
    expect(resolveSettings({}).chrome).toBe(true);
  });

  it('only accepts "svg" as the format', () => {
    expect(resolveSettings({ format: 'svg' }).format).toBe('svg');
    expect(resolveSettings({ format: 'png' }).format).toBe('png');
    expect(resolveSettings({ format: 'jpg' }).format).toBe('png');
    expect(resolveSettings({}).format).toBe('png');
  });

  it('maps the settings onto the layout options verbatim', () => {
    const s = resolveSettings({ width: 500, lineHeight: 30, fontSize: 16, padding: 24 });
    expect(layoutOptionsOf(s)).toEqual({
      codeWidth: 500,
      lineHeight: 30,
      fontSize: 16,
      padding: 24,
      chrome: s.chrome,
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  Colours                                                                    */
/* -------------------------------------------------------------------------- */

describe('resolveBackground', () => {
  it('follows the theme when empty or "theme"', () => {
    expect(resolveBackground('theme', '#0d1117')).toBe('#0d1117');
    expect(resolveBackground('', '#0d1117')).toBe('#0d1117');
    expect(resolveBackground('  ', '#0d1117')).toBe('#0d1117');
  });

  it('uses a custom colour as-is (trimmed)', () => {
    expect(resolveBackground(' #1e1e2e ', '#0d1117')).toBe('#1e1e2e');
  });
});

describe('readableColorFor', () => {
  it('picks near-black text on a light background', () => {
    expect(readableColorFor('#ffffff', 'fallback')).toBe('#1f2430');
  });

  it('picks near-white text on a dark background', () => {
    expect(readableColorFor('#0d1117', 'fallback')).toBe('#e6e6e6');
  });

  it('expands 3-digit hex and trims alpha from 8-digit hex', () => {
    expect(readableColorFor('#fff', 'x')).toBe('#1f2430');
    expect(readableColorFor('#000000ff', 'x')).toBe('#e6e6e6');
  });

  it('falls back for non-hex colours (e.g. CSS colour names)', () => {
    expect(readableColorFor('rebeccapurple', 'fallback')).toBe('fallback');
  });
});

describe('imageColorsFor', () => {
  it('takes fg from the theme and resolves bg/title per the settings', () => {
    const s = resolveSettings({ background: '#f5f5f5' });
    const colors = imageColorsFor(s, { fg: '#c9d1d9', bg: '#0d1117' });
    expect(colors).toEqual({ fg: '#c9d1d9', bg: '#f5f5f5', titleColor: '#1f2430' });
  });

  it('uses the theme background when the option is "theme"', () => {
    const s = resolveSettings({});
    const colors = imageColorsFor(s, { fg: '#c9d1d9', bg: '#0d1117' });
    expect(colors.bg).toBe('#0d1117');
    expect(colors.titleColor).toBe('#e6e6e6');
  });
});

/* -------------------------------------------------------------------------- */
/*  buildSvg                                                                   */
/* -------------------------------------------------------------------------- */

describe('buildSvg', () => {
  const colors = { fg: '#c9d1d9', bg: '#0d1117', titleColor: '#e6e6e6' };

  it('produces a self-contained SVG document with the computed geometry', () => {
    const laid = layout([one('const a = 1;')], baseOpts);
    const svg = buildSvg(laid, colors, baseOpts, '');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /);
    expect(svg).toContain(`width="${laid.imageWidth}"`);
    expect(svg).toContain(`height="${laid.imageHeight}"`);
    expect(svg).toContain(`viewBox="0 0 ${laid.imageWidth} ${laid.imageHeight}"`);
    expect(svg.endsWith('</svg>')).toBe(true);
    // Background rectangle uses the caller's colour.
    expect(svg).toContain('fill="#0d1117"');
  });

  it('escapes XML-special characters in the code so output stays valid XML', () => {
    const laid = layout([one('<script>&"x"</script>')], baseOpts);
    const svg = buildSvg(laid, colors, baseOpts, '');
    // User code can never appear unescaped: the raw markup is absent, and the
    // text node carries the fully escaped form instead.
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;&amp;&quot;x&quot;&lt;/script&gt;');
    // Still parses as XML (well-formed single root, escaped text only).
    expect(() => new DOMParser().parseFromString(svg, 'image/svg+xml')).not.toThrow();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('svg')).not.toBeNull();
  });

  it('escapes the title text in the chrome bar', () => {
    const laid = layout([one('x')], { ...baseOpts, chrome: true });
    const svg = buildSvg(laid, colors, { ...baseOpts, chrome: true }, 'a<b & "c"');
    // The title is escaped too: the raw form is absent and the escaped one present.
    expect(svg).not.toContain('a<b & "c"');
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;');
    expect(svg).toContain('<circle'); // traffic lights present
  });

  it('omits the chrome entirely when it is off', () => {
    const laid = layout([one('x')], baseOpts);
    const svg = buildSvg(laid, colors, baseOpts, 'untitled');
    expect(svg).not.toContain('<circle');
    expect(svg).not.toContain('untitled');
  });

  it('applies token colours and font-style flags via tspan attributes', () => {
    const laid = layout(
      [
        [
          { content: 'const ', color: '#ff7b72', fontStyle: 2 },
          { content: 'x', color: '#79c0ff', fontStyle: 1 },
          { content: ' plain', fontStyle: 0 },
        ],
      ],
      baseOpts,
    );
    const svg = buildSvg(laid, colors, baseOpts, '');
    expect(svg).toContain('<tspan fill="#ff7b72" font-weight="bold">const </tspan>');
    expect(svg).toContain('<tspan fill="#79c0ff" font-style="italic">x</tspan>');
    expect(svg).toContain('<tspan> plain</tspan>');
  });

  it('emits an empty text element for a blank line (line spacing preserved)', () => {
    const laid = layout([one(''), one('b')], baseOpts);
    const svg = buildSvg(laid, colors, baseOpts, '');
    expect(svg).toContain('<text');
    expect(svg.match(/<text x="16" y="\d+(\.\d+)?"><\/text>/)).not.toBeNull();
  });

  it('makes no external references (fonts, images, hrefs)', () => {
    const laid = layout([one('const a = 1;')], { ...baseOpts, chrome: true });
    const svg = buildSvg(laid, colors, { ...baseOpts, chrome: true }, 'main.ts');
    expect(svg).not.toMatch(/href/i);
    expect(svg).not.toMatch(/url\(/i);
    expect(svg).not.toMatch(/<image/i);
    // The only URL in the document must be the SVG namespace declaration; no
    // remote stylesheet import and no other absolute/relative resource URL.
    const withoutNamespace = svg.replace('http://www.w3.org/2000/svg', '');
    expect(withoutNamespace).not.toMatch(/@import|https?:\/\//i);
  });
});

/* -------------------------------------------------------------------------- */
/*  renderFromHighlight (the tool's seam, with a fake token stream)            */
/* -------------------------------------------------------------------------- */

describe('renderFromHighlight', () => {
  const settings = resolveSettings({ language: 'typescript', theme: 'github-dark' });

  it('returns an image data URL wrapping the serialised SVG', () => {
    const result = renderFromHighlight(
      'const a = 1;',
      settings,
      fakeHighlight([one('const a = 1;', '#ff7b72')]),
    );
    expect(result.render).toBe('image');
    expect(result.output).toMatch(/^data:image\/svg\+xml;base64,/);
    const svg = atob(result.output.slice('data:image/svg+xml;base64,'.length));
    expect(svg).toContain('fill="#ff7b72"');
    expect(svg).toContain('fill="#0d1117"'); // theme background
    expect(result.filename).toBe('code-snippet.svg');
    expect(result.stats).toMatchObject({ language: 'typescript', lines: 1, format: 'png' });
  });

  it('handles multi-line, coloured, wrapped token streams', () => {
    // 100 chars × 8.4px = 840px > the 680px default width → wraps into two
    // visual lines; 680 is exactly 80 glyphs, so the flush boundary is clean.
    const long = one('x'.repeat(100), '#79c0ff', 1);
    const result = renderFromHighlight('x'.repeat(100), settings, fakeHighlight([long]));
    const svg = atob(result.output.slice('data:image/svg+xml;base64,'.length));
    expect(result.stats!.lines).toBe(2);
    expect(svg).toContain('font-style="italic"');
  });

  it('notes the 2× PNG rasterisation only when the format option is png', () => {
    const svgResult = renderFromHighlight('x', { ...settings, format: 'svg' }, fakeHighlight([one('x')]));
    expect(svgResult.notes).toBeUndefined();
    const pngResult = renderFromHighlight('x', { ...settings, format: 'png' }, fakeHighlight([one('x')]));
    expect(pngResult.notes?.join(' ')).toMatch(/PNG/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  guessLanguage (auto-detect)                                                */
/* -------------------------------------------------------------------------- */

describe('guessLanguage', () => {
  it('recognises the unambiguous cases', () => {
    expect(guessLanguage('<?php echo 1;')).toBe('php');
    expect(guessLanguage('#!/usr/bin/env python3\ndef main():\n    pass')).toBe('python');
    expect(guessLanguage('<!DOCTYPE html>\n<html><body></body></html>')).toBe('html');
    expect(guessLanguage('{"name": "value", "n": 1}')).toBe('json');
    expect(guessLanguage('---\ntitle: hello\n---')).toBe('yaml');
    expect(guessLanguage('def add(a, b):\n    return a + b')).toBe('python');
    expect(guessLanguage('const x: string = "hi";')).toBe('typescript');
    expect(guessLanguage('const x = 1;')).toBe('javascript');
    expect(guessLanguage('SELECT id FROM users;')).toBe('sql');
    expect(guessLanguage('#include <stdio.h>\nint main() { return 0; }')).toBe('c');
    expect(guessLanguage('#include <iostream>\nint main() { std::cout << 1; }')).toBe('cpp');
    expect(guessLanguage('public class Main { public static void main(String[] a) {} }')).toBe(
      'java',
    );
    expect(guessLanguage('using System;\nnamespace App {}')).toBe('csharp');
    expect(guessLanguage('package main\n\nfunc main() {}')).toBe('go');
    expect(guessLanguage('fn main() { let mut x = 1; }')).toBe('rust');
    expect(guessLanguage('# Title\n\nSome text')).toBe('markdown');
    expect(guessLanguage('.card { padding: 1rem; }')).toBe('css');
    expect(guessLanguage('just some words')).toBe('text');
  });
});
