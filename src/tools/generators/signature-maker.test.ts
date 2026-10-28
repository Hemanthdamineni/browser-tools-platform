import { describe, expect, it } from 'vitest';
import tool from './signature-maker.tool';
import {
  escapeXml,
  parseStrokes,
  signatureBounds,
  smoothStroke,
  strokesToSvg,
  typedLayout,
  typedToSvg,
} from './signature-maker.core';
import { decodeDataUrl } from '@/lib/signature/pixels';

type Out = { output: string };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Out;

/** Decode an SVG data URL back into its markup. */
function decodeSvg(output: string): string {
  return new TextDecoder().decode(decodeDataUrl(output).bytes);
}

describe('smoothStroke', () => {
  it('rounds a known sample sequence into a known polyline', () => {
    const out = smoothStroke([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ]);
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 15, y: 0 },
      { x: 20, y: 5 },
      { x: 20, y: 15 },
      { x: 20, y: 20 },
    ]);
  });

  it('keeps the endpoints so a stroke starts and ends where the user put it', () => {
    const out = smoothStroke([
      { x: 4, y: 9 },
      { x: 6, y: 12 },
      { x: 10, y: 14 },
    ]);
    expect(out[0]).toEqual({ x: 4, y: 9 });
    expect(out[out.length - 1]).toEqual({ x: 10, y: 14 });
  });

  it('returns a copy for a tap (fewer than three samples)', () => {
    const single = [{ x: 5, y: 7 }];
    const out = smoothStroke(single);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ x: 5, y: 7 });
    expect(out).not.toBe(single);
  });
});

describe('signatureBounds', () => {
  it('grows the box by the padding on every side', () => {
    const bounds = signatureBounds(
      [
        [
          { x: 0, y: 0 },
          { x: 20, y: 10 },
        ],
      ],
      10,
    );
    expect(bounds).toEqual({ x: -10, y: -10, width: 40, height: 30 });
  });

  it('returns null when there are no points', () => {
    expect(signatureBounds([[], []], 10)).toBeNull();
  });
});

describe('strokesToSvg', () => {
  it('serialises a known stroke into a valid, transparent SVG', () => {
    const svg = strokesToSvg(
      [
        [
          { x: 0, y: 0 },
          { x: 20, y: 10 },
        ],
      ],
      { color: '#111827', strokeWidth: 3, padding: 10 },
    );
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30" viewBox="0 0 40 30">' +
        '<path d="M 10 10 L 30 20" fill="none" stroke="#111827" stroke-width="3" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>',
    );
  });

  it('emits a dot for a single-point stroke', () => {
    const svg = strokesToSvg([[{ x: 5, y: 6 }]], { padding: 0 });
    expect(svg).toContain('M 0 0 L 0 0');
  });

  it('keeps the background transparent and free of external references', () => {
    const svg = strokesToSvg([
      [
        { x: 1, y: 2 },
        { x: 9, y: 8 },
      ],
    ]);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    // Transparent: no background element, no fill on a covering rect.
    expect(svg).not.toContain('<rect');
    expect(svg).not.toContain('fill="#fff"');
    expect(svg).not.toContain('fill="white"');
    // No external references.
    expect(svg).not.toContain('url(');
    expect(svg).not.toContain('href=');
    expect(svg).not.toContain('<image');
  });

  it('rounds coordinates so the output stays clean', () => {
    const svg = strokesToSvg(
      [
        [
          { x: 1.003, y: 2.004 },
          { x: 9, y: 8 },
        ],
      ],
      { padding: 5 },
    );
    expect(svg).not.toContain('1.003');
  });

  it('throws when there is no ink', () => {
    expect(() => strokesToSvg([])).toThrow(/Draw a signature/);
  });
});

describe('typedLayout and typedToSvg', () => {
  it('sizes the box from the name, size and padding', () => {
    const layout = typedLayout('Ada', { style: 'classic', size: 100 });
    expect(layout).toMatchObject({
      fontSize: 100,
      padding: 30,
      width: 210,
      height: 230,
      textX: 30,
      baseline: 115,
    });
    expect(layout.font).toContain('Times New Roman');
    expect(layout.font).not.toContain('italic');
  });

  it('marks the script style as italic', () => {
    const layout = typedLayout('Ada', { style: 'script', size: 100 });
    expect(layout.font.startsWith('italic ')).toBe(true);
  });

  it('emits a transparent SVG with an escaped name', () => {
    const svg = typedToSvg('A&B <C>', { style: 'classic', size: 100, color: '#1d4ed8' });
    expect(svg).toContain('<text');
    expect(svg).toContain('fill="#1d4ed8"');
    expect(svg).toContain('A&#38;B &#60;C&#62;');
    expect(svg).not.toContain('<rect');
    expect(svg).not.toContain('url(');
  });

  it('throws for a blank name', () => {
    expect(() => typedLayout('   ')).toThrow(/Type a name/);
    expect(() => typedToSvg('')).toThrow(/Type a name/);
  });
});

describe('escapeXml and parseStrokes', () => {
  it('escapes XML specials', () => {
    const raw = [
      'A',
      String.fromCharCode(38),
      'B ',
      String.fromCharCode(60),
      'C',
      String.fromCharCode(62),
    ].join('');
    const out = escapeXml(raw);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain(String.fromCharCode(38) + 'B');
    expect(out.endsWith(';')).toBe(true);
  });

  it('parses a JSON stroke list into Point[] strokes', () => {
    const strokes = parseStrokes('[[[0,0],[20,10]],[[5,5]]]');
    expect(strokes).toHaveLength(2);
    expect(strokes[0]).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 10 },
    ]);
    expect(strokes[1]).toEqual([{ x: 5, y: 5 }]);
  });

  it('rejects malformed payloads with a clear error', () => {
    expect(() => parseStrokes('not json')).toThrow(/not valid JSON/);
    expect(() => parseStrokes('{"a":1}')).toThrow(/not a list of strokes/);
    expect(() => parseStrokes('[[1,2]]')).toThrow(/must have x and y coordinates/);
    expect(() => parseStrokes('[[["x","y"]]]')).toThrow(/must be numbers/);
  });
});

describe('signature-maker tool', () => {
  it('serialises drawn strokes into a transparent SVG image', () => {
    const out = run(
      JSON.stringify([
        [
          [0, 0],
          [20, 10],
        ],
      ]),
      { mode: 'draw', color: '#111827', strokeWidth: 3 },
    );
    expect(out.output.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = decodeSvg(out.output);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<rect');
    expect(svg).not.toContain('url(');
  });

  it('builds a typed signature from a name in the selected style', () => {
    const out = run('Ada Lovelace', { mode: 'type', style: 'script', color: '#1d4ed8' });
    const svg = decodeSvg(out.output);
    expect(svg).toContain('<text');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('fill="#1d4ed8"');
  });

  it('returns an empty result for empty input', () => {
    expect(run('')).toEqual({ output: '' });
    expect(run('   ')).toEqual({ output: '' });
  });

  it('rejects invalid drawn-signature data', () => {
    expect(() => run('not json', { mode: 'draw' })).toThrow(/not valid JSON/);
    expect(() => run('{"a":1}', { mode: 'draw' })).toThrow(/not a list of strokes/);
    expect(() => run('[[["x","y"]]]', { mode: 'draw' })).toThrow(/must be numbers/);
  });

  it('treats a whitespace-only payload as empty in both modes', () => {
    expect(run('   ', { mode: 'type' })).toEqual({ output: '' });
    expect(run('   ', { mode: 'draw' })).toEqual({ output: '' });
  });

  it('applies the stroke-width and ink-colour options', () => {
    const strokes = JSON.stringify([
      [
        [0, 0],
        [20, 10],
      ],
    ]);
    const thin = decodeSvg(run(strokes, { mode: 'draw', strokeWidth: 1, color: '#b91c1c' }).output);
    const thick = decodeSvg(
      run(strokes, { mode: 'draw', strokeWidth: 9, color: '#047857' }).output,
    );
    expect(thin).toContain('stroke-width="1"');
    expect(thin).toContain('stroke="#b91c1c"');
    expect(thick).toContain('stroke-width="9"');
    expect(thick).toContain('stroke="#047857"');
  });

  it('scales the typed layout with the size option', () => {
    const small = decodeSvg(run('Ada', { mode: 'type', size: 48 }).output);
    const large = decodeSvg(run('Ada', { mode: 'type', size: 320 }).output);
    const widthOf = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1]);
    expect(widthOf(large)).toBeGreaterThan(widthOf(small));
  });
});
