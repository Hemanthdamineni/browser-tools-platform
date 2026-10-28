import { describe, expect, it } from 'vitest';
import {
  parseStrokes,
  renderSignature,
  signatureBounds,
  smoothStroke,
  strokesToSvg,
  svgDataUrl,
  typedLayout,
  typedToSvg,
  type Stroke,
} from './signature-maker-panel';
import { decodeDataUrl } from '@/lib/signature/pixels';

/** Decode an SVG data URL back into its markup. */
function decodeSvg(dataUrl: string): string {
  return new TextDecoder().decode(decodeDataUrl(dataUrl).bytes);
}

describe('smoothStroke', () => {
  it('rounds a known sample sequence into a known polyline', () => {
    const samples: Stroke = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ];
    const out = smoothStroke(samples);
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
    const single: Stroke = [{ x: 5, y: 7 }];
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
      {
        color: '#111827',
        strokeWidth: 3,
        padding: 10,
      },
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
    expect(svg).toContain('A&amp;B &lt;C&gt;');
    expect(svg).not.toContain('<rect');
    expect(svg).not.toContain('url(');
  });

  it('emits a font-family attribute the SVG parser accepts', () => {
    for (const style of ['script', 'classic', 'modern', 'mono'] as const) {
      const svg = typedToSvg('Ada', { style, size: 100 });
      const match = /font-family="([^"]*)"/.exec(svg);
      expect(match, style).not.toBeNull();
      const family = match![1]!;
      // The stack keeps its own single quotes; a stray double quote would end
      // the XML attribute early and make the whole SVG undecodable.
      expect(family).not.toContain('"');
      expect(family).toContain(',');
      const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(parsed.querySelector('parsererror'), style).toBeNull();
      expect(parsed.querySelector('text')?.getAttribute('font-family')).toBe(family);
    }
  });

  it('throws for a blank name', () => {
    expect(() => typedLayout('   ')).toThrow(/Type a name/);
    expect(() => typedToSvg('')).toThrow(/Type a name/);
  });
});

describe('svgDataUrl and parseStrokes', () => {
  it('encodes the SVG as a base64 image data URL', () => {
    const url = svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const decoded = new TextDecoder().decode(decodeDataUrl(url).bytes);
    expect(decoded).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
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

describe('renderSignature', () => {
  it('produces an empty result for empty input', () => {
    expect(renderSignature('', {})).toEqual({ output: '' });
  });

  it('builds a transparent SVG image result for drawn strokes', () => {
    const result = renderSignature('[[[0,0],[20,10]]]', { mode: 'draw', color: '#111827' });
    expect(result.render).toBe('image');
    expect(result.filename).toBe('signature.svg');
    const svg = decodeSvg(result.output);
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<rect');
    expect(result.stats).toMatchObject({ source: 'drawn', strokes: 1 });
  });

  it('builds a typed signature from a name', () => {
    const result = renderSignature('Ada Lovelace', { mode: 'type', style: 'script' });
    const svg = decodeSvg(result.output);
    expect(svg).toContain('<text');
    expect(svg).toContain('font-style="italic"');
    expect(result.stats).toMatchObject({ source: 'typed' });
  });
});
