import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PNG_SCALE,
  PREVIEW_CSP,
  RENDER_DEBOUNCE_MS,
  buildPreviewDocument,
  debounce,
  extractMermaidError,
  mermaidTheme,
  parseViewBox,
  pngDimensions,
  pngScaleOption,
  serializeSvg,
} from './mermaid-renderer-panel';

/* -------------------------------------------------------------------------- */
/*  Debounce schedule                                                         */
/* -------------------------------------------------------------------------- */

describe('debounce', () => {
  afterEach(() => vi.useRealTimers());

  it('collapses a burst of edits into a single call', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const scheduler = debounce((value: string) => calls.push(value), RENDER_DEBOUNCE_MS);
    for (const value of ['a', 'ab', 'abc']) scheduler.schedule(value);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS - 1);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['abc']);
  });

  it('cancel drops a pending call without running it', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const scheduler = debounce(fn, RENDER_DEBOUNCE_MS);
    scheduler.schedule();
    scheduler.cancel();
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS * 5);
    expect(fn).not.toHaveBeenCalled();
  });

  it('schedules again after a call has fired', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const scheduler = debounce(fn, RENDER_DEBOUNCE_MS);
    scheduler.schedule();
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);
    scheduler.schedule();
    vi.advanceTimersByTime(RENDER_DEBOUNCE_MS);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  viewBox parsing                                                           */
/* -------------------------------------------------------------------------- */

describe('parseViewBox', () => {
  it('reads the width and height out of a viewBox', () => {
    expect(parseViewBox('<svg id="x" viewBox="0 0 120 60"><g/></svg>')).toEqual({
      width: 120,
      height: 60,
    });
  });

  it('accepts comma separators and rounds fractional sizes', () => {
    expect(parseViewBox('<svg viewBox="0,0,10.6,20.4">')).toEqual({ width: 11, height: 20 });
  });

  it('returns null when the root has no viewBox', () => {
    expect(parseViewBox('<svg width="100" height="50"></svg>')).toBeNull();
  });

  it('returns null for a malformed viewBox', () => {
    expect(parseViewBox('<svg viewBox="0 0 10"></svg>')).toBeNull();
    expect(parseViewBox('<svg viewBox="a b c d"></svg>')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  SVG serialisation                                                         */
/* -------------------------------------------------------------------------- */

const MERMAID_SVG =
  '<svg id="mermaid-render-1" width="100%" xmlns="http://www.w3.org/2000/svg" class="flowchart" style="max-width: 120px;" viewBox="0 0 120 60" role="graphics-document document"><g><rect/></g></svg>';

describe('serializeSvg', () => {
  it('gives the root concrete pixel dimensions from the viewBox', () => {
    const out = serializeSvg(MERMAID_SVG);
    expect(out).toContain('width="120"');
    expect(out).toContain('height="60"');
    expect(out).not.toContain('width="100%"');
    expect(out).toContain('viewBox="0 0 120 60"');
  });

  it('declares the SVG and xlink namespaces', () => {
    const out = serializeSvg(MERMAID_SVG);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
  });

  it('derives a viewBox when the diagram left it out', () => {
    const out = serializeSvg('<svg width="100" height="50"><g/></svg>');
    expect(out).toContain('viewBox="0 0 100 50"');
    expect(out).toContain('width="100"');
    expect(out).toContain('height="50"');
  });

  it('keeps the diagram body untouched', () => {
    expect(serializeSvg(MERMAID_SVG)).toContain('<g><rect/></g></svg>');
  });

  it('returns input that is not an SVG unchanged', () => {
    expect(serializeSvg('not markup')).toBe('not markup');
  });
});

/* -------------------------------------------------------------------------- */
/*  PNG rasterise maths                                                       */
/* -------------------------------------------------------------------------- */

describe('pngDimensions', () => {
  it('scales the SVG pixel size', () => {
    expect(pngDimensions({ width: 100, height: 50 }, 2)).toEqual({ width: 200, height: 100 });
  });

  it('rounds fractional scale results', () => {
    expect(pngDimensions({ width: 101, height: 51 }, 1.5)).toEqual({ width: 152, height: 77 });
  });

  it('never produces a zero-size canvas', () => {
    expect(pngDimensions({ width: 0, height: 0 }, 2)).toEqual({ width: 1, height: 1 });
  });

  it('falls back to the default scale for a nonsense scale', () => {
    expect(pngDimensions({ width: 10, height: 10 }, 0)).toEqual({
      width: 10 * DEFAULT_PNG_SCALE,
      height: 10 * DEFAULT_PNG_SCALE,
    });
    expect(pngDimensions({ width: 10, height: 10 }, Number.NaN)).toEqual({ width: 20, height: 20 });
  });
});

describe('pngScaleOption', () => {
  it('passes a valid scale through', () => {
    expect(pngScaleOption(2)).toBe(2);
    expect(pngScaleOption(1)).toBe(1);
    expect(pngScaleOption(8)).toBe(8);
  });

  it('clamps to the supported range', () => {
    expect(pngScaleOption(0)).toBe(1);
    expect(pngScaleOption(99)).toBe(8);
  });

  it('defaults when the option is missing or not a number', () => {
    expect(pngScaleOption(undefined)).toBe(DEFAULT_PNG_SCALE);
    expect(pngScaleOption('nonsense')).toBe(DEFAULT_PNG_SCALE);
    expect(pngScaleOption('4')).toBe(4);
  });
});

/* -------------------------------------------------------------------------- */
/*  Validation-error extraction                                               */
/* -------------------------------------------------------------------------- */

describe('extractMermaidError', () => {
  it("turns Mermaid's parse error into a one-line message", () => {
    const error = {
      message: 'Parse error on line 3:\nflowchart TDA --\n----------------^\nExpecting STR',
      hash: { loc: { first_line: 2, last_line: 3 } },
    };
    expect(extractMermaidError(error)).toBe('Parse error on line 3');
  });

  it('reads the line number out of the message when there is no hash', () => {
    expect(extractMermaidError(new Error('Parse error on line 5:'))).toBe('Parse error on line 5');
    expect(extractMermaidError(new Error('Parse error on line 12: bad token'))).toBe(
      'Parse error on line 12: bad token',
    );
  });

  it('appends the structured line number when the message omits it', () => {
    const error = { message: 'No diagram type detected', hash: { loc: { first_line: 4 } } };
    expect(extractMermaidError(error)).toBe('No diagram type detected on line 5');
  });

  it('falls back to a generic message for non-Error throws', () => {
    expect(extractMermaidError('boom')).toBe('The diagram could not be parsed.');
    expect(extractMermaidError(null)).toBe('The diagram could not be parsed.');
    expect(extractMermaidError(new Error(''))).toBe('The diagram could not be parsed.');
  });
});

/* -------------------------------------------------------------------------- */
/*  Theme + preview document                                                  */
/* -------------------------------------------------------------------------- */

describe('mermaidTheme', () => {
  it('maps the stored option to the panel theme', () => {
    expect(mermaidTheme('dark')).toBe('dark');
    expect(mermaidTheme('light')).toBe('light');
    expect(mermaidTheme(undefined)).toBe('light');
    expect(mermaidTheme('DARK')).toBe('light');
  });
});

describe('buildPreviewDocument', () => {
  const svg = '<svg width="10" height="10" viewBox="0 0 10 10"><g/></svg>';

  it('embeds the SVG inside a sandbox-safe document', () => {
    const doc = buildPreviewDocument(svg, 'light', 1);
    expect(doc).toContain(svg);
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain("script-src 'none'");
    expect(doc).toContain(PREVIEW_CSP);
  });

  it('paints the theme background', () => {
    expect(buildPreviewDocument(svg, 'light', 1)).toContain('#ffffff');
    expect(buildPreviewDocument(svg, 'dark', 1)).toContain('#0b1322');
  });

  it('applies the zoom and ignores a nonsense zoom', () => {
    expect(buildPreviewDocument(svg, 'light', 2)).toContain('transform:scale(2)');
    expect(buildPreviewDocument(svg, 'light', 0)).toContain('transform:scale(1)');
  });
});

/* -------------------------------------------------------------------------- */
/*  Real Mermaid parse (jsdom can run it; `render` needs a browser)            */
/* -------------------------------------------------------------------------- */

describe('mermaid.parse', () => {
  it('accepts valid source and rejects broken source', async () => {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

    await expect(mermaid.parse('flowchart TD\n  A[Start] --> B[Done]')).resolves.toMatchObject({
      diagramType: 'flowchart-v2',
    });
    await expect(mermaid.parse('sequenceDiagram\n  Alice->>Bob: hi')).resolves.toMatchObject({
      diagramType: 'sequence',
    });

    let caught: unknown;
    try {
      await mermaid.parse('flowchart TD\n  A -->');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeTruthy();
    expect(extractMermaidError(caught)).toMatch(/^Parse error on line \d+$/);
  });
});
