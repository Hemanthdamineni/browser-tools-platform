import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mountDeadPixelPanel,
  readableOn,
} from './dead-pixel-test-panel';
import { runToolById } from '@/lib/worker/client';
import {
  DEAD_PIXEL_SEQUENCE,
  cycleDelayMs,
  keyToAction,
  nextIndex,
  prevIndex,
} from '@/tools/device/dead-pixel-test.core';

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                      */
/* -------------------------------------------------------------------------- */

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({
  runToolById: vi.fn(),
}));

const runToolByIdMock = vi.mocked(runToolById);

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The markup dead-pixel-test.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.deadPixelPanel = '';
  root.dataset.toolId = 'dead-pixel-test';
  root.innerHTML = `
    <div data-dp-stage style="background-color:#000;color:#fff">
      <span data-dp-colour>Black</span>
      <span data-dp-value>#000000</span>
      <span data-dp-step>1 / 17</span>
    </div>
    <button type="button" data-dp-start>Start fullscreen</button>
    <button type="button" data-dp-prev>Previous</button>
    <button type="button" data-dp-next>Next</button>
    <button type="button" data-dp-toggle>Auto-cycle</button>
    <p data-dp-status role="status"></p>
    <p data-dp-hint hidden></p>
    <div data-dp-options>
      <input type="number" data-opt-key="intervalMs" data-opt-type="number" value="5000">
      <input type="checkbox" data-opt-key="autoCycle" data-opt-type="boolean">
    </div>
    <div data-dp-result-wrap hidden><div data-dp-report></div></div>
    <div data-dp-error hidden></div>
  `;
  return root;
}

const query = <T extends Element>(root: HTMLElement, selector: string): T =>
  root.querySelector<T>(selector)!;

/** Force the fake browser into (or out of) fullscreen on the stage. */
function setFullscreen(root: HTMLElement, on: boolean): void {
  const stage = query<HTMLElement>(root, '[data-dp-stage]');
  if (on) {
    Object.defineProperty(document, 'fullscreenElement', {
      value: stage,
      configurable: true,
    });
  } else {
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
  }
  document.dispatchEvent(new Event('fullscreenchange'));
}

/** Click Start and wait for the fake fullscreen promise + change event. */
async function enterFullscreen(root: HTMLElement): Promise<void> {
  query<HTMLButtonElement>(root, '[data-dp-start]').click();
  await Promise.resolve();
  await Promise.resolve();
  setFullscreen(root, true);
}

/* -------------------------------------------------------------------------- */
/*  Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

let originalFullscreen: {
  fullscreenEnabled: boolean;
  fullscreenElement: Element | null;
  requestFullscreen: ((opts?: FullscreenOptions) => Promise<void>) | null;
  exitFullscreen: (() => Promise<void>) | null;
};

beforeEach(() => {
  originalFullscreen = {
    fullscreenEnabled: (document as Document & { fullscreenEnabled: boolean })
      .fullscreenEnabled,
    fullscreenElement: (document as Document & { fullscreenElement: Element | null })
      .fullscreenElement,
    requestFullscreen: document.documentElement.requestFullscreen as ((
      opts?: FullscreenOptions,
    ) => Promise<void>) | null,
    exitFullscreen: document.exitFullscreen as (() => Promise<void>) | null,
  };

  Object.defineProperty(document, 'fullscreenEnabled', {
    value: true,
    configurable: true,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    value: null,
    configurable: true,
  });

  // jsdom has no requestFullscreen; install a stub on every element that
  // grants fullscreen to the element it was called on.
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    value: function requestFullscreen() {
      const el = this as HTMLElement;
      Object.defineProperty(document, 'fullscreenElement', {
        value: el,
        configurable: true,
      });
      return Promise.resolve();
    },
    configurable: true,
  });

  // jsdom also has no exitFullscreen; mimic the browser by clearing the
  // fullscreen element and firing the change event it would fire.
  Object.defineProperty(document, 'exitFullscreen', {
    value: function exitFullscreen() {
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
  vi.clearAllMocks();

  Object.defineProperty(document, 'fullscreenEnabled', {
    value: originalFullscreen.fullscreenEnabled,
    configurable: true,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    value: originalFullscreen.fullscreenElement,
    configurable: true,
  });
  if (originalFullscreen.requestFullscreen) {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      value: originalFullscreen.requestFullscreen,
      configurable: true,
    });
  } else {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)['requestFullscreen'];
  }
  if (originalFullscreen.exitFullscreen) {
    Object.defineProperty(document, 'exitFullscreen', {
      value: originalFullscreen.exitFullscreen,
      configurable: true,
    });
  } else {
    delete (document as unknown as Record<string, unknown>)['exitFullscreen'];
  }
});

/* -------------------------------------------------------------------------- */
/*  Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

describe('dead-pixel-test colour sequence', () => {
  it('starts with the eight saturated colours, then the greys', () => {
    expect(DEAD_PIXEL_SEQUENCE.map((c) => c.name)).toEqual([
      'Black',
      'White',
      'Red',
      'Green',
      'Blue',
      'Cyan',
      'Magenta',
      'Yellow',
      'Grey 0%',
      'Grey 12.5%',
      'Grey 25%',
      'Grey 37.5%',
      'Grey 50%',
      'Grey 62.5%',
      'Grey 75%',
      'Grey 87.5%',
      'Grey 100%',
    ]);
  });

  it('ramps the greys from black to white', () => {
    const grey = DEAD_PIXEL_SEQUENCE[8]!.value;
    const white = DEAD_PIXEL_SEQUENCE[16]!.value;
    expect(grey).toBe('#000000');
    expect(white).toBe('#ffffff');
    expect(DEAD_PIXEL_SEQUENCE[12]!.value).toBe('#808080');
  });
});

describe('dead-pixel-test stepping', () => {
  const length = DEAD_PIXEL_SEQUENCE.length;

  it('steps forward with wraparound', () => {
    expect(nextIndex(0, length)).toBe(1);
    expect(nextIndex(length - 1, length)).toBe(0);
    expect(nextIndex(-1, length)).toBe(0);
    expect(nextIndex(99, length)).toBe(0);
  });

  it('steps backward with wraparound', () => {
    expect(prevIndex(1, length)).toBe(0);
    expect(prevIndex(0, length)).toBe(length - 1);
    expect(prevIndex(-5, length)).toBe(length - 1);
  });
});

describe('dead-pixel-test cycle schedule', () => {
  it('computes the delay until the next auto-advance', () => {
    expect(cycleDelayMs(1000, 0, 5000)).toBe(4000);
    expect(cycleDelayMs(6000, 0, 5000)).toBe(4000);
    expect(cycleDelayMs(5000, 0, 5000)).toBe(5000);
    expect(cycleDelayMs(1000, 2000, 5000)).toBe(0);
  });

  it('refuses a non-positive interval', () => {
    expect(cycleDelayMs(1000, 0, 0)).toBe(0);
    expect(cycleDelayMs(1000, 0, -5)).toBe(0);
  });
});

describe('dead-pixel-test keyboard mapping', () => {
  it('maps arrow keys to stepping', () => {
    expect(keyToAction('ArrowRight')).toBe('next');
    expect(keyToAction('ArrowDown')).toBe('next');
    expect(keyToAction('ArrowLeft')).toBe('prev');
    expect(keyToAction('ArrowUp')).toBe('prev');
  });

  it('maps Space and Escape', () => {
    expect(keyToAction(' ')).toBe('toggle-auto');
    expect(keyToAction('Escape')).toBe('exit');
  });

  it('ignores unrelated keys', () => {
    expect(keyToAction('a')).toBeNull();
    expect(keyToAction('')).toBeNull();
  });
});

describe('readableOn', () => {
  it('chooses a dark label on light colours and white on dark', () => {
    expect(readableOn('#ffffff')).toBe('#000');
    expect(readableOn('#ff0000')).toBe('#fff');
    expect(readableOn('#000000')).toBe('#fff');
    expect(readableOn('#00ffff')).toBe('#000');
  });

  it('falls back to white for an unparsable colour', () => {
    expect(readableOn('nonsense')).toBe('#fff');
  });
});

/* -------------------------------------------------------------------------- */
/*  The mounted panel                                                          */
/* -------------------------------------------------------------------------- */

describe('mountDeadPixelPanel', () => {
  it('shows the first colour ready to sweep', () => {
    const root = fixture();
    mountDeadPixelPanel(root);

    expect(query(root, '[data-dp-colour]').textContent).toBe('Black');
    expect(query(root, '[data-dp-value]').textContent).toBe('#000000');
    expect(query(root, '[data-dp-step]').textContent).toBe(`1 / ${DEAD_PIXEL_SEQUENCE.length}`);
    expect(query<HTMLButtonElement>(root, '[data-dp-toggle]').disabled).toBe(false);
  });

  it('steps to the next colour on the Next button', () => {
    const root = fixture();
    mountDeadPixelPanel(root);

    query<HTMLButtonElement>(root, '[data-dp-next]').click();
    expect(query(root, '[data-dp-colour]').textContent).toBe('White');
    expect(query(root, '[data-dp-step]').textContent).toBe('2 / 17');
  });

  it('wraps from the last colour back to the first', () => {
    const root = fixture();
    mountDeadPixelPanel(root);

    for (let i = 0; i < DEAD_PIXEL_SEQUENCE.length; i += 1) {
      query<HTMLButtonElement>(root, '[data-dp-next]').click();
    }
    expect(query(root, '[data-dp-colour]').textContent).toBe('Black');
  });

  it('steps backward and wraps around the start', () => {
    const root = fixture();
    mountDeadPixelPanel(root);

    query<HTMLButtonElement>(root, '[data-dp-prev]').click();
    expect(query(root, '[data-dp-colour]').textContent).toBe('Grey 100%');
  });

  it('leaves the report hidden until fullscreen ends', async () => {
    const root = fixture();
    mountDeadPixelPanel(root);

    expect(query(root, '[data-dp-result-wrap]').hidden).toBe(true);
    await enterFullscreen(root);
    expect(query(root, '[data-dp-result-wrap]').hidden).toBe(true);
  });

  it('shows the exit hint only while fullscreen', async () => {
    const root = fixture();
    mountDeadPixelPanel(root);

    expect(query(root, '[data-dp-hint]').hidden).toBe(true);
    await enterFullscreen(root);
    expect(query(root, '[data-dp-hint]').hidden).toBe(false);

    setFullscreen(root, false);
    expect(query(root, '[data-dp-hint]').hidden).toBe(true);
  });

  it('steps with the arrow keys while fullscreen', async () => {
    const root = fixture();
    mountDeadPixelPanel(root);
    await enterFullscreen(root);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(query(root, '[data-dp-colour]').textContent).toBe('White');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(query(root, '[data-dp-colour]').textContent).toBe('Black');
  });

  it('toggles the auto-cycle with Space', async () => {
    const root = fixture();
    mountDeadPixelPanel(root);
    await enterFullscreen(root);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(query<HTMLButtonElement>(root, '[data-dp-toggle]').textContent).toBe('Pause auto-cycle');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(query<HTMLButtonElement>(root, '[data-dp-toggle]').textContent).toBe('Auto-cycle');
  });

  it('ignores the sweep keys when not fullscreen', () => {
    const root = fixture();
    mountDeadPixelPanel(root);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(query(root, '[data-dp-colour]').textContent).toBe('Black');
  });

  it('leaves fullscreen when Escape is pressed', async () => {
    const root = fixture();
    mountDeadPixelPanel(root);
    await enterFullscreen(root);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(query(root, '[data-dp-hint]').hidden).toBe(true);
    expect(runToolByIdMock).toHaveBeenCalled();
  });

  it('builds a report from the sweep when fullscreen ends', async () => {
    runToolByIdMock.mockResolvedValue({ output: '[]', render: 'colors' } as never);
    const root = fixture();
    mountDeadPixelPanel(root);
    await enterFullscreen(root);

    query<HTMLButtonElement>(root, '[data-dp-next]').click();
    setFullscreen(root, false);

    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalledWith(
        'dead-pixel-test',
        expect.objectContaining({
          text: expect.stringContaining('"shown"'),
          options: expect.anything(),
        }),
      );
    });
    expect(query(root, '[data-dp-result-wrap]').hidden).toBe(false);
  });

  it('reports an error when fullscreen is unsupported', () => {
    Object.defineProperty(document, 'fullscreenEnabled', {
      value: false,
      configurable: true,
    });
    const root = fixture();
    mountDeadPixelPanel(root);

    query<HTMLButtonElement>(root, '[data-dp-start]').click();
    expect(query(root, '[data-dp-error]').hidden).toBe(false);
    expect(query(root, '[data-dp-error]').textContent).toMatch(/does not support/i);
  });
});