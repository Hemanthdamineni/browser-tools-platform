import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTimer,
  formatDurationWords,
  formatRemaining,
  isExpired,
  mountCountdownTimerPanel,
  newlyFinished,
  parseDuration,
  parseTimerEntry,
  pauseTimer,
  remainingMs,
  resumeTimer,
  settleTimers,
  startTimer,
  type Timer,
} from './countdown-timer-panel';
import { runToolById } from '@/lib/worker/client';

vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

const runToolByIdMock = vi.mocked(runToolById);

/** The markup CountdownTimerPanel.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.countdownPanel = '';
  root.dataset.toolId = 'countdown-timer';
  root.innerHTML = `
    <ul data-timer-list></ul>
    <input data-duration-input>
    <button data-add-timer>Add timer</button>
    <div data-preset-row><button data-preset="60">1 min</button></div>
    <div data-example-row><button data-example data-example-entry="Tea 3m">Tea</button></div>
    <div data-timer-status></div>
    <div data-result-wrap>
      <p data-timer-empty>No timers yet</p>
      <div data-timer-summary-wrap hidden><div data-timer-summary></div><ul data-timer-notes></ul></div>
    </div>
    <input type="checkbox" data-sound checked>
    <input type="checkbox" data-notify>
    <select data-format>
      <option value="clock" selected>Clock</option>
      <option value="words">Words</option>
    </select>
    <div data-timer-error hidden></div>
  `;
  return root;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('parseDuration', () => {
  it('parses bare seconds, letter and colon forms', () => {
    expect(parseDuration('90')).toBe(90_000);
    expect(parseDuration('90s')).toBe(90_000);
    expect(parseDuration('2m30s')).toBe(150_000);
    expect(parseDuration('1h5m')).toBe(3_900_000);
    expect(parseDuration('5:00')).toBe(300_000);
    expect(parseDuration('1:02:03')).toBe(3_723_000);
    expect(parseDuration('  3 m ')).toBe(180_000);
  });

  it('rejects empty, zero and nonsense input', () => {
    expect(() => parseDuration('')).toThrow(/Enter a duration/);
    expect(() => parseDuration('   ')).toThrow(/Enter a duration/);
    expect(() => parseDuration('0')).toThrow(/more than zero/);
    expect(() => parseDuration('not a duration')).toThrow(/valid duration/);
    expect(() => parseDuration('2h90m')).toThrow(/valid duration/);
    expect(() => parseDuration('99:99')).toThrow(/valid duration/);
  });

  it('caps a duration at 24 hours', () => {
    expect(parseDuration('24h')).toBe(86_400_000);
    expect(() => parseDuration('25h')).toThrow(/too long/);
  });
});

describe('parseTimerEntry', () => {
  it('reads a bare duration as an unnamed timer', () => {
    expect(parseTimerEntry('3m', 'Timer 1')).toEqual({ label: 'Timer 1', durationMs: 180_000 });
  });

  it('reads a name written before the duration', () => {
    expect(parseTimerEntry('Tea 3m', 'Timer 1')).toEqual({ label: 'Tea', durationMs: 180_000 });
    expect(parseTimerEntry('Boil the eggs 90s', 'Timer 1')).toEqual({
      label: 'Boil the eggs',
      durationMs: 90_000,
    });
    expect(parseTimerEntry('Tea: 2m', 'Timer 1')).toEqual({ label: 'Tea', durationMs: 120_000 });
  });

  it('treats a spaced multi-unit duration as one duration, not a name', () => {
    expect(parseTimerEntry('1h 30m', 'Timer 1')).toEqual({
      label: 'Timer 1',
      durationMs: 5_400_000,
    });
  });

  it('rejects a name with no usable duration', () => {
    expect(() => parseTimerEntry('Tea soon', 'Timer 1')).toThrow(/valid duration/);
  });
});

describe('formatRemaining', () => {
  it('formats as MM:SS, and H:MM:SS from an hour up', () => {
    expect(formatRemaining(90_000)).toBe('01:30');
    expect(formatRemaining(150_000)).toBe('02:30');
    expect(formatRemaining(3_900_000)).toBe('1:05:00');
    expect(formatRemaining(0)).toBe('00:00');
  });

  it('rounds a running time up, so 00:00 means it really is over', () => {
    expect(formatRemaining(1)).toBe('00:01');
    expect(formatRemaining(999)).toBe('00:01');
    expect(formatRemaining(-5)).toBe('00:00');
  });
});

describe('formatDurationWords', () => {
  it('spells the duration out', () => {
    expect(formatDurationWords(90_000)).toBe('1 minute 30 seconds');
    expect(formatDurationWords(3_900_000)).toBe('1 hour 5 minutes');
    expect(formatDurationWords(0)).toBe('0 seconds');
  });
});

describe('deadline maths', () => {
  const NOW = 1_000_000;

  it('derives the remaining time from the deadline, so a clock jump counts', () => {
    const timer = createTimer('t1', 'Tea', 60_000, NOW);
    expect(timer.endAt).toBe(NOW + 60_000);
    expect(remainingMs(timer, NOW)).toBe(60_000);
    // The clock jumped forward 20 s — the remaining time follows it.
    expect(remainingMs(timer, NOW + 20_000)).toBe(40_000);
    // Ten minutes of sleep still lands on zero, never below it.
    expect(remainingMs(timer, NOW + 60_000)).toBe(0);
    expect(remainingMs(timer, NOW + 600_000)).toBe(0);
  });

  it('pausing freezes the remaining time and nothing leaks while paused', () => {
    const timer = createTimer('t1', 'Tea', 60_000, NOW);
    const paused = pauseTimer(timer, NOW + 10_000);
    expect(paused.running).toBe(false);
    expect(remainingMs(paused, NOW + 10_000)).toBe(50_000);
    expect(remainingMs(paused, NOW + 40_000)).toBe(50_000);
  });

  it('resuming recomputes the deadline from the frozen remaining time', () => {
    const timer = createTimer('t1', 'Tea', 60_000, NOW);
    const paused = pauseTimer(timer, NOW + 15_000);
    const resumed = resumeTimer(paused, NOW + 60_000);
    expect(resumed.running).toBe(true);
    expect(resumed.endAt).toBe(NOW + 105_000);
    expect(remainingMs(resumed, NOW + 60_000)).toBe(45_000);
  });

  it('a paused timer does not resume with no time left', () => {
    const paused: Timer = {
      ...createTimer('t1', 'Tea', 60_000, NOW),
      running: false,
      pausedRemainingMs: 0,
    };
    expect(resumeTimer(paused, NOW).running).toBe(false);
  });

  it('expires exactly at zero, and not a millisecond before', () => {
    const timer = createTimer('t1', 'Tea', 60_000, NOW);
    expect(isExpired(timer, NOW + 59_999)).toBe(false);
    expect(isExpired(timer, NOW + 60_000)).toBe(true);
  });

  it('settling marks a timer finished exactly at zero', () => {
    const timer = createTimer('t1', 'Tea', 60_000, NOW);
    const settled = settleTimers([timer], NOW + 60_000);
    expect(settled[0]!.fired).toBe(true);
    expect(settled[0]!.running).toBe(false);
    expect(remainingMs(settled[0]!, NOW + 60_000)).toBe(0);
  });

  it('settles several deadlines that passed while the tab slept, in one pass', () => {
    const tea = createTimer('tea', 'Tea', 60_000, NOW);
    const pasta = createTimer('pasta', 'Pasta', 300_000, NOW);
    const settled = settleTimers([tea, pasta], NOW + 600_000);
    expect(settled.map((t) => t.fired)).toEqual([true, true]);
  });

  it('startTimer restarts from the top of the duration', () => {
    const timer = createTimer('t1', 'Tea', 60_000, NOW);
    const restarted = startTimer(timer, NOW + 40_000);
    expect(restarted.endAt).toBe(NOW + 100_000);
    expect(restarted.running).toBe(true);
  });
});

describe('sorting finished timers', () => {
  const NOW = 1_000_000;
  const base = { durationMs: 60_000, pausedRemainingMs: 0, running: false, fired: true };
  // `endAt` is the moment each timer finished.
  const oldFired: Timer = { ...base, id: 'old', label: 'Old', endAt: NOW - 180_000 };
  const newFired: Timer = { ...base, id: 'new', label: 'New', endAt: NOW - 30_000 };
  const pending = createTimer('p', 'Pending', 60_000, NOW);

  it('puts the most recently finished timer first, ahead of the running ones', () => {
    expect(settleTimers([pending, oldFired, newFired], NOW).map((t) => t.id)).toEqual([
      'new',
      'old',
      'p',
    ]);
  });

  it('keeps the running timers in the order they were added', () => {
    const first = createTimer('1', 'First', 60_000, NOW);
    const second = createTimer('2', 'Second', 120_000, NOW);
    expect(settleTimers([first, second], NOW).map((t) => t.id)).toEqual(['1', '2']);
  });

  it('newlyFinished reports only the timers that have just fired', () => {
    expect(newlyFinished([pending], [newFired, pending])).toEqual([newFired]);
    expect(newlyFinished([newFired, pending], [newFired, pending])).toEqual([]);
  });
});

describe('panel mounting', () => {
  it('adds a named timer and reports it through the tool', async () => {
    runToolByIdMock.mockResolvedValue({
      output: JSON.stringify({
        headers: ['Timer', 'Set', 'Remaining', 'State'],
        rows: [['Tea', '03:00', '03:00', 'Running']],
      }),
      render: 'table',
      notes: ['Sound alerts are on.'],
    });
    const root = fixture();
    document.body.append(root);
    mountCountdownTimerPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-duration-input]')!;
    input.value = 'Tea 3m';
    root.querySelector<HTMLButtonElement>('[data-add-timer]')!.click();
    await vi.advanceTimersByTimeAsync(0);

    const rows = root.querySelectorAll<HTMLElement>('[data-timer-list] li');
    expect(rows.length).toBe(1);
    expect(rows[0]!.textContent).toContain('Tea');
    expect(rows[0]!.textContent).toContain('03:00');
    expect(runToolByIdMock).toHaveBeenCalledWith('countdown-timer', {
      text: expect.stringContaining('"label":"Tea"'),
      options: { format: 'clock', sound: true, notify: false },
    });
    expect(root.querySelector<HTMLElement>('[data-timer-summary-wrap]')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-timer-empty]')!.hidden).toBe(true);
    root.remove();
  });

  it('adds a timer from a preset', () => {
    const root = fixture();
    document.body.append(root);
    mountCountdownTimerPanel(root);

    root.querySelector<HTMLButtonElement>('[data-preset="60"]')!.click();
    const rows = root.querySelectorAll<HTMLElement>('[data-timer-list] li');
    expect(rows.length).toBe(1);
    expect(rows[0]!.textContent).toContain('01:00');
    root.remove();
  });

  it('adds a timer from an example chip', () => {
    const root = fixture();
    document.body.append(root);
    mountCountdownTimerPanel(root);

    root.querySelector<HTMLButtonElement>('[data-example]')!.click();
    const rows = root.querySelectorAll<HTMLElement>('[data-timer-list] li');
    expect(rows.length).toBe(1);
    expect(rows[0]!.textContent).toContain('Tea');
    expect(rows[0]!.textContent).toContain('03:00');
    root.remove();
  });

  it('shows a friendly error for an unusable duration and adds nothing', () => {
    const root = fixture();
    document.body.append(root);
    mountCountdownTimerPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-duration-input]')!;
    input.value = 'definitely not a duration';
    root.querySelector<HTMLButtonElement>('[data-add-timer]')!.click();

    const error = root.querySelector<HTMLElement>('[data-timer-error]')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/valid duration/);
    expect(root.querySelectorAll('[data-timer-list] li').length).toBe(0);
    root.remove();
  });

  it('pauses and resumes a timer without losing its remaining time', async () => {
    const root = fixture();
    document.body.append(root);
    mountCountdownTimerPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-duration-input]')!;
    input.value = '60';
    root.querySelector<HTMLButtonElement>('[data-add-timer]')!.click();

    vi.setSystemTime(Date.now() + 10_000);
    root.querySelector<HTMLButtonElement>('[data-timer-list] li button')!.click();
    expect(root.querySelector<HTMLElement>('[data-timer-remaining]')!.textContent).toBe('00:50');
    expect(root.querySelector<HTMLElement>('[data-timer-status]')!.textContent).toMatch(/paused/);

    // Time keeps passing and the panel keeps repainting, but a paused timer
    // must not lose a second of what it had left.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(root.querySelector<HTMLElement>('[data-timer-remaining]')!.textContent).toBe('00:50');

    root.querySelector<HTMLButtonElement>('[data-timer-list] li button')!.click();
    expect(root.querySelector<HTMLElement>('[data-timer-status]')!.textContent).toMatch(/resumed/);
    expect(root.querySelector<HTMLElement>('[data-timer-remaining]')!.textContent).toBe('00:50');
    root.remove();
  });

  it('finishes a timer at its deadline and announces it', async () => {
    const root = fixture();
    document.body.append(root);
    mountCountdownTimerPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-duration-input]')!;
    input.value = '2';
    root.querySelector<HTMLButtonElement>('[data-add-timer]')!.click();

    // A four-second jump — as if the tab had been in the background.
    await vi.advanceTimersByTimeAsync(4_000);

    expect(root.querySelector<HTMLElement>('[data-timer-status]')!.textContent).toMatch(/finished/);
    expect(root.querySelector<HTMLElement>('[data-timer-remaining]')!.textContent).toBe('00:00');
    root.remove();
  });

  it('removes a timer', () => {
    const root = fixture();
    document.body.append(root);
    mountCountdownTimerPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-duration-input]')!;
    input.value = '90s';
    root.querySelector<HTMLButtonElement>('[data-add-timer]')!.click();
    expect(root.querySelectorAll('[data-timer-list] li').length).toBe(1);

    const remove = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-timer-list] li button'),
    ).find((button) => button.textContent === 'Remove')!;
    remove.click();
    expect(root.querySelectorAll('[data-timer-list] li').length).toBe(0);
    root.remove();
  });
});
