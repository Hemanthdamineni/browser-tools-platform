import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copyAllText,
  elapsedMs,
  emptySnapshot,
  formatElapsed,
  lapRows,
  mountStopwatchPanel,
  parseSnapshot,
  type StopwatchSnapshot,
} from './stopwatch-panel';
import { runToolById } from '@/lib/worker/client';

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));
vi.mock('@/lib/clipboard', () => ({ copyText: vi.fn(async () => true) }));

const runToolByIdMock = vi.mocked(runToolById);

/** The markup Stopwatch.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.stopwatchPanel = '';
  root.dataset.toolId = 'stopwatch';
  root.innerHTML = `
    <output data-sw-readout>00:00:00.000</output>
    <p data-sw-status>Ready.</p>
    <button type="button" data-sw-start>Start</button>
    <button type="button" data-sw-lap disabled>Lap</button>
    <button type="button" data-sw-reset>Reset</button>
    <button type="button" data-sw-copy>Copy all</button>
    <button type="button" data-sw-view>Refresh report</button>
    <ul data-sw-laps></ul>
    <div data-sw-error hidden></div>
    <div data-sw-result-wrap hidden><div data-sw-report></div></div>
  `;
  return root;
}

/** A snapshot at a specific instant (default: 1 minute in). */
const snap = (over: Partial<StopwatchSnapshot> = {}): StopwatchSnapshot => ({
  running: false,
  start: 0,
  accumulated: 60000,
  laps: [],
  now: 0,
  ...over,
});

describe('formatElapsed', () => {
  it('formats a known answer as HH:MM:SS.mmm', () => {
    expect(formatElapsed(0)).toBe('00:00:00.000');
    expect(formatElapsed(90_123)).toBe('00:01:30.123');
    expect(formatElapsed(3_600_000)).toBe('01:00:00.000');
    expect(formatElapsed(123_456_789)).toBe('34:17:36.789');
  });

  it('grows hours past two digits', () => {
    expect(formatElapsed(100 * 3_600_000)).toBe('100:00:00.000');
  });

  it('rounds to the nearest millisecond and never goes negative', () => {
    expect(formatElapsed(999.6)).toBe('00:00:01.000');
    expect(formatElapsed(-500)).toBe('00:00:00.000');
  });
});

describe('elapsedMs', () => {
  it('returns the banked time when stopped', () => {
    expect(elapsedMs(snap({ accumulated: 42_000 }))).toBe(42_000);
  });

  it('adds the live interval while running', () => {
    const s = snap({ running: true, start: 10_000, accumulated: 5000, now: 65_250 });
    expect(elapsedMs(s)).toBe(60_250);
  });

  it('stays exact when the tab sleeps (a huge timestamp jump)', () => {
    // Started at t=10s with 5s banked; the frame wakes an hour later.
    const s = snap({ running: true, start: 10_000, accumulated: 5000, now: 3_610_250 });
    expect(elapsedMs(s)).toBe(3_605_250);
  });
});

describe('lapRows', () => {
  const four = snap({
    laps: [
      { atMs: 345000, splitMs: 345000 },
      { atMs: 702000, splitMs: 357000 },
      { atMs: 1055000, splitMs: 353000 },
      { atMs: 1770000, splitMs: 715000 },
    ],
  });

  it('marks the fastest and slowest splits', () => {
    const rows = lapRows(four);
    expect(rows[0]!.fastest).toBe(true);
    expect(rows[0]!.slowest).toBe(false);
    expect(rows[1]!.fastest).toBe(false);
    expect(rows[1]!.slowest).toBe(false);
    expect(rows[3]!.fastest).toBe(false);
    expect(rows[3]!.slowest).toBe(true);
  });

  it('does not label a single lap', () => {
    const rows = lapRows(snap({ laps: [{ atMs: 3000, splitMs: 3000 }] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fastest).toBe(false);
    expect(rows[0]!.slowest).toBe(false);
  });

  it('marks every lap that ties for a record', () => {
    const rows = lapRows(
      snap({
        laps: [
          { atMs: 3000, splitMs: 3000 },
          { atMs: 6000, splitMs: 3000 },
          { atMs: 10_000, splitMs: 4000 },
        ],
      }),
    );
    expect(rows[0]!.fastest).toBe(true);
    expect(rows[1]!.fastest).toBe(true);
    expect(rows[2]!.fastest).toBe(false);
    expect(rows[2]!.slowest).toBe(true);
  });
});

describe('parseSnapshot', () => {
  it('parses a well-formed snapshot and clamps bad numbers', () => {
    const parsed = parseSnapshot(JSON.stringify(snap({ accumulated: 500, laps: [{ atMs: 10, splitMs: 10 }] })));
    expect(parsed.accumulated).toBe(500);
    expect(parsed.laps).toEqual([{ atMs: 10, splitMs: 10 }]);
  });

  it('returns an empty snapshot for empty or malformed text', () => {
    expect(parseSnapshot('')).toEqual(emptySnapshot());
    expect(parseSnapshot('garbage')).toEqual(emptySnapshot());
    expect(parseSnapshot('[1,2]')).toEqual(emptySnapshot());
  });
});

describe('copyAllText', () => {
  it('dumps the elapsed time and every lap', () => {
    const text = copyAllText(
      snap({
        accumulated: 125000,
        laps: [{ atMs: 125000, splitMs: 125000 }],
      }),
    );
    expect(text).toContain('Stopwatch — 00:02:05.000');
    expect(text).toContain('Lap 1  split 00:02:05.000  total 00:02:05.000');
  });
});

describe('mountStopwatchPanel', () => {
  let clock = 0;
  let frames: Array<(time: number) => void> = [];

  /** Run the pending animation frame(s) with the current clock. */
  function fireFrame(): void {
    const pending = frames;
    frames = [];
    for (const cb of pending) cb(clock);
  }

  beforeEach(() => {
    clock = 0;
    frames = [];
    // Timers are faked so the debounced report refresh never fires mid-test;
    // `performance` and rAF are stubbed because vitest does not fake those.
    vi.useFakeTimers();
    vi.stubGlobal('performance', Object.create(performance, { now: { value: () => clock } }));
    vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    runToolByIdMock.mockReset();
    runToolByIdMock.mockResolvedValue({
      output: JSON.stringify({ headers: ['Lap', 'Split', 'Total'], rows: [] }),
      render: 'table',
      stats: {},
      notes: [],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts, laps and pauses via the buttons', () => {
    const root = fixture();
    mountStopwatchPanel(root);
    const readout = root.querySelector<HTMLElement>('[data-sw-readout]')!;
    const start = root.querySelector<HTMLButtonElement>('[data-sw-start]')!;
    const lap = root.querySelector<HTMLButtonElement>('[data-sw-lap]')!;

    // A fresh watch: lap is disabled, readout is zero.
    expect(readout.textContent).toBe('00:00:00.000');
    expect(lap.disabled).toBe(true);

    clock = 5000;
    start.click();
    expect(start.textContent).toBe('Pause');
    expect(lap.disabled).toBe(false);
    // At the instant it starts the elapsed time is still zero.
    expect(readout.textContent).toBe('00:00:00.000');

    // Three seconds later, take a lap: split and total both read 3s.
    clock = 8000;
    lap.click();
    const rows = root.querySelectorAll('[data-sw-laps] li');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain('00:00:03.000');
    expect(readout.textContent).toBe('00:00:03.000');

    // Pause one second later: the run has banked 4s.
    clock = 9000;
    start.click();
    expect(start.textContent).toBe('Start');
    expect(readout.textContent).toBe('00:00:04.000');
  });

  it('resets the watch to zero', () => {
    const root = fixture();
    mountStopwatchPanel(root);
    const readout = root.querySelector<HTMLElement>('[data-sw-readout]')!;
    const start = root.querySelector<HTMLButtonElement>('[data-sw-start]')!;
    const reset = root.querySelector<HTMLButtonElement>('[data-sw-reset]')!;

    clock = 4000;
    start.click();
    reset.click();
    expect(readout.textContent).toBe('00:00:00.000');
    expect(start.textContent).toBe('Start');
  });

  it('toggles with the space bar and takes a lap with L', () => {
    const root = fixture();
    mountStopwatchPanel(root);
    const readout = root.querySelector<HTMLElement>('[data-sw-readout]')!;
    const start = root.querySelector<HTMLButtonElement>('[data-sw-start]')!;

    clock = 3000;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    expect(start.textContent).toBe('Pause');

    // Three seconds later, L records a lap with a 3s split.
    clock = 6000;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
    expect(root.querySelectorAll('[data-sw-laps] li')).toHaveLength(1);

    // Space again one second later pauses with 4s banked.
    clock = 7000;
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    expect(start.textContent).toBe('Start');
    expect(readout.textContent).toBe('00:00:04.000');
  });

  it('keeps the readout live on each animation frame while running', () => {
    const root = fixture();
    mountStopwatchPanel(root);
    const readout = root.querySelector<HTMLElement>('[data-sw-readout]')!;
    const start = root.querySelector<HTMLButtonElement>('[data-sw-start]')!;

    clock = 1000;
    start.click();
    // Two seconds pass between frames (a sleeping tab would jump much further);
    // the frame recomputes from the timestamps rather than counting ticks.
    clock = 900_000;
    fireFrame();
    expect(readout.textContent).toBe('00:14:59.000');
  });

  it('ignores shortcuts while typing in a field', () => {
    const root = fixture();
    mountStopwatchPanel(root);
    const start = root.querySelector<HTMLButtonElement>('[data-sw-start]')!;
    const field = document.createElement('input');
    document.body.appendChild(field);

    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    expect(start.textContent).toBe('Start');
    document.body.removeChild(field);
  });
});