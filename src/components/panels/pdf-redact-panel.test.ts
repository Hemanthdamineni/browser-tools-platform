import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runToolById } from '@/lib/worker/client';
import type { FileRunResult } from '@/lib/types';
import {
  addRegion,
  clampRegion,
  defaultRegion,
  displaySize,
  MIN_REGION_PERCENT,
  mountPdfRedactPanel,
  moveRegion,
  outputNameFor,
  parsePlanEntries,
  parseRegions,
  planPages,
  planToJson,
  pointsToPixels,
  regionAt,
  regionToPixels,
  removeRegionAt,
  resizeRegion,
  updateRegionAt,
  type PageRegion,
} from './pdf-redact-panel';

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

const runToolByIdMock = vi.mocked(runToolById);

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                      */
/* -------------------------------------------------------------------------- */

/** A three-page document: 200 × 300 pt each (page 2 is turned). */
const { fakePdf } = vi.hoisted(() => ({
  fakePdf: {
    numPages: 3,
    getPage: async (pageNumber: number) => ({
      rotate: pageNumber === 2 ? 90 : 0,
      getViewport: ({ scale }: { scale: number }) => ({
        width: 200 * scale,
        height: 300 * scale,
      }),
      render: () => ({ promise: Promise.resolve() }),
      cleanup: () => undefined,
    }),
    destroy: async () => undefined,
  },
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({ promise: Promise.resolve(fakePdf) }),
}));

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The markup PdfRedactPanel.astro renders (the hooks the panel binds to). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.pdfRedactPanel = '';
  root.dataset.toolId = 'pdf-redact';
  root.dataset.accept = 'application/pdf';
  root.dataset.multiple = 'false';
  root.setAttribute('aria-label', 'Redact PDF workbench');
  root.innerHTML = `
    <div data-drop role="button" tabindex="0" aria-label="Choose a PDF file or drop it here"></div>
    <ul data-file-list></ul>
    <div data-page-tabs aria-label="PDF pages"></div>
    <div data-stage-wrap hidden>
      <div data-stage>
        <canvas data-preview></canvas>
        <div data-overlay><div data-marquee hidden></div></div>
      </div>
      <button type="button" data-add-region>Add a region</button>
      <button type="button" data-clear-regions>Clear this page</button>
      <ul data-region-list></ul>
    </div>
    <p data-page-status role="status" aria-live="polite"></p>
    <div data-options>
      <textarea data-opt-key="plan" data-opt-type="text">[]</textarea>
      <input data-opt-key="scale" data-opt-type="number" type="number" value="2" aria-label="Rasterisation scale" />
    </div>
    <button type="button" data-run disabled>Redact &amp; export</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg aria-live="polite"></p></div>
    <div data-error role="alert" hidden></div>
    <div data-result-wrap hidden><ul data-outputs></ul><ul data-notes></ul></div>
  `;
  document.body.append(root);
  return root;
}

/** A file that starts with the `%PDF-` header. */
function pdfFile(name = 'contract.pdf'): File {
  return new File([new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n')], name, {
    type: 'application/pdf',
  });
}

/** Hand a file to the panel the way the drop zone does. */
async function chooseFile(root: HTMLElement, file: File): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => {
    expect(root.querySelector<HTMLElement>('[data-stage-wrap]')!.hidden).toBe(false);
  });
}

/** The rectangles currently stored in the plan field for page 1. */
function fieldRegions(root: HTMLElement): PageRegion[] {
  const plan = JSON.parse(root.querySelector<HTMLTextAreaElement>('[data-opt-key="plan"]')!.value);
  const entry = plan.find((item: { page: number }) => item.page === 1);
  return entry ? entry.regions : [];
}

/** The overlay boxes, topmost last. */
function boxes(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-overlay] [data-region]')];
}

/** Press a key on the currently focused region box. */
function press(root: HTMLElement, key: string, options: KeyboardEventInit = {}): void {
  const box = boxes(root).at(-1)!;
  box.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
}

function addPageRegion(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>('[data-add-region]')!.click();
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] } as never);
  // jsdom has no 2D canvas: a stub keeps the page previewer happy.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    canvas: null,
    fillRect: () => {},
    clearRect: () => {},
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('region normalisation and clamping', () => {
  it('keeps a rectangle inside the page and above the minimum size', () => {
    expect(clampRegion({ x: -20, y: -5, w: 40, h: 20 })).toEqual({ x: 0, y: 0, w: 40, h: 20 });
    // The width is clamped to 100 first, then x is clamped to 100 - w.
    expect(clampRegion({ x: 90, y: 95, w: 30, h: 30 })).toEqual({ x: 70, y: 70, w: 30, h: 30 });
    expect(clampRegion({ x: 10, y: 10, w: 0, h: -4 })).toEqual({
      x: 10,
      y: 10,
      w: MIN_REGION_PERCENT,
      h: MIN_REGION_PERCENT,
    });
  });

  it('rounds to two decimals so a rectangle survives a JSON round-trip', () => {
    const region = clampRegion({ x: 12.34567, y: 0.004, w: 33.3333, h: 44.444 });
    expect(region).toEqual({ x: 12.35, y: 0, w: 33.33, h: 44.44 });
    expect(JSON.parse(JSON.stringify(region))).toEqual(region);
  });

  it('moves a rectangle without letting it leave the page', () => {
    expect(moveRegion({ x: 10, y: 10, w: 20, h: 20 }, 5, 5)).toEqual({
      x: 15,
      y: 15,
      w: 20,
      h: 20,
    });
    expect(moveRegion({ x: 10, y: 10, w: 20, h: 20 }, 500, -500)).toEqual({
      x: 80,
      y: 0,
      w: 20,
      h: 20,
    });
  });

  it('resizes from the bottom-right corner up to the page edge', () => {
    expect(resizeRegion({ x: 10, y: 10, w: 20, h: 20 }, 5, 5)).toEqual({
      x: 10,
      y: 10,
      w: 25,
      h: 25,
    });
    // Growing beyond the edge is clamped, never pushed past 100.
    expect(resizeRegion({ x: 10, y: 10, w: 20, h: 20 }, 999, 999)).toEqual({
      x: 10,
      y: 10,
      w: 90,
      h: 90,
    });
    // Shrinking stops at the minimum size.
    expect(resizeRegion({ x: 10, y: 10, w: 20, h: 20 }, -999, -999)).toEqual({
      x: 10,
      y: 10,
      w: MIN_REGION_PERCENT,
      h: MIN_REGION_PERCENT,
    });
  });

  it('adds, patches and removes rectangles without mutating the input', () => {
    const base: PageRegion[] = [{ x: 0, y: 0, w: 10, h: 10 }];
    const added = addRegion(base, { x: 50, y: 50, w: 100, h: 5 });
    expect(added).toHaveLength(2);
    expect(base).toHaveLength(1);
    expect(added[1]).toEqual({ x: 0, y: 50, w: 100 - 0, h: 5 });
    expect(updateRegionAt(base, 0, { x: 90 })[0]!.x).toBe(90);
    expect(removeRegionAt(base, 0)).toEqual([]);
    expect(removeRegionAt(base, 9)).toBe(base);
  });

  it('finds the topmost rectangle under a point', () => {
    const regions: PageRegion[] = [
      { x: 0, y: 0, w: 50, h: 50 },
      { x: 20, y: 20, w: 40, h: 40 },
    ];
    expect(regionAt(regions, 25, 25)).toBe(1);
    expect(regionAt(regions, 5, 5)).toBe(0);
    expect(regionAt(regions, 80, 80)).toBe(-1);
  });

  it('offers a sensible default rectangle', () => {
    expect(defaultRegion()).toEqual({ x: 30, y: 40, w: 40, h: 20 });
  });
});

describe('page geometry: PDF points to rendered pixels', () => {
  it('prints a portrait page at a known scale', () => {
    // Letter, 2 px per point = 144 dpi.
    expect(displaySize(612, 792, 0, 2)).toEqual({ width: 1224, height: 1584 });
    // 72 dpi is one pixel per point.
    expect(displaySize(612, 792, 0, 1)).toEqual({ width: 612, height: 792 });
  });

  it('swaps the axes of a page turned a quarter turn', () => {
    expect(displaySize(612, 792, 90, 1)).toEqual({ width: 792, height: 612 });
    expect(displaySize(612, 792, 270, 2)).toEqual({ width: 1584, height: 1224 });
    // A half turn keeps the axes.
    expect(displaySize(612, 792, 180, 1)).toEqual({ width: 612, height: 792 });
  });

  it('converts a length in points to whole pixels', () => {
    expect(pointsToPixels(72, 2)).toBe(144);
    expect(pointsToPixels(10, 1.5)).toBe(15);
    expect(pointsToPixels(10, 0)).toBe(10); // an invalid scale falls back to 1
  });

  it('maps a percent rectangle onto rendered pixels', () => {
    // On a 1000 × 500 bitmap, x 10% = 100 px, y 20% = 100 px, 30% = 300 px, 40% = 200 px.
    expect(regionToPixels({ x: 10, y: 20, w: 30, h: 40 }, 1000, 500)).toEqual({
      x: 100,
      y: 100,
      w: 300,
      h: 200,
    });
    // A letter page at 2 px/pt: a rectangle near the top-left corner.
    const page = displaySize(612, 792, 0, 2);
    expect(regionToPixels({ x: 0, y: 0, w: 50, h: 10 }, page.width, page.height)).toEqual({
      x: 0,
      y: 0,
      w: 612,
      h: 158,
    });
  });

  it('clips a rectangle to the page and rejects a degenerate one', () => {
    expect(regionToPixels({ x: 90, y: 90, w: 40, h: 40 }, 200, 200)).toEqual({
      x: 180,
      y: 180,
      w: 20,
      h: 20,
    });
    expect(regionToPixels({ x: 0, y: 0, w: 0, h: 10 }, 200, 200)).toBeNull();
    expect(regionToPixels({ x: 120, y: 0, w: 10, h: 10 }, 200, 200)).toBeNull();
    expect(regionToPixels({ x: 0, y: 0, w: 10, h: 10 }, 0, 0)).toBeNull();
  });
});

describe('the page-selection build plan', () => {
  const entries = [
    { page: 2, regions: [{ x: 10, y: 10, w: 20, h: 10 }] },
    { page: 5, regions: [{ x: 40, y: 40, w: 20, h: 20 }] },
  ];

  it('splits the document into rasterised and kept pages', () => {
    const plan = planPages(entries, 6);
    expect(plan.rasterise).toEqual([2, 5]);
    expect(plan.keep).toEqual([1, 3, 4, 6]);
    expect(plan.entries).toEqual(entries);
  });

  it('keeps every page when there is nothing to redact', () => {
    const plan = planPages([], 3);
    expect(plan.rasterise).toEqual([]);
    expect(plan.keep).toEqual([1, 2, 3]);
  });

  it('ignores an entry with no usable rectangles', () => {
    const plan = planPages([{ page: 1, regions: [] }], 3);
    expect(plan.rasterise).toEqual([]);
    expect(plan.keep).toEqual([1, 2, 3]);
  });

  it('merges two entries for the same page instead of rasterising it twice', () => {
    const plan = planPages(
      [
        { page: 4, regions: [{ x: 0, y: 0, w: 10, h: 10 }] },
        { page: 4, regions: [{ x: 50, y: 50, w: 10, h: 10 }] },
      ],
      4,
    );
    expect(plan.rasterise).toEqual([4]);
    expect(plan.entries[0]!.regions).toHaveLength(2);
  });

  it('rejects a page outside the document', () => {
    expect(() => planPages([{ page: 9, regions: [{ x: 0, y: 0, w: 5, h: 5 }] }], 3)).toThrow(
      /has 3 pages/,
    );
    expect(() => planPages([{ page: 0, regions: [] }], 3)).toThrow(/no page number/);
  });

  it('normalises the entries it returns', () => {
    const plan = planPages([{ page: 1, regions: [{ x: -5, y: 0, w: 20, h: 20 }] }], 1);
    expect(plan.entries[0]!.regions[0]).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });
});

describe('plan parsing and serialisation', () => {
  it('parses regions and a whole plan from JSON', () => {
    expect(parseRegions('[{"x":1,"y":2,"w":3,"h":4}]')).toEqual([{ x: 1, y: 2, w: 3, h: 4 }]);
    expect(parseRegions('')).toEqual([]);
    expect(parsePlanEntries('[{"page":1,"regions":[{"x":1,"y":2,"w":3,"h":4}]}]')).toEqual([
      { page: 1, regions: [{ x: 1, y: 2, w: 3, h: 4 }] },
    ]);
  });

  it('reports invalid JSON and a bad shape', () => {
    expect(() => parseRegions('[{')).toThrow(/not valid JSON/);
    expect(() => parseRegions('{}')).toThrow(/JSON array/);
    expect(() => parseRegions('[{"x":"nope","y":0,"w":1,"h":1}]')).toThrow(/not a number/);
    expect(() => parsePlanEntries('nope')).toThrow(/not valid JSON/);
  });

  it('serialises a plan back to JSON the tool understands', () => {
    expect(
      JSON.parse(planToJson([{ page: 3, regions: [{ x: 1.239, y: 0, w: 10, h: 10 }] }])),
    ).toEqual([{ page: 3, regions: [{ x: 1.24, y: 0, w: 10, h: 10 }] }]);
  });

  it('derives the output file name from the source name', () => {
    expect(outputNameFor('contract.pdf')).toBe('contract-redacted.pdf');
    expect(outputNameFor('Report.PDF')).toBe('Report-redacted.pdf');
    expect(outputNameFor('')).toBe('document-redacted.pdf');
  });
});

describe('mountPdfRedactPanel', () => {
  it('refuses a file that is not a PDF and keeps Run disabled', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['hello'], 'notes.txt', { type: 'text/plain' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
    });
    expect(root.querySelector<HTMLElement>('[data-error]')!.textContent).toMatch(/not a PDF/);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
  });

  it('loads a PDF, shows one tab per page and enables Run', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);
    await chooseFile(root, pdfFile());

    expect(root.querySelectorAll('[data-page-tabs] [data-page-tab]')).toHaveLength(3);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-page-status]')!.textContent).toMatch(
      /Page 1 of 3/,
    );
  });

  it('draws a rectangle mirrored into the plan field', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);
    await chooseFile(root, pdfFile());

    addPageRegion(root);

    expect(fieldRegions(root)).toEqual([{ x: 30, y: 40, w: 40, h: 20 }]);
    const box = boxes(root)[0]!;
    expect(box.tabIndex).toBe(0);
    expect(box.getAttribute('aria-pressed')).toBe('true');
    expect(box.style.left).toBe('30%');
    expect(box.getAttribute('aria-label')).toMatch(/Region 1, x 30%, y 40%/);
  });

  it('moves and resizes a rectangle with the keyboard', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);
    await chooseFile(root, pdfFile());
    addPageRegion(root);

    press(root, 'ArrowRight', { shiftKey: true });
    expect(fieldRegions(root)[0]!.x).toBe(35);
    press(root, '+');
    expect(fieldRegions(root)[0]).toMatchObject({ w: 41, h: 21 });
    press(root, 'Delete');
    expect(fieldRegions(root)).toEqual([]);
    expect(boxes(root)).toHaveLength(0);
  });

  it('keeps each page’s rectangles separate when switching pages', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);
    await chooseFile(root, pdfFile());

    addPageRegion(root);
    const tabs = root.querySelectorAll<HTMLButtonElement>('[data-page-tab]');
    tabs[1]!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-page-status]')!.textContent).toMatch(
        /Page 2 of 3/,
      );
    });
    // Page 2 starts empty.
    expect(boxes(root)).toHaveLength(0);
    addPageRegion(root);

    const plan = JSON.parse(
      root.querySelector<HTMLTextAreaElement>('[data-opt-key="plan"]')!.value,
    );
    expect(plan.map((entry: { page: number }) => entry.page)).toEqual([1, 2]);
  });

  it('refuses to run with no rectangles', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);
    await chooseFile(root, pdfFile());

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();

    const error = root.querySelector<HTMLElement>('[data-error]')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/nothing to redact/i);
    expect(runToolByIdMock).not.toHaveBeenCalled();
  });

  it('sends the plan and options to the tool and renders the output', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);
    await chooseFile(root, pdfFile('contract.pdf'));
    addPageRegion(root);
    root.querySelector<HTMLInputElement>('[data-opt-key="scale"]')!.value = '3';

    runToolByIdMock.mockResolvedValue({
      outputs: [
        { filename: 'contract-redacted.pdf', blob: new Blob(['x'], { type: 'application/pdf' }) },
      ],
      warnings: ['Pages 1 were flattened to images and their text layer is gone.'],
      notes: ['Pages 2 and 3 kept their original text.'],
    } satisfies FileRunResult);

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(false);
    });

    expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    const [toolId, payload, runOptions] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('pdf-redact');
    const { files, options } = payload as { files: File[]; options: Record<string, unknown> };
    expect(JSON.parse(String(options.plan))).toEqual([
      { page: 1, regions: [{ x: 30, y: 40, w: 40, h: 20 }] },
    ]);
    expect(options.scale).toBe(3);
    expect(options.outputName).toBe('contract-redacted.pdf');
    expect(files[0]!.name).toBe('contract.pdf');

    expect(root.querySelector('[data-outputs]')!.textContent).toContain('contract-redacted.pdf');
    expect(root.querySelector('[data-notes]')!.textContent).toMatch(/flattened to images/);
    expect(root.querySelector('[data-notes]')!.textContent).toMatch(/kept their original text/);
    expect(runOptions?.signal).toBeInstanceOf(AbortSignal);
  });

  it('surfaces a tool error without publishing a result', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);
    await chooseFile(root, pdfFile());
    addPageRegion(root);
    runToolByIdMock.mockRejectedValue(
      Object.assign(new Error('Nothing to redact.'), { hint: 'Draw at least one rectangle.' }),
    );

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
    });

    expect(root.querySelector('[data-error]')!.textContent).toContain(
      'Draw at least one rectangle.',
    );
    expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(true);
  });

  it('resets the whole panel', async () => {
    const root = fixture();
    mountPdfRedactPanel(root);
    await chooseFile(root, pdfFile());
    addPageRegion(root);

    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-file-list]')!.childElementCount).toBe(0);
    });

    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-stage-wrap]')!.hidden).toBe(true);
    expect(fieldRegions(root)).toEqual([]);
    expect(boxes(root)).toHaveLength(0);
  });
});
