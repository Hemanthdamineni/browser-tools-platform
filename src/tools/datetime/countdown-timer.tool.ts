import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './countdown-timer.meta';
import { parseTimers, statusAt, formatRemaining, type TimerStatus } from './countdown-timer.core';

export {
  parseDurationMs,
  parseTimeOfDay,
  parseTimers,
  statusAt,
  formatRemaining,
  type TimerSpec,
  type TimerStatus,
} from './countdown-timer.core';

/* -------------------------------------------------------------------------- */
/*  WebAudio beep + Notification — browser-only helpers                        */
/* -------------------------------------------------------------------------- */

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | undefined {
  const w = globalThis as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/**
 * Play a short three-tone chime through WebAudio. Resolves when the chime is
 * scheduled (not necessarily heard). Throws only if audio is unavailable.
 */
export function playBeep(volume = 0.5): void {
  const Ctor = getAudioCtor();
  if (!Ctor) throw new ToolError('WebAudio is not available in this context.');
  const ctx = new Ctor();
  const start = ctx.currentTime + 0.05;
  [880, 1100, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = start + i * 0.18;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.18);
  });
  // Close the context once the chime has finished so the tab releases audio.
  setTimeout(() => void ctx.close().catch(() => {}), 1200);
}

/** Fire a desktop notification if the API and permission allow it. */
export function notifyFinished(timers: string[]): void {
  if (typeof Notification === 'undefined') return;
  const title =
    timers.length === 1 ? `Timer finished: ${timers[0]}` : `${timers.length} timers finished`;
  const body = timers.length === 1 ? 'Time is up.' : timers.join(', ');
  const fire = () => {
    try {
      new Notification(title, { body, tag: 'countdown-timer' });
    } catch {
      /* Notification construction can throw on some platforms; ignore. */
    }
  };
  if (Notification.permission === 'granted') {
    fire();
  } else if (Notification.permission === 'default') {
    void Notification.requestPermission().then((p) => {
      if (p === 'granted') fire();
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Live timer loop                                                            */
/* -------------------------------------------------------------------------- */

interface ActiveTimer {
  status: TimerStatus;
  beeped: boolean;
  notified: boolean;
}

/**
 * Start watching the given timers. `onTick` receives the statuses whenever any
 * timer finishes or the display changes (once per second). Timestamp-based:
 * every tick recomputes remaining time from the clock, so throttled
 * setTimeout/setInterval in background tabs cannot cause drift.
 * Returns a stop function.
 */
export function startTimers(
  specs: ReturnType<typeof parseTimers>,
  now: number,
  onTick: (statuses: TimerStatus[]) => void,
  opts: { repeatBeep?: boolean; beep?: (name: string) => void } = {},
): () => void {
  const beepFn =
    opts.beep ??
    ((name: string) => {
      void name;
      playBeep();
    });
  const timers: ActiveTimer[] = specs.map((s) => ({
    status: statusAt([s], now)[0]!,
    beeped: false,
    notified: false,
  }));
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    const nowMs = Date.now();
    const statuses = timers.map((t) => {
      t.status = statusAt([t.status], nowMs)[0]!;
      return t.status;
    });
    for (const t of timers) {
      if (t.status.finished && !t.beeped) {
        t.beeped = true;
        try {
          beepFn(t.status.name);
        } catch {
          /* audio unavailable; keep notifying */
        }
        if (opts.repeatBeep) {
          // Keep beeping every second while the loop runs.
          const beepLoop = () => {
            if (stopped) return;
            try {
              beepFn(t.status.name);
            } catch {
              /* audio unavailable; stop trying */
              return;
            }
            setTimeout(beepLoop, 1000);
          };
          beepLoop();
        }
      }
      if (t.status.finished && !t.notified) {
        t.notified = true;
        notifyFinished([t.status.name]);
      }
    }
    onTick(statuses);
    if (statuses.every((s) => s.finished)) {
      stopped = true;
      return;
    }
    // Schedule the next tick so the following second boundary is hit.
    const msIntoSecond = nowMs % 1000;
    setTimeout(tick, 1000 - msIntoSecond);
  };

  tick();
  return () => {
    stopped = true;
  };
}

/* -------------------------------------------------------------------------- */
/*  run() — returns an immediate snapshot; live behavior lives above           */
/* -------------------------------------------------------------------------- */

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };

  const now = Date.now();
  let specs;
  try {
    specs = parseTimers(text, now);
  } catch (e) {
    throw new ToolError(
      e instanceof Error ? e.message : 'Could not read those timers.',
      'One timer per line, e.g. "tea 3m", "eggs 90s", "1:30" or "standup @ 14:30".',
    );
  }

  const statuses = statusAt(specs, now);
  const headers = ['Timer', 'Duration', 'Remaining', 'Status'];
  const rows = statuses.map((t): string[] => [
    t.name,
    formatRemaining(t.durationMs),
    t.remaining,
    t.finished ? 'Done' : 'Running',
  ]);

  const soonest = statuses.reduce((a, b) => (a.finishAt <= b.finishAt ? a : b));
  return {
    output: JSON.stringify({ headers, rows }),
    render: 'table',
    stats: {
      timers: statuses.length,
      next: `${soonest.name} in ${soonest.remaining}`,
      sound: o.repeatBeep ? 'repeat until dismissed' : 'single chime',
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
