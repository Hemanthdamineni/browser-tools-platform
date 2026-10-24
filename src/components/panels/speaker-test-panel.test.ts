import { describe, it, expect } from 'vitest';
import {
  channelLabel,
  clampFrequency,
  formatFrequency,
  frequencyToNote,
  frequencyToSlider,
  gainAndPanForChannel,
  logFrequencySteps,
  parseDuration,
  sliderToFrequency,
} from './speaker-test-panel';

describe('speaker-test channel mapping', () => {
  it('left pans hard left at unity gain', () => {
    expect(gainAndPanForChannel('left')).toEqual({ gain: 1, pan: -1 });
  });

  it('right pans hard right at unity gain', () => {
    expect(gainAndPanForChannel('right')).toEqual({ gain: 1, pan: 1 });
  });

  it('both sits at centre with the equal-power boost so it is as loud as either side', () => {
    const { gain, pan } = gainAndPanForChannel('both');
    expect(pan).toBe(0);
    expect(gain).toBeCloseTo(Math.SQRT2, 10);
  });

  it('labels channels for the report', () => {
    expect(channelLabel('left')).toBe('Left');
    expect(channelLabel('right')).toBe('Right');
    expect(channelLabel('both')).toBe('Both');
  });
});

describe('speaker-test frequency helpers', () => {
  it('clamps out-of-range frequencies and falls back to A4 for garbage', () => {
    expect(clampFrequency(5)).toBe(20);
    expect(clampFrequency(25000)).toBe(20000);
    expect(clampFrequency(Number.NaN)).toBe(440);
    expect(clampFrequency(1000)).toBe(1000);
  });

  it('maps the log slider ends to 20 Hz and 20 kHz', () => {
    expect(sliderToFrequency(0)).toBe(20);
    expect(sliderToFrequency(1)).toBe(20000);
  });

  it('the slider mapping round-trips a known frequency', () => {
    const freq = 440;
    expect(sliderToFrequency(frequencyToSlider(freq))).toBe(440);
  });

  it('a half-open log slider is the geometric mean', () => {
    // Log mid-point is the geometric mean of the endpoints: sqrt(20 * 20000) = 632.5 → 632.
    expect(sliderToFrequency(0.5)).toBe(632);
  });

  it('formats frequencies with Hz or kHz', () => {
    expect(formatFrequency(440)).toBe('440 Hz');
    expect(formatFrequency(1000)).toBe('1 kHz');
    expect(formatFrequency(250)).toBe('250 Hz');
  });

  it('names the nearest note for a frequency', () => {
    expect(frequencyToNote(440)).toBe('A4');
    expect(frequencyToNote(880)).toBe('A5');
    expect(frequencyToNote(261.6)).toBe('C4');
  });
});

describe('speaker-test sweep interpolation', () => {
  it('returns log-spaced steps including both endpoints', () => {
    const steps = logFrequencySteps(100, 10000, 3);
    // Geometric progression: 100, 1000, 10000.
    expect(steps).toEqual([100, 1000, 10000]);
  });

  it('keeps adjacent ratios equal on a log scale', () => {
    const steps = logFrequencySteps(20, 20000, 9);
    const expected = Math.pow(1000, 1 / 8);
    for (let i = 1; i < steps.length; i++) {
      // Integer rounding moves each ratio by well under a tenth.
      expect(steps[i]! / steps[i - 1]!).toBeCloseTo(expected, 1);
    }
  });

  it('returns a single step for a request of one', () => {
    expect(logFrequencySteps(440, 880, 1)).toEqual([440]);
  });

  it('clamps the endpoints into the testable range', () => {
    const steps = logFrequencySteps(2, 90000, 3);
    expect(steps[0]).toBe(20);
    expect(steps[steps.length - 1]).toBe(20000);
  });
});

describe('speaker-test duration parsing', () => {
  it('reads seconds, milliseconds and minutes with a unit', () => {
    expect(parseDuration('2s')).toBe(2000);
    expect(parseDuration('1500ms')).toBe(1500);
    expect(parseDuration('0.5m')).toBe(30000);
  });

  it('treats a bare number string as seconds and a number as milliseconds', () => {
    expect(parseDuration('3')).toBe(3000);
    expect(parseDuration(1250)).toBe(1250);
  });

  it('falls back for unparseable or empty input', () => {
    expect(parseDuration('')).toBe(3000);
    expect(parseDuration('loud')).toBe(3000);
    expect(parseDuration(undefined)).toBe(3000);
  });

  it('clamps out-of-range durations into the safe window', () => {
    expect(parseDuration('0.01s')).toBe(250);
    expect(parseDuration('2m')).toBe(30000);
  });
});