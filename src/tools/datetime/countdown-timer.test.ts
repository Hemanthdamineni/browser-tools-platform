import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import tool, {
  parseDurationMs,
  parseTimeOfDay,
  parseTimers,
  statusAt,
  formatRemaining,
  startTimers,
  playBeep,
  notifyFinished,
} from './countdown-timer.tool';
import { ToolError } from '@/lib/types';

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options });

const table = (output: string) => JSON.parse(output) as { headers: string[]; rows: string[][] };
const rowOf = (r: { output: string }, name: string): string[] => {
  const found = table(r.output).rows.find((x) => x[0] === name);
  if (!found) throw new Error(`missing row ${name}`);
  return found;
};

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('parseDurationMs', () => {
  it('parses bare seconds', () => {
    expect(parseDurationMs('90')).toBe(90_000);
    expect(parseDurationMs('1.5')).toBe(1500);
  });

  it('parses unit forms', () => {
    expect(parseDurationMs('1h 30m')).toBe(5_400_000);
    expect(parseDurationMs('1h15m')).toBe(4_500_000);
    expect(parseDurationMs('2 days')).toBe(172_800_000);
    expect(parseDurationMs('45s')).toBe(45_000);
  });

  it('parses clock forms', () => {
    expect(parseDurationMs('01:30')).toBe(90_000); // mm:ss
    expect(parseDurationMs('1:00:00')).toBe(3_600_000);
  });

  it('rejects junk', () => {
    expect(() => parseDurationMs('a while')).toThrow();
    expect(() => parseDurationMs('')).toThrow();
  });
});

describe('parseTimeOfDay', () => {
  it('targets today when still ahead', () => {
    const now = new Date(2026, 5, 1, 10, 0, 0).getTime();
    expect(parseTimeOfDay('14:30', now)).toBe(new Date(2026, 5, 1, 14, 30, 0, 0).getTime());
  });

  it('rolls to tomorrow when already past', () => {
    const now = new Date(2026, 5, 1, 15, 0, 0).getTime();
    expect(parseTimeOfDay('14:30', now)).toBe(new Date(2026, 5, 2, 14, 30, 0, 0).getTime());
  });

  it('rejects bad or out-of-range times', () => {
    const now = Date.now();
    expect(() => parseTimeOfDay('25:00', now)).toThrow();
    expect(() => parseTimeOfDay('noon', now)).toThrow();
  });
});

describe('parseTimers', () => {
  it('parses multiple named timers with unique names', () => {
    const specs = parseTimers('tea 3m\neggs 8m', NOW);
    expect(specs.map((s) => s.name)).toEqual(['tea', 'eggs']);
    expect(specs[0]!.finishAt).toBe(NOW + 180_000);
  });

  it('defaults names and deduplicates', () => {
    const specs = parseTimers('3m\n3m', NOW);
    expect(specs[0]!.name).toBe('Timer 1');
    expect(specs[1]!.name).toBe('Timer 2'); // auto-numbered, always unique
    const dupes = parseTimers('tea 3m\ntea 3m', NOW);
    expect(dupes[1]!.name).toBe('tea (2)');
  });

  it('parses @ time-of-day targets', () => {
    const now = new Date(2026, 5, 1, 10, 0, 0).getTime();
    const specs = parseTimers('standup @ 14:30', now);
    expect(specs[0]!.finishAt).toBe(new Date(2026, 5, 1, 14, 30, 0, 0).getTime());
  });

  it('ignores comments and blank lines', () => {
    expect(parseTimers('\n# note\n2m\n', NOW)).toHaveLength(1);
  });

  it('rolls a same-day earlier @ target to tomorrow and rejects empty input', () => {
    const now = new Date(2026, 5, 1, 15, 0, 0).getTime();
    const specs = parseTimers('x @ 14:30', now);
    expect(specs[0]!.finishAt).toBe(new Date(2026, 5, 2, 14, 30, 0, 0).getTime());
    expect(() => parseTimers('# only a comment', NOW)).toThrow(/no timers/);
    expect(() => parseTimers('no digits here', NOW)).toThrow(/no duration/);
  });
});

describe('statusAt / formatRemaining', () => {
  it('formats remaining time and flags finished timers', () => {
    const specs = parseTimers('a 10s\nb 90s', NOW);
    const at = statusAt(specs, NOW + 85_000);
    expect(at[0]!.remaining).toBe('00:00:00');
    expect(at[0]!.finished).toBe(true);
    expect(at[1]!.remaining).toBe('00:00:05');
    expect(formatRemaining(-5000)).toBe('00:00:00');
    expect(formatRemaining(3_723_000)).toBe('01:02:03');
  });
});

describe('startTimers', () => {
  it('ticks once per second and fires the injected beep on finish', async () => {
    const beep = vi.fn();
    const tick = vi.fn();
    const stop = startTimers(parseTimers('x 2s', NOW), NOW, tick, { beep });
    await vi.advanceTimersByTimeAsync(2500);
    stop();

    expect(tick).toHaveBeenCalled();
    const last = tick.mock.calls.at(-1)![0] as { name: string; finished: boolean }[];
    expect(last[0]!.finished).toBe(true);
    expect(beep).toHaveBeenCalledWith('x');
  });

  it('repeats the beep when repeatBeep is set', async () => {
    const beep = vi.fn();
    const stop = startTimers(parseTimers('x 1s', NOW), NOW, () => {}, { beep, repeatBeep: true });
    await vi.advanceTimersByTimeAsync(2500);
    stop();

    expect(beep.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('stops ticking once every timer is finished', async () => {
    const tick = vi.fn();
    const stop = startTimers(parseTimers('x 1s', NOW), NOW, tick, { beep: () => {} });
    await vi.advanceTimersByTimeAsync(10_000);
    stop();
    // After finish the loop must not keep ticking indefinitely.
    expect(tick.mock.calls.length).toBeLessThan(5);
  });

  it('does not call the real beep when audio is unavailable (default beep throws-safe)', async () => {
    // No AudioContext in this environment: default beep throws, loop must survive.
    const tick = vi.fn();
    const stop = startTimers(parseTimers('x 1s', NOW), NOW, tick);
    await vi.advanceTimersByTimeAsync(2000);
    stop();
    expect(tick).toHaveBeenCalled();
    const last = tick.mock.calls.at(-1)![0] as { finished: boolean }[];
    expect(last[0]!.finished).toBe(true);
  });
});

describe('run', () => {
  it('renders a table snapshot of the timers', async () => {
    const r = await run('tea 3m\neggs 8m');
    expect(r.render).toBe('table');
    expect(table(r.output).headers).toEqual(['Timer', 'Duration', 'Remaining', 'Status']);
    expect(rowOf(r, 'tea')[2]).toBe('00:03:00');
    expect(rowOf(r, 'eggs')[3]).toBe('Running');
    expect(r.stats?.timers).toBe(2);
  });

  it('empty input yields empty output', async () => {
    expect((await run('')).output).toBe('');
  });

  it('raises ToolError on bad input', async () => {
    await expect(run('nonsense line')).rejects.toThrow(ToolError);
  });

  it('targets the next occurrence of a @ time (tomorrow when earlier today)', async () => {
    vi.setSystemTime(new Date(2026, 5, 1, 15, 0, 0).getTime());
    const r = await run('x @ 14:30');
    expect(rowOf(r, 'x')[2]).toBe('23:30:00');
  });
});

describe('playBeep / notifyFinished', () => {
  it('throws ToolError without an AudioContext', () => {
    expect(() => playBeep()).toThrow(ToolError);
  });

  it('notifies immediately when permission is granted', () => {
    const notif = vi.fn();
    class FakeNotification {
      static permission = 'granted';
      constructor(...args: unknown[]) {
        notif(...args);
      }
    }
    const orig = globalThis.Notification;
    (globalThis as { Notification: unknown }).Notification = FakeNotification;
    try {
      notifyFinished(['tea']);
      expect(notif).toHaveBeenCalledTimes(1); // one constructor call per notification
      expect(notif.mock.calls[0]![0]).toBe('Timer finished: tea');
      expect(notif.mock.calls[0]![1]).toMatchObject({ body: 'Time is up.' });
      notifyFinished(['tea', 'eggs']);
      expect(notif).toHaveBeenCalledTimes(2);
    } finally {
      (globalThis as { Notification: unknown }).Notification = orig;
    }
  });

  it('requests permission before notifying when undecided', async () => {
    const notif = vi.fn();
    const requestPermission = vi.fn().mockResolvedValue('granted');
    class FakeNotification {
      static permission = 'default';
      static requestPermission = requestPermission;
      constructor(...args: unknown[]) {
        notif(...args);
      }
    }
    const orig = globalThis.Notification;
    (globalThis as { Notification: unknown }).Notification = FakeNotification;
    try {
      notifyFinished(['tea']);
      await vi.runAllTimersAsync();
      expect(requestPermission).toHaveBeenCalled();
      expect(notif).toHaveBeenCalled();
    } finally {
      (globalThis as { Notification: unknown }).Notification = orig;
    }
  });

  it('does nothing without a Notification API', () => {
    const orig = globalThis.Notification;
    delete (globalThis as { Notification?: unknown }).Notification;
    try {
      expect(() => notifyFinished(['tea'])).not.toThrow();
    } finally {
      (globalThis as { Notification: unknown }).Notification = orig;
    }
  });
});
