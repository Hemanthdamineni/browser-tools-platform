import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountImageCollagePanel } from './image-collage-panel';
import {
  collageCanvas,
  fitRect,
  gridCells,
  moveItem,
  parseOrder,
  previewCanvas,
  readCollageOptions,
} from '@/tools/image/image-collage.core';
import { installImageMock, makeFile, type MockHandle } from '@/tools/image/image-mock';
import { runToolById } from '@/lib/worker/client';

const runToolByIdMock = vi.mocked(runToolById);

let mock: MockHandle | undefined;

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The markup ImageCollage.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.imageCollagePanel = '';
  root.dataset.toolId = 'image-collage';
  root.innerHTML = `
    <div data-drop></div>
    <ul data-order></ul>
    <p data-order-status role="status" aria-live="polite"></p>
    <select data-opt-key="columns" data-opt-type="select">
      <option value="auto" selected>Auto</option>
      <option value="1">1</option>
      <option value="2">2</option>
    </select>
    <input data-opt-key="spacing" data-opt-type="number" value="8" />
    <button type="button" data-reset-order disabled>Reset order</button>
    <canvas data-preview-canvas width="16" height="9"></canvas>
    <p data-preview-status role="status" aria-live="polite"></p>
    <button type="button" data-run disabled>Make collage</button>
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
    expect(root.querySelectorAll('[data-order] > li').length).toBe(files.length);
  });
}

/** The names shown on the order rows, top to bottom. */
function rowNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-order] > li')).map(
    (row) => row.querySelector<HTMLElement>('span:nth-child(2)')!.textContent ?? '',
  );
}

/** Click a row action (move-left / move-right / remove). */
function clickAction(root: HTMLElement, index: number, action: string): void {
  const row = root.querySelectorAll<HTMLElement>('[data-order] > li')[index]!;
  row.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
}

/** The options bag the panel last sent to the tool. */
function sentOptions(): Record<string, unknown> {
  const call = runToolByIdMock.mock.calls.at(-1)!;
  const payload = call[1];
  // The mock is typed as runToolById, whose payload is Record<string, unknown>.
  return ('options' in payload ? payload.options : {}) as Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*  Pure layout + reorder maths                                                */
/* -------------------------------------------------------------------------- */

describe('collage grid geometry', () => {
  it('returns the exact rectangles of a 2×2 grid', () => {
    const { cells, rows } = gridCells(4, 2, 10, 100, 100);
    expect(rows).toBe(2);
    expect(cells).toEqual([
      { x: 0, y: 0, w: 45, h: 45 },
      { x: 55, y: 0, w: 45, h: 45 },
      { x: 0, y: 55, w: 45, h: 45 },
      { x: 55, y: 55, w: 45, h: 45 },
    ]);
  });

  it('returns the exact rectangles of a 3-column grid', () => {
    const { cells, rows } = gridCells(6, 3, 4, 304, 204);
    expect(rows).toBe(2);
    expect(cells).toEqual([
      { x: 0, y: 0, w: 98.66666666666667, h: 100 },
      { x: 102.66666666666667, y: 0, w: 98.66666666666667, h: 100 },
      { x: 205.33333333333334, y: 0, w: 98.66666666666667, h: 100 },
      { x: 0, y: 104, w: 98.66666666666667, h: 100 },
      { x: 102.66666666666667, y: 104, w: 98.66666666666667, h: 100 },
      { x: 205.33333333333334, y: 104, w: 98.66666666666667, h: 100 },
    ]);
  });

  it('letterboxes an image inside its cell', () => {
    expect(fitRect({ x: 0, y: 0, w: 100, h: 50 }, 200, 50)).toEqual({
      x: 0,
      y: 12.5,
      w: 100,
      h: 25,
    });
  });

  it('sizes the full-resolution canvas from the largest source edge', () => {
    expect(collageCanvas(4, 2, 10, 100)).toEqual({ width: 210, height: 210, rows: 2 });
  });

  it('downscales the preview and reports the scale', () => {
    const preview = previewCanvas(4000, 4000, 1_000_000);
    expect(preview.width).toBe(1000);
    expect(preview.height).toBe(1000);
    expect(preview.scale).toBeCloseTo(0.25);
  });

  it('resolves options with validated defaults', () => {
    expect(readCollageOptions({}, 4)).toMatchObject({
      columns: 2,
      spacing: 8,
      background: 'transparent',
      radius: 0,
      border: false,
      format: 'png',
    });
  });
});

describe('reorder operations', () => {
  const slides = [
    { id: 1, source: 0 },
    { id: 2, source: 1 },
    { id: 3, source: 2 },
  ];

  it('parses a placement permutation from the option string', () => {
    expect(parseOrder('2,0,1', 3)).toEqual([2, 0, 1]);
  });

  it('permutes placements without touching the items themselves', () => {
    const first = slides[0]!;
    const moved = moveItem(slides, 0, 2);
    // A new array in a new order…
    expect(moved.map((slide) => slide.id)).toEqual([2, 3, 1]);
    // …but the very same objects, so no pixels move.
    expect(moved[2]).toBe(first);
    expect(slides.map((slide) => slide.id)).toEqual([1, 2, 3]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Panel wiring                                                               */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] } as never);
  // jsdom has no 2D canvas: a stub keeps the preview renderer happy.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillStyle: '',
    clearRect: () => {},
    fillRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    clip: () => {},
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {},
  });
});

afterEach(() => {
  mock?.restore();
  mock = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('mountImageCollagePanel', () => {
  it('lists one row per chosen photo and enables Make collage', async () => {
    mock = installImageMock({ dimensions: [{ width: 40, height: 40 }] });
    const root = fixture();
    mountImageCollagePanel(root);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);

    await chooseFiles(root, [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')]);
    expect(root.querySelectorAll('[data-order] > li')).toHaveLength(3);
    expect(rowNames(root)).toEqual(['a.png', 'b.png', 'c.png']);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
  });

  it('sends the reordered placement to the tool but the files unchanged', async () => {
    mock = installImageMock({ dimensions: [{ width: 40, height: 40 }] });
    const root = fixture();
    mountImageCollagePanel(root);
    const files = [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')];
    await chooseFiles(root, files);

    clickAction(root, 0, 'move-right');
    expect(rowNames(root)).toEqual(['b.png', 'a.png', 'c.png']);

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => expect(runToolByIdMock).toHaveBeenCalled());

    const [toolId, payload] = runToolByIdMock.mock.calls.at(-1)! as [
      string,
      { files: File[]; options: Record<string, unknown> },
    ];
    expect(toolId).toBe('image-collage');
    expect(sentOptions().order).toBe('1,0,2');
    // The payload still carries the original files, in their original order.
    expect(payload.files.map((file) => file.name)).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it('removes a photo and renumbers the order', async () => {
    mock = installImageMock({ dimensions: [{ width: 40, height: 40 }] });
    const root = fixture();
    mountImageCollagePanel(root);
    await chooseFiles(root, [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')]);

    clickAction(root, 1, 'remove');
    await vi.waitFor(() => expect(root.querySelectorAll('[data-order] > li')).toHaveLength(2));
    expect(rowNames(root)).toEqual(['a.png', 'c.png']);

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => expect(runToolByIdMock).toHaveBeenCalled());
    expect(sentOptions().order).toBe('0,1');
    // The mock is typed as runToolById, whose payload is Record<string, unknown>.
    const sentFiles = runToolByIdMock.mock.calls.at(-1)![1].files as File[];
    expect(sentFiles).toHaveLength(2);
  });

  it('restores the original order', async () => {
    mock = installImageMock({ dimensions: [{ width: 40, height: 40 }] });
    const root = fixture();
    mountImageCollagePanel(root);
    await chooseFiles(root, [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')]);

    clickAction(root, 2, 'move-left');
    clickAction(root, 1, 'move-left');
    expect(rowNames(root)).toEqual(['c.png', 'a.png', 'b.png']);

    root.querySelector<HTMLButtonElement>('[data-reset-order]')!.click();
    expect(rowNames(root)).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it('moves a row with the arrow keys', async () => {
    mock = installImageMock({ dimensions: [{ width: 40, height: 40 }] });
    const root = fixture();
    mountImageCollagePanel(root);
    await chooseFiles(root, [makeFile('a.png'), makeFile('b.png')]);

    const row = root.querySelector<HTMLElement>('[data-order] > li')!;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(rowNames(root)).toEqual(['b.png', 'a.png']);
  });

  it('shows a friendly error when a file cannot be decoded', async () => {
    mock = installImageMock({ failDecode: true });
    const root = fixture();
    mountImageCollagePanel(root);
    await chooseFilesFails(root);
    const error = root.querySelector<HTMLElement>('[data-error]')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/could not be opened/i);
  });

  it('clears everything on reset', async () => {
    mock = installImageMock({ dimensions: [{ width: 40, height: 40 }] });
    const root = fixture();
    mountImageCollagePanel(root);
    await chooseFiles(root, [makeFile('a.png'), makeFile('b.png')]);

    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    expect(root.querySelectorAll('[data-order] > li')).toHaveLength(0);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
  });
});

/**
 * Drop a file whose decode always fails. `chooseFiles` waits for rows to appear,
 * so this variant waits for the error box instead.
 */
async function chooseFilesFails(root: HTMLElement): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [makeFile('broken.png')], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => {
    expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
  });
}
