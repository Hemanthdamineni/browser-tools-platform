import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPlan,
  describeOrder,
  describePage,
  insertBlankPage,
  movePage,
  mountPdfOrganizePanel,
  outputNameFor,
  removePage,
  rotatePage,
  type OrganizerPage,
} from './pdf-organize-panel';
import { runToolById } from '@/lib/worker/client';

const runToolByIdMock = vi.mocked(runToolById);

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                      */
/* -------------------------------------------------------------------------- */

/** A three-page document: 200 × 300 pt, no intrinsic rotation. */
const { fakePdf } = vi.hoisted(() => ({
  fakePdf: {
    numPages: 3,
    getPage: async () => ({
      rotate: 0,
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

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({
  runToolById: vi.fn(),
}));

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The markup PdfOrganizePanel.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.fileWorkbench = '';
  root.dataset.pdfOrganizeWorkbench = '';
  root.dataset.toolId = 'pdf-organize';
  root.innerHTML = `
    <div data-drop></div>
    <ul data-file-list></ul>
    <select data-blank-size>
      <option value="a4" selected>A4 portrait</option>
      <option value="a4-landscape">A4 landscape</option>
      <option value="letter">Letter portrait</option>
    </select>
    <button type="button" data-insert-blank disabled>Insert blank page</button>
    <button type="button" data-reset-order disabled>Reset order</button>
    <p data-order-status role="status" aria-live="polite"></p>
    <ul data-grid></ul>
    <button type="button" data-run disabled>Save</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg></p></div>
    <div data-error hidden></div>
    <div data-result-wrap hidden><ul data-outputs></ul><ul data-notes></ul></div>
  `;
  document.body.append(root);
  return root;
}

/** A file that starts with the `%PDF-` header. */
function pdfFile(name = 'report.pdf'): File {
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
    expect(root.querySelectorAll('[data-grid] > li').length).toBeGreaterThan(0);
  });
}

/** The order of the pages currently on the grid, read from the captions. */
function gridOrder(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-grid] > li')).map((item) => {
    const caption = item.querySelector('p')!.textContent ?? '';
    if (caption.includes('Blank page')) return 'blank';
    const match = /Original page (\d+)/.exec(caption);
    return match ? match[1]! : '?';
  });
}

/** Click the action button of the page at `index`. */
function clickAction(root: HTMLElement, index: number, action: string): void {
  const item = root.querySelectorAll<HTMLElement>('[data-grid] > li')[index]!;
  const button = item.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  button.click();
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] } as never);
  // jsdom has no 2D canvas: a stub keeps the thumbnail renderer happy.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    canvas: null,
    fillRect: () => {},
    clearRect: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('organiser plan helpers', () => {
  const pages: OrganizerPage[] = [
    { id: 1, source: 1, rotate: 0, blank: false },
    { id: 2, source: 2, rotate: 0, blank: false },
    { id: 3, source: 3, rotate: 0, blank: false },
  ];

  it('moves a page forwards and backwards', () => {
    expect(movePage(pages, 0, 2).map((page) => page.source)).toEqual([2, 3, 1]);
    expect(movePage(pages, 2, 0).map((page) => page.source)).toEqual([3, 1, 2]);
  });

  it('clamps an out-of-range move and ignores an invalid index', () => {
    expect(movePage(pages, 0, 99).map((page) => page.source)).toEqual([2, 3, 1]);
    expect(movePage(pages, 0, -5).map((page) => page.source)).toEqual([1, 2, 3]);
    expect(movePage(pages, 9, 0)).toBe(pages);
    expect(movePage(pages, -1, 0)).toBe(pages);
  });

  it('does not mutate the original plan', () => {
    const before = pages.map((page) => page.source);
    movePage(pages, 0, 2);
    rotatePage(pages, 0, 90);
    removePage(pages, 0);
    insertBlankPage(pages, 0, 'a4', 9);
    expect(pages.map((page) => page.source)).toEqual(before);
  });

  it('rotates a page in quarter turns', () => {
    expect(rotatePage(pages, 0, 90)[0]!.rotate).toBe(90);
    expect(rotatePage(pages, 0, 180)[0]!.rotate).toBe(180);
    expect(rotatePage(pages, 0, 270)[0]!.rotate).toBe(270);
    expect(rotatePage(pages, 0, -90)[0]!.rotate).toBe(270);
    // A full turn is a no-op.
    expect(rotatePage(pages, 0, 360)[0]!.rotate).toBe(0);
  });

  it('accumulates rotations', () => {
    const turned = rotatePage(rotatePage(pages, 1, 90), 1, 90);
    expect(turned[1]!.rotate).toBe(180);
  });

  it('ignores a rotation of an unknown page', () => {
    expect(rotatePage(pages, 9, 90)).toBe(pages);
  });

  it('deletes a page', () => {
    expect(removePage(pages, 1).map((page) => page.source)).toEqual([1, 3]);
    expect(removePage(pages, 9)).toBe(pages);
  });

  it('inserts a blank page at the requested position', () => {
    const withBlank = insertBlankPage(pages, 1, 'letter', 9);
    expect(withBlank).toHaveLength(4);
    expect(withBlank[1]).toEqual({ id: 9, rotate: 0, blank: true, size: 'letter' });
    expect(withBlank.map((page) => page.source)).toEqual([1, undefined, 2, 3]);
  });

  it('appends a blank page when the position is past the end', () => {
    const withBlank = insertBlankPage(pages, 99, 'a4', 9);
    expect(withBlank[3]!.blank).toBe(true);
  });

  it('builds the JSON plan the tool understands', () => {
    const plan = insertBlankPage(pages, 0, 'a4', 9);
    expect(JSON.parse(buildPlan(plan))).toEqual([
      { rotate: 0, blank: true, size: 'a4' },
      { rotate: 0, blank: false, source: 1 },
      { rotate: 0, blank: false, source: 2 },
      { rotate: 0, blank: false, source: 3 },
    ]);
  });

  it('describes a page and the current order', () => {
    expect(describePage(pages[0]!, 0, 3)).toBe('page 1 of 3');
    expect(describePage({ id: 9, rotate: 0, blank: true, size: 'a4' }, 2, 3)).toBe(
      'blank page 3 of 3',
    );
    expect(describeOrder(pages)).toBe('1, 2, 3');
    expect(describeOrder(insertBlankPage(pages, 1, 'a4', 9))).toBe('1, blank, 2, 3');
    expect(describeOrder([])).toBe('no pages');
  });

  it('derives the output file name from the source name', () => {
    expect(outputNameFor('report.pdf')).toBe('report-organized.pdf');
    expect(outputNameFor('Report.PDF')).toBe('Report-organized.pdf');
    expect(outputNameFor('notes')).toBe('notes-organized.pdf');
    expect(outputNameFor('')).toBe('document-organized.pdf');
  });
});

describe('mountPdfOrganizePanel', () => {
  it('refuses a file that is not a PDF and keeps the run button disabled', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);

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
    expect(root.querySelectorAll('[data-grid] > li')).toHaveLength(0);
  });

  it('shows one thumbnail per page and enables saving', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    expect(root.querySelectorAll('[data-grid] > li')).toHaveLength(3);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-insert-blank]')!.disabled).toBe(false);
    expect(gridOrder(root)).toEqual(['1', '2', '3']);
  });

  it('labels every control for assistive technology', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-grid] button'));
    expect(buttons.length).toBe(15); // 5 buttons per page × 3 pages
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-grid] > li'));
    for (const item of items) {
      expect(item.getAttribute('aria-label')).toBeTruthy();
      const frame = item.querySelector<HTMLElement>('[data-page-focus]')!;
      expect(frame.getAttribute('aria-label')).toMatch(/arrow keys/);
      expect(frame.tabIndex).toBe(0);
    }
  });

  it('moves a page with the move buttons and announces the new order', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    clickAction(root, 0, 'move-right');

    expect(gridOrder(root)).toEqual(['2', '1', '3']);
    const status = root.querySelector<HTMLElement>('[data-order-status]')!.textContent ?? '';
    expect(status).toMatch(/moved to position 2 of 3/);
    expect(status).toMatch(/New order: 2, 1, 3/);
  });

  it('moves a page with the arrow keys', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    const frame = root.querySelectorAll<HTMLElement>('[data-page-focus]')[2]!;
    frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(gridOrder(root)).toEqual(['1', '3', '2']);
    expect(root.querySelector<HTMLElement>('[data-order-status]')!.textContent).toMatch(
      /moved to position 2 of 3/,
    );
  });

  it('moves a page to the start and to the end with Home and End', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    const last = root.querySelectorAll<HTMLElement>('[data-page-focus]')[2]!;
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(gridOrder(root)).toEqual(['3', '1', '2']);

    const first = root.querySelectorAll<HTMLElement>('[data-page-focus]')[0]!;
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(gridOrder(root)).toEqual(['1', '2', '3']);
  });

  it('rotates a page and shows the turn as text', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    clickAction(root, 0, 'rotate-right');
    clickAction(root, 0, 'rotate-right');

    const caption = root.querySelectorAll<HTMLElement>('[data-grid] > li')[0]!.querySelector('p')!;
    expect(caption.textContent).toMatch(/turned 180°/);
  });

  it('rotates a page counter-clockwise', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    clickAction(root, 1, 'rotate-left');
    const caption = root.querySelectorAll<HTMLElement>('[data-grid] > li')[1]!.querySelector('p')!;
    expect(caption.textContent).toMatch(/turned 270°/);
  });

  it('deletes a page', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    clickAction(root, 1, 'delete');

    expect(gridOrder(root)).toEqual(['1', '3']);
    expect(root.querySelector<HTMLElement>('[data-order-status]')!.textContent).toMatch(/deleted/);
  });

  it('inserts a blank page with the chosen size', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    root.querySelector<HTMLSelectElement>('[data-blank-size]')!.value = 'letter';
    root.querySelector<HTMLButtonElement>('[data-insert-blank]')!.click();

    expect(gridOrder(root)).toEqual(['1', '2', '3', 'blank']);
    expect(root.querySelector<HTMLElement>('[data-order-status]')!.textContent).toMatch(
      /blank page was added/,
    );
  });

  it('restores the original order', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    clickAction(root, 0, 'move-right');
    expect(gridOrder(root)).toEqual(['2', '1', '3']);

    root.querySelector<HTMLButtonElement>('[data-reset-order]')!.click();
    expect(gridOrder(root)).toEqual(['1', '2', '3']);
  });

  it('saves the arranged pages through the worker', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile('report.pdf'));

    clickAction(root, 0, 'move-right');
    clickAction(root, 0, 'rotate-right');
    root.querySelector<HTMLSelectElement>('[data-blank-size]')!.value = 'letter';
    root.querySelector<HTMLButtonElement>('[data-insert-blank]')!.click();

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    });

    const [toolId, payload] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('pdf-organize');
    expect(payload.files).toHaveLength(1);
    const options = payload.options as Record<string, string>;
    expect(options.blankSize).toBe('letter');
    expect(options.outputName).toBe('report-organized.pdf');
    expect(JSON.parse(options.pages!)).toEqual([
      { rotate: 90, blank: false, source: 2 },
      { rotate: 0, blank: false, source: 1 },
      { rotate: 0, blank: false, source: 3 },
      { rotate: 0, blank: true, size: 'letter' },
    ]);
  });

  it('shows the error the tool reported and never shows a result', async () => {
    runToolByIdMock.mockRejectedValue(
      Object.assign(new Error('The page plan is empty.'), {
        name: 'Error',
        hint: 'Choose at least one page.',
      }),
    );
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      const error = root.querySelector<HTMLElement>('[data-error]')!;
      expect(error.hidden).toBe(false);
      expect(error.textContent).toMatch(/plan is empty/);
      expect(error.textContent).toMatch(/at least one page/);
    });
    expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(true);
  });

  it('clears everything on reset', async () => {
    const root = fixture();
    mountPdfOrganizePanel(root);
    await chooseFile(root, pdfFile());

    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelectorAll('[data-grid] > li')).toHaveLength(0);
    });
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(true);
  });
});
