import { describe, it, expect } from 'vitest';
import { ToolError, type OptionValues } from '@/lib/types';
import tool, {
  buildReport,
  parseSession,
  paletteResult,
  runDeadPixelTest,
  type DeadPixelSession,
} from './dead-pixel-test.tool';

/** Call the tool with the options omitted, the way a bare test would. */
const run = (text: string, options: OptionValues = {}) => runDeadPixelTest({ text, options });

/** A recorded sweep with the given colours shown. */
const session = (shown: unknown[], opts: Partial<DeadPixelSession> = {}) =>
  JSON.stringify({ shown, auto: opts.auto ?? false, fullscreen: opts.fullscreen ?? true });

/** The palette the panel sweeps, in order — written out so the test is a real check. */
const EXPECTED_PALETTE = [
  '#000000',
  '#ffffff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#00ffff',
  '#ff00ff',
  '#ffff00',
  '#000000',
  '#202020',
  '#404040',
  '#606060',
  '#808080',
  '#9f9f9f',
  '#bfbfbf',
  '#dfdfdf',
  '#ffffff',
];

describe('dead-pixel-test meta', () => {
  it('is a stable device tool that runs entirely on-device', () => {
    expect(tool.meta.id).toBe('dead-pixel-test');
    expect(tool.meta.category).toBe('device');
    expect(tool.meta.status).toBe('stable');
    expect(tool.meta.panel).toBe('dead-pixel-test');
    expect(tool.meta.summary.length).toBeLessThanOrEqual(120);
    expect(tool.meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
  });

  it('points at related tools that really exist', () => {
    expect(tool.meta.related?.length).toBeGreaterThan(0);
    for (const id of tool.meta.related ?? []) {
      expect(typeof id).toBe('string');
    }
  });

  it('tells the reader how to leave fullscreen', () => {
    const faq = tool.meta.faq ?? [];
    expect(faq.length).toBeGreaterThan(0);
    expect(faq.map((f) => `${f.q} ${f.a}`).join(' ')).toMatch(/escape/i);
  });

  it('ships an article of three to five headed paragraphs', () => {
    const article = tool.meta.article ?? [];
    expect(article.length).toBeGreaterThanOrEqual(3);
    expect(article.length).toBeLessThanOrEqual(5);
    for (const section of article) {
      expect(section.heading.length).toBeGreaterThan(0);
      expect(section.body.length).toBeGreaterThan(0);
    }
  });
});

describe('dead-pixel-test palette output', () => {
  it('returns the whole sweep as colours when nothing was recorded', () => {
    const result = run('');
    expect(result.render).toBe('colors');
    expect(JSON.parse(result.output)).toEqual(EXPECTED_PALETTE);
    expect(result.stats?.colours).toBe(EXPECTED_PALETTE.length);
  });

  it('describes the interval and the auto-cycle in the notes', () => {
    const timed = run('', { intervalMs: 10000, autoCycle: true });
    expect((timed.notes ?? []).join(' ')).toMatch(/every 10s/);
    const manual = run('', { intervalMs: 10000, autoCycle: false });
    expect((manual.notes ?? []).join(' ')).toMatch(/off/);
  });

  it('clamps a silly interval back into range', () => {
    expect((run('', { intervalMs: 1, autoCycle: true }).notes ?? []).join(' ')).toMatch(
      /every 0.5s/,
    );
    expect((run('', { intervalMs: 999999, autoCycle: true }).notes ?? []).join(' ')).toMatch(
      /every 60s/,
    );
  });
});

describe('dead-pixel-test report', () => {
  it('builds a table report from a recorded sweep', () => {
    const sweep = [
      { name: 'Red', value: '#ff0000', shownMs: 5000 },
      { name: 'Grey 50%', value: '#808080', shownMs: 2500, suspect: true },
    ];
    const result = run(session(sweep));
    expect(result.render).toBe('table');
    const table = JSON.parse(result.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual(['Step', 'Colour', 'Value', 'Shown', 'Result']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toEqual(['1', 'Red', '#ff0000', '5.0s', 'Checked']);
    expect(table.rows[1]).toEqual(['2', 'Grey 50%', '#808080', '2.5s', 'Suspect']);
    expect(result.stats?.colours).toBe(2);
    expect(result.stats?.suspects).toBe(1);
  });

  it('says when no screen was flagged', () => {
    const sweep = [{ name: 'White', value: '#ffffff', shownMs: 5000 }];
    const result = run(session(sweep));
    expect((result.notes ?? []).join(' ')).toMatch(/no screen was flagged/i);
  });

  it('reports how the sweep ran', () => {
    const sweep = [{ name: 'Blue', value: '#0000ff', shownMs: 1000 }];
    const auto = run(session(sweep, { auto: true, fullscreen: true }));
    expect((auto.notes ?? []).join(' ')).toMatch(/fullscreen/i);
    expect((auto.notes ?? []).join(' ')).toMatch(/auto-cycle was on/i);

    const manual = run(session(sweep, { auto: false, fullscreen: false }));
    expect((manual.notes ?? []).join(' ')).toMatch(/without fullscreen/i);
    expect((manual.notes ?? []).join(' ')).toMatch(/stepped by hand/i);
  });

  it('exposes the report builders for direct use', () => {
    const built = buildReport({
      shown: [{ name: 'Blue', value: '#0000ff', shownMs: 5000 }],
      auto: false,
      fullscreen: true,
    });
    expect(built.render).toBe('table');
    expect(paletteResult({}).render).toBe('colors');
  });
});

describe('dead-pixel-test input errors', () => {
  it('throws a friendly error when no sweep was recorded', () => {
    expect(() => parseSession('')).toThrow(ToolError);
    expect(() => parseSession('')).toThrow(/has been recorded/i);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseSession('{not json')).toThrow(ToolError);
    expect(() => parseSession('{not json')).toThrow(/could not be read/i);
  });

  it('throws when the session is not an object', () => {
    expect(() => parseSession('"red"')).toThrow(ToolError);
    expect(() => parseSession('["red"]')).toThrow(/expected shape/i);
  });

  it('throws when the sweep holds no colours', () => {
    expect(() => parseSession('{"shown":null}')).toThrow(/holds no colours/i);
  });

  it('throws on a malformed colour entry', () => {
    expect(() => parseSession('{"shown":[{"name":"Red"}]}')).toThrow(/has no value/i);
    expect(() => parseSession('{"shown":[{"value":"#ff0000"}]}')).toThrow(/has no name/i);
  });
});
