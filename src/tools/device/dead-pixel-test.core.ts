/**
 * Pure dead-pixel test logic.
 *
 * The panel owns the browser APIs — the Fullscreen API, the colour cycling
 * timer and the keyboard listeners — and reads the colours and maths from
 * here so the whole test is testable without a browser. Nothing here touches
 * the DOM or the network; a solid colour is just a named CSS value.
 */

/** One solid colour the panel can fill the screen with. */
export interface TestColour {
  /** A short human label, e.g. "Red". */
  name: string;
  /** A CSS colour the panel applies to the fullscreen background. */
  value: string;
}

/** The eight saturated colours a dead-pixel sweep starts with. */
export const DEAD_PIXEL_BASE_COLORS: TestColour[] = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
  { name: 'Red', value: '#ff0000' },
  { name: 'Green', value: '#00ff00' },
  { name: 'Blue', value: '#0000ff' },
  { name: 'Cyan', value: '#00ffff' },
  { name: 'Magenta', value: '#ff00ff' },
  { name: 'Yellow', value: '#ffff00' },
];

/**
 * A smooth ramp of greys, from pitch black to pure white. Dead or stuck
 * sub-pixels are usually easiest to spot on a solid grey, so the sweep runs
 * the greys after the saturated colours.
 */
export const DEAD_PIXEL_GREY_RAMP: TestColour[] = [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100].map(
  (percent) => {
    const channel = Math.round((percent / 100) * 255);
    const hex = channel.toString(16).padStart(2, '0');
    return { name: `Grey ${percent}%`, value: `#${hex}${hex}${hex}` };
  },
);

/** The full sweep: the saturated colours, then the grey ramp. */
export const DEAD_PIXEL_SEQUENCE: TestColour[] = [
  ...DEAD_PIXEL_BASE_COLORS,
  ...DEAD_PIXEL_GREY_RAMP,
];

/** The action a pressed key should trigger while the test is in fullscreen. */
export type DeadPixelAction = 'next' | 'prev' | 'toggle-auto' | 'exit' | null;

/**
 * Map a keyboard event's `key` to the action it should take. Arrow keys step
 * through the colours (with wraparound), Space toggles the auto-cycle and
 * Escape leaves fullscreen — which is also how the browser's own hint works.
 */
export function keyToAction(key: string): DeadPixelAction {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return 'next';
    case 'ArrowLeft':
    case 'ArrowUp':
      return 'prev';
    case ' ':
    case 'Spacebar':
      return 'toggle-auto';
    case 'Escape':
      return 'exit';
    default:
      return null;
  }
}

/**
 * The index that follows `index` in a sequence of `length` items, wrapping
 * around to the start after the last item. A negative or out-of-range start
 * clamps to the first item.
 */
export function nextIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0 || index >= length) return 0;
  return (index + 1) % length;
}

/**
 * The index that precedes `index` in a sequence of `length` items, wrapping
 * around to the end before the first item. A negative or out-of-range start
 * clamps to the last item.
 */
export function prevIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (index < 0 || index >= length) return length - 1;
  return (index - 1 + length) % length;
}

/**
 * How many milliseconds remain before the auto-cycle should advance again.
 *
 * `lastAdvancedAt` is the `Date.now()` time the colour last changed and
 * `now` the current `Date.now()` time. When the last change is still within
 * the interval, the delay is the time that remains; once the interval has
 * fully elapsed the next advance is due immediately (0), floored so it never
 * goes negative when the timer is slightly late.
 */
export function cycleDelayMs(now: number, lastAdvancedAt: number, intervalMs: number): number {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return 0;
  const elapsed = Math.max(0, now - lastAdvancedAt);
  return Math.max(0, intervalMs - elapsed);
}
