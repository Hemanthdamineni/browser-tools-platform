import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSignaturePad } from './draw';
import { decodeDataUrl, readPngInfo } from './pixels';
import {
  FakeCanvas,
  installCanvasMock,
  type CanvasMockHandle,
} from '../../../test/signature-fakes';

let mock: CanvasMockHandle;

beforeEach(() => {
  mock = installCanvasMock();
});

afterEach(() => {
  mock.restore();
});

/** jsdom has no PointerEvent, so a MouseEvent is dressed up as one. */
function pointer(type: string, x: number, y: number): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event;
}

function drawStroke(canvas: FakeCanvas, points: [number, number][]): void {
  const first = points[0]!;
  canvas.dispatchEvent(pointer('pointerdown', first[0], first[1]));
  for (const [x, y] of points.slice(1)) {
    canvas.dispatchEvent(pointer('pointermove', x, y));
  }
  const last = points[points.length - 1]!;
  canvas.dispatchEvent(pointer('pointerup', last[0], last[1]));
}

describe('createSignaturePad', () => {
  it('starts empty', () => {
    const canvas = new FakeCanvas();
    const pad = createSignaturePad(canvas as unknown as HTMLCanvasElement, {
      width: 400,
      height: 120,
    });
    expect(pad.isEmpty()).toBe(true);
    expect(pad.toAsset()).toBeNull();
  });

  it('turns a stroke into a transparent PNG asset', () => {
    const canvas = new FakeCanvas();
    const changes: boolean[] = [];
    const pad = createSignaturePad(canvas as unknown as HTMLCanvasElement, {
      width: 400,
      height: 120,
      onChange: (hasInk) => changes.push(hasInk),
    });

    drawStroke(canvas, [
      [20, 30],
      [80, 60],
      [140, 40],
    ]);

    expect(pad.isEmpty()).toBe(false);
    expect(changes).toContain(true);

    const asset = pad.toAsset();
    expect(asset).not.toBeNull();
    expect(asset!.mode).toBe('draw');
    expect(asset!.hasAlpha).toBe(true);
    expect(asset!.dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    // The exported PNG really is a PNG and keeps its alpha channel.
    const decoded = decodeDataUrl(asset!.dataUrl);
    expect(decoded.mime).toBe('image/png');
    const info = readPngInfo(decoded.bytes);
    expect(info).not.toBeNull();
    expect(info!.hasAlpha).toBe(true);
    // The ink is trimmed to the stroke, not the whole pad.
    expect(info!.width).toBeLessThan(400);
    expect(info!.width).toBeGreaterThan(100);
    expect(info!.height).toBeLessThan(120);
  });

  it('clears the pad and reports the empty state', () => {
    const canvas = new FakeCanvas();
    const changes: boolean[] = [];
    const pad = createSignaturePad(canvas as unknown as HTMLCanvasElement, {
      width: 200,
      height: 80,
      onChange: (h) => changes.push(h),
    });
    drawStroke(canvas, [
      [10, 10],
      [50, 40],
    ]);
    expect(pad.isEmpty()).toBe(false);
    pad.clear();
    expect(pad.isEmpty()).toBe(true);
    expect(pad.toAsset()).toBeNull();
    expect(changes[changes.length - 1]).toBe(false);
  });

  it('ignores a cancelled stroke', () => {
    const canvas = new FakeCanvas();
    const pad = createSignaturePad(canvas as unknown as HTMLCanvasElement, {
      width: 200,
      height: 80,
    });
    canvas.dispatchEvent(pointer('pointerdown', 10, 10));
    canvas.dispatchEvent(pointer('pointermove', 40, 40));
    canvas.dispatchEvent(pointer('pointercancel', 40, 40));
    // The ink is still on the canvas, but the pad is no longer drawing.
    expect(pad.isEmpty()).toBe(false);
  });

  it('detaches its listeners on destroy', () => {
    const canvas = new FakeCanvas();
    const pad = createSignaturePad(canvas as unknown as HTMLCanvasElement, {
      width: 200,
      height: 80,
    });
    pad.destroy();
    drawStroke(canvas, [
      [10, 10],
      [60, 60],
    ]);
    // Nothing was drawn, so there is no ink to export.
    expect(pad.toAsset()).toBeNull();
  });
});
