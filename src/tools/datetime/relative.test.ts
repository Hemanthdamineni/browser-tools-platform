import { describe, it, expect } from 'vitest';
import tool from './timestamp.tool';

/**
 * Patch `Date` so `new Date()` / `Date.now()` inside the tool return `now`.
 * `run()` constructs `new Date()` for the relative comparison, so the test can
 * pin "now" without exporting the helper.
 */
function rel(target: Date, now: Date): string {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(now.getTime());
      else super(...(args as ConstructorParameters<typeof RealDate>));
    }
    static override now(): number {
      return now.getTime();
    }
  }
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'Date')!;
  Object.defineProperty(globalThis, 'Date', { ...desc, value: FixedDate });
  try {
    const r = tool.run({
      text: String(Math.floor(target.getTime() / 1000)),
      options: { output: 'relative' },
    }) as { output: string };
    return r.output;
  } finally {
    Object.defineProperty(globalThis, 'Date', desc);
  }
}

describe('timestamp relative output (calendar months)', () => {
  const now = new Date('2026-03-31T12:00:00Z');

  it('59 days across a month boundary is 2 months ago', () => {
    const past = new Date(now.getTime() - 59 * 86400_000); // 2026-01-31
    expect(rel(past, now)).toBe('2 months ago');
  });

  it('30 days inside the same calendar month is 30 days ago', () => {
    const past = new Date(now.getTime() - 30 * 86400_000); // 2026-03-01
    expect(rel(past, now)).toBe('30 days ago');
  });

  it('a 13-month span reads as a year and a month', () => {
    const past = new Date(now.getTime() - 400 * 86400_000);
    expect(rel(past, now)).toMatch(/1 year 1 month/);
  });

  it('exactly 12 months reads as a year', () => {
    const past = new Date(now.getTime() - 365 * 86400_000); // 2025-04-01ish
    expect(rel(past, now)).toMatch(/^1 year/);
  });

  it('hours stay hour-based', () => {
    const past = new Date(now.getTime() - 5 * 3600_000);
    expect(rel(past, now)).toBe('5 hours ago');
  });

  it('future dates use "in"', () => {
    const future = new Date(now.getTime() + 2 * 86400_000);
    expect(rel(future, now)).toBe('in 2 days');
  });
});
