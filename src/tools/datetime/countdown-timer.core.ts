/**
 * Pure logic for the countdown-timer tool: parse timer specs and compute
 * remaining time. No DOM, no audio — the tool layer wires those up.
 */

export interface TimerSpec {
  name: string;
  /** Absolute finish time in epoch milliseconds. */
  finishAt: number;
  /** Duration in milliseconds (for display). */
  durationMs: number;
}

export const MS_PER = {
  d: 86_400_000,
  h: 3_600_000,
  m: 60_000,
  s: 1000,
} as const;

/** Parse a human duration like "1h 15m", "90s", "1:30" (mm:ss) or "1:00:00". */
export function parseDurationMs(text: string): number {
  const t = text.trim().toLowerCase();
  if (!t) throw new Error('empty duration');

  // bare seconds
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * MS_PER.s);

  // clock form: [h:]mm:ss
  const clockParts = t.split(':');
  if (clockParts.length === 2 || clockParts.length === 3) {
    if (clockParts.every((p) => /^\d+(\.\d+)?$/.test(p))) {
      const nums = clockParts.map(Number);
      let ms = 0;
      for (const n of nums) ms = ms * 60 + n!;
      return Math.round(ms * MS_PER.s);
    }
  }

  // unit form: sequences of <number><unit> with optional whitespace
  let rest = t;
  let ms = 0;
  const unitRe = /^(\d+(?:\.\d+)?)\s*(days?|hours?|hrs?|minutes?|mins?|seconds?|secs?|[dhms])/;
  let matched = false;
  while (rest.length) {
    rest = rest.replace(/^\s+/, '');
    const m = unitRe.exec(rest);
    if (!m) break;
    matched = true;
    const n = Number(m[1]);
    const unit = m[2]![0]!;
    ms +=
      n * (unit === 'd' ? MS_PER.d : unit === 'h' ? MS_PER.h : unit === 'm' ? MS_PER.m : MS_PER.s);
    rest = rest.slice(m[0].length);
  }
  if (matched && !rest.trim()) return Math.round(ms);

  throw new Error(`cannot parse duration: ${text}`);
}

/** Parse a clock time of day ("14:30" or "14:30:45") into today's epoch ms. */
export function parseTimeOfDay(text: string, now: number): number {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim());
  if (!m) throw new Error(`cannot parse time of day: ${text}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = m[3] !== undefined ? Number(m[3]) : 0;
  if (h > 23 || min > 59 || s > 59) throw new Error(`time out of range: ${text}`);
  const d = new Date(now);
  d.setHours(h, min, s, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1); // next occurrence
  return d.getTime();
}

/**
 * Parse the multi-line input into timer specs.
 * Line forms:  `<name> <duration>`   |   `<name> @ HH:MM`   |   `<duration>`
 * Names default to "Timer N" when omitted. Duplicate names get a suffix.
 */
export function parseTimers(text: string, now: number): TimerSpec[] {
  const specs: TimerSpec[] = [];
  const usedNames = new Set<string>();
  let autoIndex = 1;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    let name: string;
    let rest: string;
    const at = line.indexOf('@');
    if (at >= 0) {
      name = line.slice(0, at).trim();
      rest = line.slice(at + 1).trim();
    } else {
      // split name from duration: the duration starts at the first digit
      const firstDigit = line.search(/[0-9]/);
      if (firstDigit < 0) throw new Error(`no duration in line: ${line}`);
      name = line.slice(0, firstDigit).trim();
      rest = line.slice(firstDigit).trim();
    }

    const finishAt = at >= 0 ? parseTimeOfDay(rest, now) : now + parseDurationMs(rest);
    const durationMs = finishAt - now;
    if (durationMs <= 0) throw new Error(`timer is already in the past: ${line}`);

    let finalName = name || `Timer ${autoIndex}`;
    if (!name) autoIndex++;
    if (usedNames.has(finalName)) {
      let suffix = 2;
      while (usedNames.has(`${finalName} (${suffix})`)) suffix++;
      finalName = `${finalName} (${suffix})`;
    }
    usedNames.add(finalName);
    specs.push({ name: finalName, finishAt, durationMs });
  }

  if (specs.length === 0) throw new Error('no timers given');
  return specs;
}

/** Format remaining milliseconds as HH:MM:SS (rounding up, never negative). */
export function formatRemaining(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export interface TimerStatus extends TimerSpec {
  remainingMs: number;
  remaining: string;
  finished: boolean;
}

/** Compute the status of every timer at a given instant. */
export function statusAt(specs: TimerSpec[], now: number): TimerStatus[] {
  return specs.map((t) => {
    const remainingMs = t.finishAt - now;
    return {
      ...t,
      remainingMs,
      remaining: formatRemaining(remainingMs),
      finished: remainingMs <= 0,
    };
  });
}
