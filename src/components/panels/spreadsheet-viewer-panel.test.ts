import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkBook, WorkSheet } from 'xlsx';
import {
  buildGridViewModel,
  cellDisplayText,
  columnLabel,
  csvEscape,
  describeSheet,
  detectHeaderRow,
  isSpreadsheetName,
  mountSpreadsheetViewerPanel,
  projectSheet,
  resolveSheetName,
  sheetSummaries,
  toCsvText,
  toJsonText,
  worksheetSize,
  worksheetToCells,
} from './spreadsheet-viewer-panel';
import { runToolById } from '@/lib/worker/client';

const runToolByIdMock = vi.mocked(runToolById);

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

/* -------------------------------------------------------------------------- */
/*  Fixtures (built by hand, so the pure logic is tested without SheetJS)      */
/* -------------------------------------------------------------------------- */

/** A 3×3 sheet with a header row, a number and a quoted-name row. */
function peopleSheet(): WorkSheet {
  return {
    '!ref': 'A1:C4',
    A1: { t: 's', v: 'name', w: 'name' },
    B1: { t: 's', v: 'score', w: 'score' },
    C1: { t: 's', v: 'team', w: 'team' },
    A2: { t: 's', v: 'Ada', w: 'Ada' },
    B2: { t: 'n', v: 36, w: '36' },
    C2: { t: 's', v: 'A', w: 'A' },
    A3: { t: 's', v: 'Linus, Jr.', w: 'Linus, Jr.' },
    B3: { t: 'n', v: 54, w: '54' },
    C3: { t: 's', v: 'B', w: 'B' },
    A4: { t: 's', v: 'Grace "Hopper"', w: 'Grace "Hopper"' },
    B4: { t: 'n', v: 81, w: '81' },
    C4: { t: 's', v: 'C', w: 'C' },
  };
}

function book(sheets: Record<string, WorkSheet>, names: string[]): WorkBook {
  return { SheetNames: names, Sheets: sheets } as unknown as WorkBook;
}

/** The markup SpreadsheetViewerPanel.astro renders (the parts the mount uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.spreadsheetViewerPanel = '';
  root.dataset.toolId = 'spreadsheet-viewer';
  root.dataset.accept = '.xlsx,.xls,.ods,.csv';
  root.innerHTML = `
    <div data-drop></div>
    <ul data-file-list></ul>
    <p data-status role="status" aria-live="polite"></p>
    <div data-tabs role="tablist"></div>
    <p data-summary></p>
    <p data-header-hint hidden></p>
    <div data-grid></div>
    <select data-format><option value="csv">CSV</option><option value="json">JSON</option><option value="xlsx">XLSX</option></select>
    <select data-max-rows><option value="50">50</option><option value="200" selected>200</option></select>
    <button type="button" data-run disabled>Convert</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg></p></div>
    <div data-error hidden></div>
    <div data-result-wrap hidden><div data-report hidden></div><ul data-outputs></ul><ul data-notes></ul></div>
  `;
  document.body.append(root);
  return root;
}

/** A file whose bytes are ignored — the mocked xlsx.read returns the fixture. */
function fakeFile(name = 'people.xlsx'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'text/plain' });
}

/** Hand a file to the mounted panel the way the drop zone does. */
async function chooseFile(root: HTMLElement, file: File): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => {
    expect(root.querySelectorAll('[data-tabs] [data-tab]').length).toBeGreaterThan(0);
  });
}

beforeEach(() => {
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/* -------------------------------------------------------------------------- */
/*  Pure helpers                                                               */
/* -------------------------------------------------------------------------- */

describe('isSpreadsheetName', () => {
  it('accepts the extensions SheetJS can read', () => {
    for (const name of ['a.xlsx', 'a.XLSM', 'a.xlsb', 'a.xls', 'a.ods', 'a.csv', 'a.tsv']) {
      expect(isSpreadsheetName(name), name).toBe(true);
    }
  });

  it('rejects other files and names with no extension', () => {
    expect(isSpreadsheetName('notes.txt')).toBe(false);
    expect(isSpreadsheetName('data.json')).toBe(false);
    expect(isSpreadsheetName('report')).toBe(false);
    expect(isSpreadsheetName('')).toBe(false);
  });
});

describe('columnLabel', () => {
  it('wraps past Z into AA, AB, AZ and BA', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(25)).toBe('Z');
    expect(columnLabel(26)).toBe('AA');
    expect(columnLabel(51)).toBe('AZ');
    expect(columnLabel(52)).toBe('BA');
  });
});

describe('cellDisplayText', () => {
  it('prefers formatted text, then the raw value, then empty', () => {
    expect(cellDisplayText({ t: 'n', v: 42, w: '£42.00' })).toBe('£42.00');
    expect(cellDisplayText({ t: 's', v: 'hello' })).toBe('hello');
    expect(cellDisplayText({ t: 'b', v: true })).toBe('true');
    expect(cellDisplayText({ t: 'n', v: 0 })).toBe('0');
    expect(cellDisplayText(undefined)).toBe('');
    expect(cellDisplayText({ t: 'z' } as never)).toBe('');
  });
});

describe('worksheetSize', () => {
  it('reads the used range from the ref', () => {
    expect(worksheetSize({ '!ref': 'A1:C4' } as WorkSheet)).toEqual({ rows: 4, cols: 3 });
    expect(worksheetSize({ '!ref': 'D5' } as WorkSheet)).toEqual({ rows: 5, cols: 4 });
    expect(worksheetSize({} as WorkSheet)).toEqual({ rows: 0, cols: 0 });
  });
});

describe('projectSheet', () => {
  it('returns a capped grid with absolute labels and true size', () => {
    const ws = peopleSheet();
    const p = projectSheet(ws, 2, 2);
    expect(p.cells).toEqual([
      ['name', 'score'],
      ['Ada', '36'],
    ]);
    expect(p.columnLabels).toEqual(['A', 'B']);
    expect(p.rowNumbers).toEqual([1, 2]);
    expect(p.totalRows).toBe(4);
    expect(p.totalCols).toBe(3);
    expect(p.truncated).toBe(true);
    expect(p.truncatedRows).toBe(true);
    expect(p.truncatedCols).toBe(true);
  });

  it('does not truncate when the sheet fits the cap', () => {
    const p = projectSheet(peopleSheet(), 10, 10);
    expect(p.shownRows).toBe(4);
    expect(p.shownCols).toBe(3);
    expect(p.truncated).toBe(false);
  });

  it('always shows at least one row and column', () => {
    const p = projectSheet(peopleSheet(), 0, 0);
    expect(p.shownRows).toBe(1);
    expect(p.shownCols).toBe(1);
  });

  it('handles an empty worksheet', () => {
    const p = projectSheet({} as WorkSheet, 200, 30);
    expect(p.totalRows).toBe(0);
    expect(p.cells).toHaveLength(0);
  });
});

describe('worksheetToCells', () => {
  it('returns the full range uncapped', () => {
    const cells = worksheetToCells(peopleSheet());
    expect(cells).toHaveLength(4);
    expect(cells[3]).toEqual(['Grace "Hopper"', '81', 'C']);
  });
});

describe('detectHeaderRow', () => {
  it('recognises an all-text first row', () => {
    expect(detectHeaderRow(peopleSheet())).toBe(true);
  });

  it('rejects a numeric first row', () => {
    const ws = {
      '!ref': 'A1:B2',
      A1: { t: 'n', v: 1, w: '1' },
      B1: { t: 'n', v: 2, w: '2' },
      A2: { t: 's', v: 'x', w: 'x' },
    } as WorkSheet;
    expect(detectHeaderRow(ws)).toBe(false);
  });

  it('rejects an empty sheet', () => {
    expect(detectHeaderRow({} as WorkSheet)).toBe(false);
  });
});

describe('csvEscape / toCsvText', () => {
  it('quotes only when needed and doubles inner quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,comma')).toBe('"a,comma"');
    expect(csvEscape('a"quote"')).toBe('"a""quote"""');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
  });

  it('drops blank rows and joins with LF', () => {
    const csv = toCsvText([
      ['name', 'score'],
      ['Ada', '36'],
      ['', ''],
      ['Grace "Hopper"', '81'],
    ]);
    expect(csv).toBe('name,score\nAda,36\n"Grace ""Hopper""",81');
  });
});

describe('toJsonText', () => {
  it('uses the first row as headers', () => {
    const json = JSON.parse(toJsonText(worksheetToCells(peopleSheet()))) as Record<
      string,
      string
    >[];
    expect(json).toEqual([
      { name: 'Ada', score: '36', team: 'A' },
      { name: 'Linus, Jr.', score: '54', team: 'B' },
      { name: 'Grace "Hopper"', score: '81', team: 'C' },
    ]);
  });

  it('skips a leading blank row when picking the header', () => {
    const cells = [
      ['', ''],
      ['k', 'v'],
      ['a', '1'],
    ];
    expect(JSON.parse(toJsonText(cells))).toEqual([{ k: 'a', v: '1' }]);
  });

  it('returns an empty array for no rows', () => {
    expect(toJsonText([])).toBe('[]');
    expect(toJsonText([['', '']])).toBe('[]');
  });

  it('names blank headers col1, col2, …', () => {
    expect(
      JSON.parse(
        toJsonText([
          ['', 'b'],
          ['x', 'y'],
        ]),
      ),
    ).toEqual([{ col1: 'x', b: 'y' }]);
  });
});

describe('sheetSummaries / resolveSheetName', () => {
  const wb = book({ People: peopleSheet(), Notes: { '!ref': 'A1:B2' } as WorkSheet }, [
    'People',
    'Notes',
  ]);

  it('lists every sheet with its size', () => {
    expect(sheetSummaries(wb)).toEqual([
      { name: 'People', index: 0, rows: 4, cols: 3 },
      { name: 'Notes', index: 1, rows: 2, cols: 2 },
    ]);
  });

  it('resolves names, 1-based indexes and the blank default', () => {
    expect(resolveSheetName(wb, '')).toBe('People');
    expect(resolveSheetName(wb, 'Notes')).toBe('Notes');
    expect(resolveSheetName(wb, '2')).toBe('Notes');
  });

  it('throws for an unknown sheet', () => {
    expect(() => resolveSheetName(wb, 'Nope')).toThrow(/no sheet called/i);
    expect(() => resolveSheetName(wb, '0')).toThrow(/no sheet called/i);
  });

  it('throws for an empty workbook', () => {
    expect(() => resolveSheetName(book({}, []), '')).toThrow(/no sheets/);
  });
});

describe('buildGridViewModel / describeSheet', () => {
  it('clamps the active index and reports truncation', () => {
    const wb = book({ People: peopleSheet(), Notes: { '!ref': 'A1:B2' } as WorkSheet }, [
      'People',
      'Notes',
    ]);
    const view = buildGridViewModel(wb, 5, 2, 2);
    expect(view.activeIndex).toBe(1);
    expect(view.tabs).toHaveLength(2);
    expect(view.projection.totalRows).toBe(2);

    const big = buildGridViewModel(wb, 0, 2, 2);
    expect(big.projection.totalRows).toBe(4);
    expect(big.projection.shownRows).toBe(2);
    expect(describeSheet(big)).toMatch(
      /Showing the first 2 rows and 2 columns of 4 rows × 3 columns/,
    );
  });

  it('describes an untruncated sheet simply', () => {
    const wb = book({ People: peopleSheet() }, ['People']);
    const view = buildGridViewModel(wb, 0, 100, 100);
    expect(describeSheet(view)).toBe('4 rows × 3 columns.');
  });
});

/* -------------------------------------------------------------------------- */
/*  Mounted panel (SheetJS and the worker are mocked)                          */
/* -------------------------------------------------------------------------- */

// The mount loads SheetJS on demand via `import('xlsx')`; a stub keeps the
// jsdom test from bundling the real 1 MB library.
const { readMock } = vi.hoisted(() => ({
  readMock: vi.fn(),
}));
vi.mock('xlsx', () => ({ read: readMock }));

describe('mountSpreadsheetViewerPanel', () => {
  beforeEach(() => {
    readMock.mockReset();
    readMock.mockReturnValue(book({ People: peopleSheet() }, ['People']));
  });

  it('starts disabled and empty', () => {
    const root = fixture();
    mountSpreadsheetViewerPanel(root);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
    expect(root.querySelectorAll('[data-tabs] [data-tab]')).toHaveLength(0);
  });

  it('renders a tab and a grid when a workbook is dropped', async () => {
    const root = fixture();
    mountSpreadsheetViewerPanel(root);
    await chooseFile(root, fakeFile());

    const tabs = root.querySelectorAll<HTMLElement>('[data-tabs] [data-tab]');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.textContent).toMatch(/People/);
    expect(root.querySelectorAll('[data-grid] table tbody tr')).toHaveLength(4);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-summary]')!.textContent).toMatch(/4 rows/);
  });

  it('switches sheets via the tab bar', async () => {
    const root = fixture();
    mountSpreadsheetViewerPanel(root);
    readMock.mockReturnValue(
      book(
        {
          People: peopleSheet(),
          Notes: { '!ref': 'A1:B2', A1: { t: 's', v: 'k', w: 'k' } } as WorkSheet,
        },
        ['People', 'Notes'],
      ),
    );
    await chooseFile(root, fakeFile());

    const tabs = root.querySelectorAll<HTMLElement>('[data-tabs] [data-tab]');
    expect(tabs).toHaveLength(2);
    (tabs[1] as HTMLElement).click();
    expect(root.querySelectorAll('[data-grid] table tbody tr')).toHaveLength(2);
  });

  it('hands the active sheet and format to the tool worker on run', async () => {
    const root = fixture();
    mountSpreadsheetViewerPanel(root);
    readMock.mockReturnValue(
      book(
        {
          People: peopleSheet(),
          Notes: { '!ref': 'A1:B2', A1: { t: 's', v: 'k', w: 'k' } } as WorkSheet,
        },
        ['People', 'Notes'],
      ),
    );
    await chooseFile(root, fakeFile());
    const format = root.querySelector<HTMLSelectElement>('[data-format]')!;
    format.value = 'json';
    runToolByIdMock.mockResolvedValue({
      outputs: [],
      report: { output: '[]', render: 'text' },
    } as never);

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalled();
    });

    const payload = runToolByIdMock.mock.calls[0]![1] as {
      files: File[];
      options: Record<string, unknown>;
    };
    expect(payload.options.sheet).toBe('People');
    expect(payload.options.format).toBe('json');
  });

  it('shows a friendly error for an unreadable file', async () => {
    readMock.mockImplementation(() => {
      throw new Error('bad');
    });
    const root = fixture();
    mountSpreadsheetViewerPanel(root);
    const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [fakeFile()], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
    });
    expect(root.querySelector<HTMLElement>('[data-error]')!.textContent).toMatch(
      /not a spreadsheet/,
    );
  });
});
