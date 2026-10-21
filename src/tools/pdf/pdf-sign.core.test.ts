import { describe, expect, it } from 'vitest';
import {
  aspectOf,
  clampRect,
  defaultPlacement,
  displayPageSize,
  fitSize,
  looksLikePdfBytes,
  normalizeRotation,
  placementForWidth,
  toDisplaySpace,
  toUserSpace,
  visiblePageBox,
  wasClamped,
  type PageBox,
} from './pdf-sign.core';

const A4: PageBox = { x: 0, y: 0, width: 595.28, height: 841.89 };

describe('looksLikePdfBytes', () => {
  const ascii = (text: string) => new TextEncoder().encode(text);

  it('recognises a PDF header', () => {
    expect(looksLikePdfBytes(ascii('%PDF-1.7\n'))).toBe(true);
  });

  it('recognises a header that follows a little junk', () => {
    expect(looksLikePdfBytes(ascii('junk\n%PDF-1.4\n'))).toBe(true);
  });

  it('rejects bytes that are not a PDF', () => {
    expect(looksLikePdfBytes(ascii('not a pdf at all'))).toBe(false);
  });

  it('rejects an empty buffer', () => {
    expect(looksLikePdfBytes(new Uint8Array(0))).toBe(false);
  });

  it('rejects a truncated header', () => {
    expect(looksLikePdfBytes(ascii('%PD'))).toBe(false);
  });

  it('does not confuse a lookalike header for the real one', () => {
    // "%PDG" is not "%PDF-".
    expect(looksLikePdfBytes(ascii('%PDG-1.7'))).toBe(false);
  });
});

describe('normalizeRotation', () => {
  it('snaps any angle to a quarter turn', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(720)).toBe(0);
  });
});

describe('displayPageSize', () => {
  it('swaps the sides for a quarter-turned page', () => {
    expect(displayPageSize(A4, 0)).toEqual({ width: 595.28, height: 841.89 });
    expect(displayPageSize(A4, 180)).toEqual({ width: 595.28, height: 841.89 });
    expect(displayPageSize(A4, 90)).toEqual({ width: 841.89, height: 595.28 });
    expect(displayPageSize(A4, 270)).toEqual({ width: 841.89, height: 595.28 });
  });
});

describe('aspectOf', () => {
  it('divides width by height and survives broken input', () => {
    expect(aspectOf(200, 100)).toBe(2);
    expect(aspectOf(0, 100)).toBe(1);
    expect(aspectOf(100, 0)).toBe(1);
    expect(aspectOf(Number.NaN, 10)).toBe(1);
  });
});

describe('visiblePageBox', () => {
  it('returns the crop box when it sits inside the media box', () => {
    const media = { x: 0, y: 0, width: 400, height: 600 };
    const crop = { x: 50, y: 100, width: 250, height: 300 };
    expect(visiblePageBox(media, crop)).toEqual(crop);
  });

  it('clips a crop box that sticks out of the media box', () => {
    const media = { x: 0, y: 0, width: 400, height: 600 };
    const crop = { x: -50, y: 0, width: 600, height: 900 };
    expect(visiblePageBox(media, crop)).toEqual({ x: 0, y: 0, width: 400, height: 600 });
  });

  it('keeps the crop box when the intersection is empty', () => {
    const media = { x: 0, y: 0, width: 100, height: 100 };
    const crop = { x: 500, y: 500, width: 10, height: 10 };
    expect(visiblePageBox(media, crop)).toEqual(crop);
  });
});

describe('fitSize', () => {
  const page = { width: 600, height: 800 };

  it('derives the height from the aspect ratio', () => {
    expect(fitSize(200, 2, page)).toEqual({ width: 200, height: 100 });
  });

  it('never exceeds the page width', () => {
    expect(fitSize(5000, 2, page)).toEqual({ width: 600, height: 300 });
  });

  it('scales a tall signature down so it still fits', () => {
    // A 1:10 signature 600 wide would be 6000 tall — far past the page.
    const size = fitSize(600, 0.1, page);
    expect(size.height).toBe(800);
    expect(size.width).toBe(80);
    // The ratio survives the shrink.
    expect(size.width / size.height).toBeCloseTo(0.1, 6);
  });

  it('falls back to a square for a broken aspect ratio', () => {
    expect(fitSize(100, 0, page)).toEqual({ width: 100, height: 100 });
    expect(fitSize(100, Number.NaN, page)).toEqual({ width: 100, height: 100 });
  });
});

describe('clampRect', () => {
  const page = { width: 600, height: 800 };

  it('leaves a rectangle that already fits alone', () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 };
    expect(clampRect(rect, page)).toEqual(rect);
    expect(wasClamped(rect, clampRect(rect, page))).toBe(false);
  });

  it('pulls a rectangle that starts off the page back inside', () => {
    const clamped = clampRect({ x: -40, y: 900, width: 100, height: 50 }, page);
    expect(clamped).toEqual({ x: 0, y: 750, width: 100, height: 50 });
    expect(wasClamped({ x: -40, y: 900, width: 100, height: 50 }, clamped)).toBe(true);
  });

  it('shrinks a rectangle that is larger than the page', () => {
    const clamped = clampRect({ x: 0, y: 0, width: 900, height: 1000 }, page);
    expect(clamped).toEqual({ x: 0, y: 0, width: 600, height: 800 });
  });

  it('never produces a negative size', () => {
    const clamped = clampRect({ x: 10, y: 10, width: -50, height: -50 }, page);
    expect(clamped.width).toBe(0);
    expect(clamped.height).toBe(0);
    expect(clamped.x).toBe(10);
    expect(clamped.y).toBe(10);
  });
});

describe('placementForWidth', () => {
  it('derives the height from the signature aspect ratio', () => {
    const placement = placementForWidth(50, 60, 200, 2, { width: 600, height: 800 });
    expect(placement.width).toBe(200);
    expect(placement.height).toBe(100);
    expect(placement.x).toBe(50);
    expect(placement.y).toBe(60);
  });

  it('keeps the signature on the page', () => {
    const placement = placementForWidth(0, 0, 5000, 2, { width: 600, height: 800 });
    expect(placement.width).toBe(600);
    expect(placement.height).toBe(300);
  });

  it('keeps the ratio of a signature that is too tall for the page', () => {
    const placement = placementForWidth(10, 20, 600, 0.1, { width: 600, height: 800 });
    expect(placement.width).toBe(80);
    expect(placement.height).toBe(800);
    expect(placement.x).toBe(10);
    expect(placement.y).toBe(0);
  });
});

describe('defaultPlacement', () => {
  it('sits in the bottom-left corner with a margin', () => {
    const placement = defaultPlacement({ width: 600, height: 800 }, 2, 180);
    expect(placement.width).toBe(180);
    expect(placement.height).toBe(90);
    expect(placement.x).toBe(72);
    expect(placement.y).toBe(800 - 90 - 72);
  });

  it('fits a tiny page', () => {
    const placement = defaultPlacement({ width: 100, height: 100 }, 2, 180);
    expect(placement.width).toBe(100);
    expect(placement.x).toBe(0);
    expect(placement.y).toBe(0);
  });
});

describe('toUserSpace / toDisplaySpace', () => {
  const box: PageBox = { x: 20, y: 30, width: 600, height: 800 };
  const rect = { x: 100, y: 200, width: 180, height: 60 };

  for (const rotation of [0, 90, 180, 270]) {
    it(`round-trips a placement on a ${rotation}° page`, () => {
      const anchor = toUserSpace(rect, box, rotation);
      const back = toDisplaySpace(anchor, box, rotation, {
        width: rect.width,
        height: rect.height,
      });
      expect(back.x).toBeCloseTo(rect.x, 6);
      expect(back.y).toBeCloseTo(rect.y, 6);
      expect(back.width).toBeCloseTo(rect.width, 6);
      expect(back.height).toBeCloseTo(rect.height, 6);
    });
  }

  it('places an unrotated signature in the lower-left of the page', () => {
    const anchor = toUserSpace(rect, box, 0);
    expect(anchor.x).toBeCloseTo(120, 6);
    expect(anchor.y).toBeCloseTo(830 - 260, 6);
    expect(anchor.rotate).toBe(0);
  });

  it('compensates for a rotated page', () => {
    const anchor = toUserSpace(rect, box, 90);
    expect(anchor.rotate).toBe(90);
    expect(anchor.x).toBeCloseTo(260 + 20, 6);
    expect(anchor.y).toBeCloseTo(100 + 30, 6);
  });
});
