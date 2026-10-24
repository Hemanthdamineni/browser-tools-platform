import { describe, expect, it } from 'vitest';
import tool from './signature-maker.tool';
import { decodeDataUrl } from '@/lib/signature/pixels';

type Out = { output: string };
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Out;

/** Decode an SVG data URL back into its markup. */
function decodeSvg(output: string): string {
  return new TextDecoder().decode(decodeDataUrl(output).bytes);
}

describe('signature-maker', () => {
  it('serialises drawn strokes into a transparent SVG image', () => {
    const out = run(JSON.stringify([[{ x: 0, y: 0 }, { x: 20, y: 10 }]]), {
      mode: 'draw',
      color: '#111827',
      strokeWidth: 3,
    });
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

  it('treats a whitespace-only payload as empty', () => {
    expect(run('   ', { mode: 'type' })).toEqual({ output: '' });
    expect(run('   ', { mode: 'draw' })).toEqual({ output: '' });
  });

  it('applies the stroke-width and ink-colour options', () => {
    const strokes = JSON.stringify([[{ x: 0, y: 0 }, { x: 20, y: 10 }]]);
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