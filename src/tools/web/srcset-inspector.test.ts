import { describe, expect, it } from 'vitest';
import tool from './srcset-inspector.tool';

/**
 * Expected values come from the WHATWG HTML living standard:
 *  - "parse a srcset attribute"
 *  - "parse a sizes attribute"
 *  - "select an image source from a source set"
 * and from the worked examples in that specification. They are baked as
 * literals so a change in the implementation has to justify itself.
 */

type Opts = Record<string, string | number | boolean>;

async function rows(text: string, options: Opts = {}): Promise<string[][]> {
  const r = await tool.run({
    files: [],
    options: { ...options, format: 'candidates' },
    text,
  } as never);
  return (JSON.parse(r.report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows;
}

async function findings(text: string, options: Opts = {}): Promise<string[][]> {
  const r = await tool.run({
    files: [],
    options: { ...options, format: 'findings' },
    text,
  } as never);
  return (JSON.parse(r.report?.output ?? '{"rows":[]}') as { rows: string[][] }).rows;
}

async function summary(text: string, options: Opts = {}): Promise<string> {
  const r = await tool.run({
    files: [],
    options: { ...options, format: 'summary' },
    text,
  } as never);
  return r.report?.output ?? '';
}

async function selected(text: string, options: Opts = {}): Promise<string> {
  const r = await tool.run({
    files: [],
    options: { ...options, format: 'selected' },
    text,
  } as never);
  return r.report?.output ?? '';
}

describe('parse a srcset attribute', () => {
  it('reads two density candidates', async () => {
    const r = await rows('a.png 1x, b.png 2x');
    expect(r.map((x) => [x[0], x[3]])).toEqual([
      ['a.png', '1'],
      ['b.png', '2'],
    ]);
  });

  it('defaults a bare URL to 1x', async () => {
    const r = await rows('a.png 1x, b.png 2x');
    expect(r[0]?.[3]).toBe('1');
  });

  it('treats an omitted descriptor on every candidate as 1x', async () => {
    const r = await rows('a.png, b.png');
    expect(r.map((x) => x[3])).toEqual(['1', '1']);
  });

  it('reads width descriptors', async () => {
    const r = await rows('a.png 480w, b.png 800w');
    expect(r.map((x) => x[2])).toEqual(['480', '800']);
    expect(r.map((x) => x[3])).toEqual(['', '']);
  });

  it('accepts a comma with no following space', async () => {
    const r = await rows('a.png 1x,b.png 2x');
    expect(r.length).toBe(2);
    expect(r[1]?.[0]).toBe('b.png');
  });

  it('tolerates surrounding and internal whitespace', async () => {
    const r = await rows('  a.png  1x ,  b.png 800w  ');
    expect(r.length).toBe(2);
    expect(r[0]?.[2]).toBe('');
    expect(r[1]?.[2]).toBe('800');
  });

  it('tolerates tabs and newlines between candidates', async () => {
    const r = await rows('a.png 1x,\nb.png\t2x,\nc.png 3x');
    expect(r.map((x) => x[3])).toEqual(['1', '2', '3']);
  });
});

describe('descriptor validation', () => {
  it('rejects a width and a density descriptor on the same candidate', async () => {
    const f = await findings('a.png 480w 2x');
    expect(f.some((x) => x[1] === 'mixed-descriptors')).toBe(true);
  });

  it('rejects a zero width descriptor', async () => {
    const f = await findings('a.png 0w');
    expect(f.some((x) => x[1] === 'invalid-width')).toBe(true);
  });

  it('rejects a negative width descriptor', async () => {
    const f = await findings('a.png -480w');
    expect(f.some((x) => x[1] === 'unknown-descriptor')).toBe(true);
  });

  it('rejects an unknown descriptor', async () => {
    const f = await findings('a.png 2q');
    expect(f.some((x) => x[1] === 'unknown-descriptor')).toBe(true);
  });

  it('accepts a fractional density descriptor', async () => {
    const r = await rows('a.png 1.5x');
    expect(r[0]?.[3]).toBe('1.5');
  });

  it('rejects a duplicate width descriptor', async () => {
    const f = await findings('a.png 480w 800w');
    expect(f.some((x) => x[1] === 'duplicate-width')).toBe(true);
  });
});
describe('sizes attribute and source size', () => {
  it('resolves "100vw" to the viewport when sizes is absent', async () => {
    const s = await summary('a.png 800w', { viewport: 640 });
    expect(s).toContain('Source size: 640.00px');
  });

  it('uses the bare length when no condition matches', async () => {
    const s = await summary('a.png 800w', {
      sizes: '(min-width: 1000px) 400px, 100vw',
      viewport: 640,
    });
    expect(s).toContain('Source size: 640.00px');
  });

  it('uses the first matching media condition', async () => {
    const s = await summary('a.png 800w', {
      sizes: '(min-width: 600px) 400px, 100vw',
      viewport: 640,
    });
    expect(s).toContain('Source size: 400.00px');
  });

  it('computes density as width / source size', async () => {
    const r = await rows('a.png 800w', { sizes: '400px', viewport: 640 });
    expect(r[0]?.[4]).toBe('2.000');
  });

  it('warns when more than one bare length is present', async () => {
    const f = await findings('a.png 800w', { sizes: '100px, 200px' });
    expect(f.some((x) => x[1] === 'sizes-multiple-bare')).toBe(true);
  });

  it('reports an unsupported media condition rather than guessing', async () => {
    const f = await findings('a.png 800w', { sizes: '(orientation: landscape) 50vw' });
    expect(f.some((x) => x[1] === 'sizes-unsupported-condition')).toBe(true);
  });
});
describe('select an image source', () => {
  it('picks the greatest density not exceeding DPR', async () => {
    const sel = await selected('a.png 1x, b.png 2x, c.png 3x', { dpr: 2 });
    expect(sel).toContain('b.png');
  });

  it('picks 1x for a DPR of 1 given 1x and 2x', async () => {
    const sel = await selected('a.png 1x, b.png 2x', { dpr: 1 });
    expect(sel).toContain('a.png');
    expect(sel).not.toContain('b.png');
  });

  it('picks the smallest density when every density exceeds DPR', async () => {
    const sel = await selected('a.png 2x, b.png 3x', { dpr: 1 });
    expect(sel).toContain('a.png');
  });

  it('never picks a candidate denser than DPR when a fitting one exists', async () => {
    const sel = await selected('a.png 1x, b.png 2x, c.png 4x', { dpr: 2 });
    expect(sel).toContain('b.png');
    expect(sel).not.toContain('c.png');
  });
});
describe('whole-srcset and input edge cases', () => {
  it('flags an empty srcset with an error', async () => {
    const f = await findings('');
    expect(f.some((x) => x[1] === 'empty-srcset')).toBe(true);
  });

  it('tolerates a trailing comma', async () => {
    const r = await rows('a.png 1x, b.png 2x,');
    expect(r.length).toBe(2);
  });

  it('tolerates commas without whitespace between candidates', async () => {
    const r = await rows('a.png 1x,b.png 2x');
    expect(r.length).toBe(2);
  });

  it('flags mixing width and density across candidates', async () => {
    const f = await findings('a.png 480w, b.png 2x');
    expect(f.some((x) => x[1] === 'mixed-candidate-types')).toBe(true);
  });

  it('treats a leading comma as a separator, not an empty candidate', async () => {
    // ", 2x" parses to one candidate whose URL is "2x" at density 1x, exactly
    // as the parsing algorithm describes; the empty run before the comma is
    // skipped rather than reported as a URL-less candidate.
    const r = await rows(', 2x');
    expect(r.length).toBe(1);
    expect(r[0]?.[0]).toBe('2x');
    expect(r[0]?.[3]).toBe('1');
  });

  it('reports no usable URL for a srcset of only separators', async () => {
    const f = await findings(',,');
    expect(
      f.some((x) => x[0] === 'error' && (x[1] === 'no-candidates' || x[1] === 'empty-srcset')),
    ).toBe(true);
  });

  it('guards against extremely long inputs', async () => {
    await expect(
      tool.run({
        files: [],
        options: { format: 'summary' },
        text: 'a.png 1x, '.repeat(20000),
      } as never),
    ).resolves.toBeDefined();
  });

  it('reads the srcset from a file when no text is given', async () => {
    const file = new File(
      [new TextEncoder().encode('a.png 480w, b.png 800w').buffer as ArrayBuffer],
      'x.txt',
    );
    const r = await tool.run({
      files: [file],
      options: { format: 'candidates' },
      text: undefined,
    } as never);
    const t = JSON.parse(r.report?.output ?? '{"rows":[]}') as { rows: string[][] };
    expect(t.rows.map((x) => x[0])).toEqual(['a.png', 'b.png']);
  });

  it('reports a summary even for a valid two-candidate srcset', async () => {
    const s = await summary('a.png 1x, b.png 2x');
    expect(s).toContain('Candidates: 2');
    expect(s).toContain('Errors: 0');
  });
});
