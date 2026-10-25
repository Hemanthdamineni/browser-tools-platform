import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SIZE_LIMIT_BYTES,
  MIN_DELAY_CS,
  MIN_OUTPUT_WIDTH,
  centisecondsToFps,
  describeOrder,
  formatTotalDuration,
  fpsToCentiseconds,
  mountGifMakerPanel,
  moveFrame,
  normalizeDelayCs,
  removeFrame,
  sizeForLimit,
  totalDurationMs,
  type GifFrameEntry,
} from './gif-maker-panel';
import { runToolById } from '@/lib/worker/client';

const runToolByIdMock = vi.mocked(runToolById);

vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** An entry with a stub `File` — the pure helpers never read its bytes. */
function entry(id: number, delayCs = 10, name = `frame-${id}.png`): GifFrameEntry {
  return { id, file: new File([new Uint8Array(4)], name, { type: 'image/png' }), delayCs };
}

function entries(spec: [id: number, delayCs?: number][]): GifFrameEntry[] {
  return spec.map(([id, delay = 10]) => entry(id, delay));
}

/** The markup GifMakerPanel.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.gifMakerPanel = '';
  root.dataset.toolId = 'gif-maker';
  root.dataset.accept = 'image/*';
  root.innerHTML = `
    <div data-drop></div>
    <ul data-file-list></ul>
    <p data-status></p>
    <input type="number" data-fps data-default-value="10" value="10" />
    <button type="button" data-reset-order disabled>Reset order</button>
    <button type="button" data-play disabled>Play</button>
    <p data-timeline-status></p>
    <span data-duration></span>
    <ul data-grid></ul>
    <canvas data-preview-canvas width="16" height="9"></canvas>
    <input type="number" data-opt-key="width" data-opt-type="number" value="480" />
    <input type="number" data-opt-key="sizeLimit" data-opt-type="number" value="4" />
    <input type="number" data-opt-key="loop" data-opt-type="number" value="0" />
    <select data-opt-key="palette" data-opt-type="select"><option value="balanced" selected>balanced</option></select>
    <button type="button" data-run disabled>Make GIF</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg></p></div>
    <div data-error hidden></div>
    <div data-result-wrap hidden><ul data-outputs></ul><ul data-notes></ul></div>
  `;
  document.body.append(root);
  return root;
}

/** Hand files to the panel the way the drop zone does. */
async function chooseFiles(root: HTMLElement, files: File[]): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => {
    expect(root.querySelectorAll('[data-grid] > li').length).toBe(files.length);
  });
}

/** The captions currently shown on the timeline grid, in order. */
function gridCaptions(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-grid] > li')).map(
    (item) => item.querySelector('p')?.textContent ?? '',
  );
}

function clickAction(root: HTMLElement, index: number, action: string): void {
  const item = root.querySelectorAll<HTMLElement>('[data-grid] > li')[index]!;
  item.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
}

function pngFile(name: string): File {
  return new File([new Uint8Array(8)], name, { type: 'image/png' });
}

beforeEach(() => {
  runToolByIdMock.mockReset();
  // jsdom has no image decoder; the panel only needs the dimensions.
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 8, height: 6, close: () => undefined })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/* -------------------------------------------------------------------------- */
/*  Pure helpers                                                              */
/* -------------------------------------------------------------------------- */

describe('moveFrame', () => {
  it('moves a frame forward and backward', () => {
    const frames = entries([[1], [2], [3]]);
    expect(moveFrame(frames, 0, 2).map((f) => f.id)).toEqual([2, 3, 1]);
    expect(moveFrame(frames, 2, 0).map((f) => f.id)).toEqual([3, 1, 2]);
  });

  it('clamps an out-of-range target and ignores a same-spot move', () => {
    const frames = entries([[1], [2], [3]]);
    expect(moveFrame(frames, 0, 99).map((f) => f.id)).toEqual([2, 3, 1]);
    expect(moveFrame(frames, 0, 0)).toBe(frames);
    expect(moveFrame(frames, 5, 0)).toBe(frames);
  });

  it('does not mutate the input', () => {
    const frames = entries([[1], [2]]);
    moveFrame(frames, 0, 1);
    expect(frames.map((f) => f.id)).toEqual([1, 2]);
  });
});

describe('removeFrame', () => {
  it('drops the frame at the index', () => {
    expect(removeFrame(entries([[1], [2], [3]]), 1).map((f) => f.id)).toEqual([1, 3]);
  });

  it('ignores an out-of-range index', () => {
    const frames = entries([[1]]);
    expect(removeFrame(frames, 4)).toBe(frames);
    expect(removeFrame(frames, -1)).toBe(frames);
  });
});

describe('describeOrder', () => {
  it('numbers the frames by their original upload position', () => {
    const original = entries([[1], [2], [3]]);
    const reordered = moveFrame(original, 2, 0); // [3, 1, 2]
    expect(describeOrder(reordered, original)).toBe('3, 1, 2');
    expect(describeOrder([], original)).toBe('no frames');
  });
});

describe('fpsToCentiseconds', () => {
  it('quantises common frame rates to GIF centiseconds', () => {
    expect(fpsToCentiseconds(30)).toBe(3);
    expect(fpsToCentiseconds(24)).toBe(4);
    expect(fpsToCentiseconds(10)).toBe(10);
    expect(fpsToCentiseconds(25)).toBe(4);
    expect(fpsToCentiseconds(2)).toBe(50);
  });

  it('never returns a delay below the minimum', () => {
    expect(fpsToCentiseconds(1000)).toBeGreaterThanOrEqual(MIN_DELAY_CS);
    expect(fpsToCentiseconds(30)).toBeGreaterThanOrEqual(MIN_DELAY_CS);
  });

  it('falls back to 10 fps for a non-finite rate', () => {
    expect(fpsToCentiseconds(Number.NaN)).toBe(10);
  });
});

describe('centisecondsToFps', () => {
  it('reports the effective playback rate', () => {
    expect(centisecondsToFps(3)).toBe(33.33);
    expect(centisecondsToFps(4)).toBe(25);
    expect(centisecondsToFps(10)).toBe(10);
  });
});

describe('normalizeDelayCs', () => {
  it('rounds, clamps and parses string values', () => {
    expect(normalizeDelayCs(10.4, 5)).toBe(10);
    expect(normalizeDelayCs('12', 5)).toBe(12);
    expect(normalizeDelayCs(0, 7)).toBe(MIN_DELAY_CS);
    expect(normalizeDelayCs(-3, 7)).toBe(MIN_DELAY_CS);
    expect(normalizeDelayCs(99999, 7)).toBe(1000);
    expect(normalizeDelayCs('nonsense', 7)).toBe(7);
  });
});

describe('totalDurationMs / formatTotalDuration', () => {
  it('sums the per-frame delays (centiseconds → ms)', () => {
    expect(
      totalDurationMs(
        entries([
          [1, 10],
          [2, 5],
          [3, 20],
        ]),
      ),
    ).toBe(350);
    expect(totalDurationMs([])).toBe(0);
  });

  it('formats the total as a readable duration', () => {
    expect(
      formatTotalDuration(
        entries([
          [1, 10],
          [2, 10],
        ]),
      ),
    ).toBe('200 ms');
    expect(
      formatTotalDuration(
        entries([
          [1, 60],
          [2, 60],
        ]),
      ),
    ).toBe('1.20 s');
  });
});

describe('sizeForLimit', () => {
  it('keeps the target width when there is no limit', () => {
    const size = sizeForLimit(10, 1920, 1080, 480, 128, 0);
    expect(size.width).toBe(480);
    expect(size.height).toBe(270);
  });

  it('downscales until the estimate fits the limit', () => {
    const frameCount = 120;
    const limit = DEFAULT_SIZE_LIMIT_BYTES;
    const size = sizeForLimit(frameCount, 1920, 1080, 1920, 256, limit);
    expect(size.width).toBeLessThan(1920);
    expect(size.estimated).toBeLessThanOrEqual(limit);
    // The aspect ratio is preserved to within a rounding pixel.
    const sourceAspect = 1920 / 1080;
    expect(Math.abs(size.width / size.height - sourceAspect)).toBeLessThan(0.02);
  });

  it('never shrinks below the minimum width', () => {
    const size = sizeForLimit(1000, 4000, 4000, 4000, 256, 1);
    expect(size.width).toBe(MIN_OUTPUT_WIDTH);
  });

  it('returns zero for invalid dimensions', () => {
    expect(sizeForLimit(10, 0, 0, 480, 128, 0)).toEqual({ width: 0, height: 0, estimated: 0 });
  });
});

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

describe('mountGifMakerPanel', () => {
  it('builds a timeline from the chosen files and enables the run button', async () => {
    const root = fixture();
    mountGifMakerPanel(root);
    await chooseFiles(root, [pngFile('a.png'), pngFile('b.png')]);
    expect(gridCaptions(root)).toHaveLength(2);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
    // The caption is written after the thumbnails decode; wait for it to catch up.
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-duration]')!.textContent).toBe('200 ms');
    });
    expect(root.querySelector<HTMLElement>('[data-duration]')!.textContent).toBe('200 ms');
  });

  it('reorders the frames with the move buttons', async () => {
    const root = fixture();
    mountGifMakerPanel(root);
    await chooseFiles(root, [pngFile('a.png'), pngFile('b.png'), pngFile('c.png')]);
    clickAction(root, 2, 'move-left');
    await vi.waitFor(() => {
      expect(gridCaptions(root)[1]).toContain('c.png');
    });
    expect(gridCaptions(root)[2]).toContain('b.png');
  });

  it('removes a frame', async () => {
    const root = fixture();
    mountGifMakerPanel(root);
    await chooseFiles(root, [pngFile('a.png'), pngFile('b.png')]);
    clickAction(root, 0, 'delete');
    await vi.waitFor(() => {
      expect(gridCaptions(root)).toHaveLength(1);
    });
    expect(gridCaptions(root)[0]).toContain('b.png');
  });

  it('applies a uniform frame rate to every frame', async () => {
    const root = fixture();
    mountGifMakerPanel(root);
    await chooseFiles(root, [pngFile('a.png'), pngFile('b.png')]);
    const fps = root.querySelector<HTMLInputElement>('[data-fps]')!;
    fps.value = '30';
    fps.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => {
      const delays = Array.from(root.querySelectorAll<HTMLInputElement>('[data-frame-delay]')).map(
        (input) => input.value,
      );
      expect(delays).toEqual(['3', '3']);
    });
    // 30 fps rounds to 3 cs, which plays back at 33.3 fps.
    // The caption is written after the refreshed timeline renders; wait for it.
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-duration]')!.textContent).toBe('60 ms');
    });
    expect(root.querySelector<HTMLElement>('[data-duration]')!.textContent).toBe('60 ms');
  });

  it('sends the ordered files and per-frame delays to the worker', async () => {
    const root = fixture();
    mountGifMakerPanel(root);
    runToolByIdMock.mockResolvedValue({ outputs: [] });
    await chooseFiles(root, [pngFile('a.png'), pngFile('b.png'), pngFile('c.png')]);
    clickAction(root, 0, 'move-right'); // a.png now second
    await vi.waitFor(() => expect(gridCaptions(root)[1]).toContain('a.png'));
    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => expect(runToolByIdMock).toHaveBeenCalled());

    const [toolId, payload] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('gif-maker');
    // The mock records the raw payload; the panel always passes these shapes.
    const files = payload.files as File[];
    expect(files.map((file) => file.name)).toEqual(['b.png', 'a.png', 'c.png']);
    const options = payload.options as Record<string, string>;
    expect(JSON.parse(options.frameDelays!)).toEqual([10, 10, 10]);
  });

  it('resets the timeline when Reset is clicked', async () => {
    const root = fixture();
    mountGifMakerPanel(root);
    await chooseFiles(root, [pngFile('a.png'), pngFile('b.png')]);
    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    await vi.waitFor(() => expect(gridCaptions(root)).toHaveLength(0));
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
  });
});
