import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  applySettings,
  catchUp,
  formatClock,
  initialState,
  mountPomodoroTimerPanel,
  nextPhase,
  normalizeSettings,
  notificationFor,
  openPhase,
  parseSession,
  parseSettings,
  phaseDurationMs,
  phaseLabel,
  remainingFor,
  remainingMs,
  secondsLeft,
  type PomodoroSettings,
  type PomodoroState,
  type StoredSession,
} from './pomodoro-timer-panel';
import { runToolById } from '@/lib/worker/client';

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({
  runToolById: vi.fn(),
}));

const runToolByIdMock = vi.mocked(runToolById);

/** Settings with non-default, easy-to-verify lengths (minutes). */
const SETTINGS: PomodoroSettings = {
  workMinutes: 2,
  shortBreakMinutes: 1,
  longBreakMinutes: 3,
  cyclesBeforeLongBreak: 3,
  notifyOnPhase: false,
  autoStartBreaks: false,
  autoStartWork: false,
};

/** A running work phase with a deadline `now + 60s`. */
function runningWork(now: number): StoredSession {
  return {
    state: { phase: 'working', completedWork: 1, completedSessions: 4 },
    remaining: 0,
    endAt: now + 60_000,
    running: true,
  };
}

/** The markup PomodoroTimerPanel.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.pomodoroTimerPanel = '';
  root.dataset.toolId = 'pomodoro-timer';
  root.innerHTML = `
    <div data-clock>25:00</div>
    <div data-phase>Ready</div>
    <div data-sessions>0</div>
    <div data-cycle>0 / 4</div>
    <div data-progress></div>
    <button data-start></button>
    <button data-pause></button>
    <button data-reset></button>
    <button data-skip></button>
    <input type="checkbox" data-opt-key="notifyOnPhase">
    <input data-opt-key="workMinutes">
    <input data-opt-key="shortBreakMinutes">
    <input data-opt-key="longBreakMinutes">
    <input data-opt-key="cyclesBeforeLongBreak">
    <div data-status></div>
    <div data-error></div>
    <div data-result-wrap hidden></div>
    <div data-report hidden></div>
    <div data-stats></div>
    <ul data-notes></ul>
  `;
  return root;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('pomodoro-timer state machine', () => {
  it('starts idle and moves to working on the first transition', () => {
    expect(initialState()).toEqual({ phase: 'idle', completedWork: 0, completedSessions: 0 });
    expect(nextPhase(SETTINGS, initialState()).phase).toBe('working');
  });

  it('goes working to short break and counts the completed session', () => {
    const state: PomodoroState = { phase: 'working', completedWork: 1, completedSessions: 4 };
    expect(nextPhase(SETTINGS, state)).toEqual({
      phase: 'shortBreak',
      completedWork: 2,
      completedSessions: 5,
    });
  });

  it('goes working to long break at the threshold, then resets the cycle', () => {
    // cyclesBeforeLongBreak is 3, so the third work phase earns the long break.
    const state: PomodoroState = { phase: 'working', completedWork: 2, completedSessions: 2 };
    expect(nextPhase(SETTINGS, state)).toEqual({
      phase: 'longBreak',
      completedWork: 0,
      completedSessions: 3,
    });
  });

  it('rolls a break back into working without touching the counters', () => {
    const short: PomodoroState = { phase: 'shortBreak', completedWork: 1, completedSessions: 3 };
    expect(nextPhase(SETTINGS, short)).toEqual({
      phase: 'working',
      completedWork: 1,
      completedSessions: 3,
    });
    const long: PomodoroState = { phase: 'longBreak', completedWork: 0, completedSessions: 3 };
    expect(nextPhase(SETTINGS, long)).toEqual({
      phase: 'working',
      completedWork: 0,
      completedSessions: 3,
    });
  });

  it('computes the phase length from the settings', () => {
    expect(phaseDurationMs(SETTINGS, 'working')).toBe(120_000);
    expect(phaseDurationMs(SETTINGS, 'shortBreak')).toBe(60_000);
    expect(phaseDurationMs(SETTINGS, 'longBreak')).toBe(180_000);
    expect(phaseDurationMs(SETTINGS, 'idle')).toBe(0);
  });
});

describe('pomodoro-timer cycle rollover', () => {
  it('advances through a full long-break cycle and back', () => {
    let state = initialState();
    state = nextPhase(SETTINGS, state);
    expect(state.phase).toBe('working');
    state = nextPhase(SETTINGS, state);
    expect(state.phase).toBe('shortBreak');
    state = nextPhase(SETTINGS, state);
    expect(state.phase).toBe('working');
    state = nextPhase(SETTINGS, state);
    expect(state.phase).toBe('shortBreak');
    state = nextPhase(SETTINGS, state);
    expect(state.phase).toBe('working');
    state = nextPhase(SETTINGS, state);
    expect(state.phase).toBe('longBreak');
    expect(state.completedWork).toBe(0);
    expect(state.completedSessions).toBe(3);
    state = nextPhase(SETTINGS, state);
    expect(state.phase).toBe('working');
    expect(state.completedWork).toBe(0);
    expect(state.completedSessions).toBe(3);
  });
});

describe('pomodoro-timer config changes mid-cycle', () => {
  it('leaves a running phase on its original deadline', () => {
    const session = runningWork(1_000_000);
    const changed = applySettings(session, SETTINGS);
    expect(changed).toBe(session);
    expect(changed.endAt).toBe(1_000_000 + 60_000);
  });

  it('keeps what is left of a paused phase, capped at the new length', () => {
    const paused: StoredSession = {
      state: { phase: 'working', completedWork: 0, completedSessions: 0 },
      remaining: 30_000,
      endAt: null,
      running: false,
    };
    const changed = applySettings(paused, SETTINGS);
    expect(changed.remaining).toBe(30_000);
    expect(changed.endAt).toBeNull();
  });

  it('adopts the new work length straight away when idle', () => {
    const idle: StoredSession = {
      state: initialState(),
      remaining: 0,
      endAt: null,
      running: false,
    };
    const changed = applySettings(idle, SETTINGS);
    expect(changed.remaining).toBe(120_000);
    expect(changed.endAt).toBeNull();
  });
});

describe('pomodoro-timer deadline handling', () => {
  it('reports the remaining time from the deadline', () => {
    const now = 1_000_000;
    expect(remainingMs(now + 5000, now)).toBe(5000);
    expect(remainingMs(now - 1000, now)).toBe(0);
    expect(secondsLeft(now + 1500, now)).toBe(2);
  });

  it('completes exactly one phase when the deadline has passed', () => {
    const now = 1_000_000;
    const overdue: StoredSession = {
      state: { phase: 'working', completedWork: 1, completedSessions: 4 },
      remaining: 0,
      endAt: now - 10_000,
      running: true,
    };
    const result = catchUp(overdue, SETTINGS, now);
    expect(result.changed).toBe(true);
    expect(result.session.state.phase).toBe('shortBreak');
    expect(result.session.state.completedWork).toBe(2);
    expect(result.session.state.completedSessions).toBe(5);
  });

  it('does not change a session whose deadline has not passed', () => {
    const now = 1_000_000;
    const current = runningWork(now);
    const result = catchUp(current, SETTINGS, now);
    expect(result.changed).toBe(false);
    expect(result.session).toBe(current);
  });

  it('returns the running deadline, or the stored remainder when paused', () => {
    const now = 1_000_000;
    expect(remainingFor(runningWork(now), now + 10_000)).toBe(50_000);
    const paused: StoredSession = {
      state: { phase: 'working', completedWork: 0, completedSessions: 0 },
      remaining: 12_000,
      endAt: null,
      running: false,
    };
    expect(remainingFor(paused, now)).toBe(12_000);
  });
});

describe('pomodoro-timer formatting and notifications', () => {
  it('formats the clock as MM:SS and H:MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(60_000)).toBe('01:00');
    expect(formatClock(25 * 60_000)).toBe('25:00');
    expect(formatClock(3_661_000)).toBe('1:01:01');
  });

  it('labels phases readably', () => {
    expect(phaseLabel('working')).toBe('Work');
    expect(phaseLabel('shortBreak')).toBe('Short break');
    expect(phaseLabel('longBreak')).toBe('Long break');
    expect(phaseLabel('idle')).toBe('Ready');
  });

  it('writes a notification for a work-to-break and a break-to-work change', () => {
    expect(notificationFor('working', 'shortBreak').title).toBe('Break time');
    expect(notificationFor('working', 'longBreak').body).toMatch(/long/i);
    expect(notificationFor('shortBreak', 'working').title).toBe('Break over');
  });
});

describe('pomodoro-timer settings and persistence', () => {
  it('normalises settings into range and keeps booleans', () => {
    const s = normalizeSettings({
      workMinutes: 0,
      shortBreakMinutes: 99,
      cyclesBeforeLongBreak: 0,
    });
    expect(s.workMinutes).toBe(1);
    expect(s.shortBreakMinutes).toBe(60);
    expect(s.cyclesBeforeLongBreak).toBe(1);
    expect(s.notifyOnPhase).toBe(false);
  });

  it('falls back to defaults for missing or corrupt settings', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[]')).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a session through JSON and rejects bad ones', () => {
    const session = openPhase(
      SETTINGS,
      { phase: 'working', completedWork: 2, completedSessions: 5 },
      1_000_000,
      true,
    );
    const raw = JSON.stringify(session);
    expect(parseSession(raw)).toEqual(session);
    expect(parseSession(null)).toBeNull();
    expect(parseSession('{')).toBeNull();
    expect(parseSession('{"state":{"phase":"nope"}}')).toBeNull();
  });
});

describe('mountPomodoroTimerPanel', () => {
  it('mounts, then advances the phase when the running deadline passes', () => {
    runToolByIdMock.mockResolvedValue({
      output: '{}',
      render: 'table',
      stats: {},
      notes: [],
    } as never);
    const root = fixture();
    const phase = root.querySelector<HTMLElement>('[data-phase]')!;
    const sessions = root.querySelector<HTMLElement>('[data-sessions]')!;
    const clock = root.querySelector<HTMLElement>('[data-clock]')!;

    const now = Date.now();
    const session: StoredSession = {
      state: { phase: 'working', completedWork: 0, completedSessions: 0 },
      remaining: 0,
      endAt: now - 1,
      running: true,
    };
    localStorage.setItem('pomodoro-timer.session', JSON.stringify(session));

    mountPomodoroTimerPanel(root);
    expect(phase.textContent).toBe('Short break');
    expect(sessions.textContent).toBe('1');
    expect(clock.textContent).toMatch(/:/);
  });

  it('starts a fresh idle timer on Start and shows the summary', async () => {
    runToolByIdMock.mockResolvedValue({
      output: JSON.stringify({ headers: ['Setting', 'Value'], rows: [] }),
      render: 'table',
      stats: { phase: 'Work' },
      notes: ['The timer is deadline-based.'],
    } as never);
    const root = fixture();
    const start = root.querySelector<HTMLButtonElement>('[data-start]')!;
    const phase = root.querySelector<HTMLElement>('[data-phase]')!;
    const report = root.querySelector<HTMLElement>('[data-report]')!;
    const wrap = root.querySelector<HTMLElement>('[data-result-wrap]')!;

    mountPomodoroTimerPanel(root);
    expect(report.hidden).toBe(true);
    start.click();
    expect(phase.textContent).toBe('Work');

    // The report is fetched asynchronously; flush the microtask queue.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(report.hidden).toBe(false);
    expect(wrap.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-stats]')!.textContent).toContain('phase');
    expect(root.querySelector<HTMLElement>('[data-notes]')!.textContent).toContain(
      'deadline-based',
    );
  });
});
