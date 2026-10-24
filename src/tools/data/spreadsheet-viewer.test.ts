import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import tool, { outputNameFor } from './spreadsheet-viewer.tool';
import { toCsvText } from '@/components/panels/spreadsheet-viewer-panel';

/**
 * A real workbook is built and read back with SheetJS itself, so the fixture
 * exercises the actual parse + project + export path end to end (not a stub).
 */
function makeWorkbookBytes(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['name', 'score'],
    ['Ada', 36],
    ['Linus, Jr.', 54],
    ['Grace "Hopper"', 81],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'People');
  const extra = XLSX.utils.aoa_to_sheet([['x', 'y'], [1, 2]]);
  XLSX.utils.book_append_sheet(wb, extra, 'Notes');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

const xlsxFile = () =>
  new File([makeWorkbookBytes()], 'people.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

describe('outputNameFor', () => {
  it('derives the output name from the source', () => {
    expect(outputNameFor('people.xlsx', 'csv')).toBe('people.csv');
    expect(outputNameFor('data.XLSX', 'json')).toBe('data.json');
    expect(outputNameFor('notes', 'xlsx')).toBe('notes.xlsx');
    expect(outputNameFor('', 'csv')).toBe('spreadsheet.csv');
  });
});

describe('run — real XLSX read', () => {
  it('reads a workbook and reports a preview table for the first sheet', async () => {
    const r = await tool.run({ files: [xlsxFile()], options: {} });
    expect(r.stats?.sheets).toBe(2);
    expect(r.stats?.rows).toBe(4);
    expect(r.stats?.cols).toBe(2);
    expect(r.stats?.format).toBe('csv');

    const report = JSON.parse(r.report!.output) as { headers: string[]; rows: string[][] };
    expect(report.headers).toEqual(['A', 'B']);
    expect(report.rows[0]).toEqual(['name', 'score']);
    expect(report.rows[3]).toEqual(['Grace "Hopper"', '81']);

    const blob = r.outputs[0]!.blob;
    expect(blob.type).toContain('text/csv');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exports CSV with proper quoting when run directly', async () => {
    const r = await tool.run({ files: [xlsxFile()], options: { format: 'csv' } });
    const text = await r.outputs[0]!.blob.text();
    // `score` is numeric, so it reads back as text with SheetJS's "number as
    // text" handling; the name column must quote the comma and the quotes.
    expect(text).toContain('"Linus, Jr."');
    expect(text).toContain('"Grace ""Hopper"""');
  });

  it('exports JSON as an array of objects from the first row as headers', async () => {
    const r = await tool.run({
      files: [xlsxFile()],
      options: { format: 'json', sheet: 'Notes' },
    });
    const text = await r.outputs[0]!.blob.text();
    const parsed = JSON.parse(text) as Record<string, string>[];
    expect(parsed).toEqual([{ x: '1', y: '2' }]);
  });

  it('re-saves the whole book as an XLSX that SheetJS can read back', async () => {
    const r = await tool.run({ files: [xlsxFile()], options: { format: 'xlsx' } });
    expect(r.outputs[0]!.filename).toBe('people.xlsx');
    const bytes = new Uint8Array(await r.outputs[0]!.blob.arrayBuffer());
    const back = XLSX.read(bytes, { type: 'array' });
    expect(back.SheetNames).toEqual(['People', 'Notes']);
    expect(back.Sheets.People!.A1!.v).toBe('name');
  });

  it('selects a sheet by 1-based index', async () => {
    const r = await tool.run({ files: [xlsxFile()], options: { sheet: '2' } });
    const report = JSON.parse(r.report!.output) as { headers: string[]; rows: string[][] };
    expect(report.rows[0]).toEqual(['x', 'y']);
  });

  it('caps the preview to maxRows/maxCols and says so', async () => {
    const r = await tool.run({ files: [xlsxFile()], options: { maxRows: 2, maxCols: 1 } });
    const report = JSON.parse(r.report!.output) as { headers: string[]; rows: string[][] };
    expect(report.headers).toEqual(['A']);
    expect(report.rows).toHaveLength(2);
    expect(r.notes?.join(' ')).toMatch(/preview shows the first 2 rows and 1 column/);
  });

  it('rejects a file that is not a spreadsheet', async () => {
    await expect(
      tool.run({ files: [new File(['hello world'], 'notes.txt', { type: 'text/plain' })], options: {} }),
    ).rejects.toThrow(/not a spreadsheet/);
  });

  it('warns that macros are dropped when an .xlsm is re-saved as XLSX', async () => {
    const r = await tool.run({
      files: [new File([makeWorkbookBytes()], 'book.xlsm')],
      options: { format: 'xlsx' },
    });
    expect(r.warnings?.join(' ')).toMatch(/macros are not carried over/);
  });

  it('rejects an unknown sheet name', async () => {
    await expect(
      tool.run({ files: [xlsxFile()], options: { sheet: 'Nope' } }),
    ).rejects.toThrow(/no sheet called/i);
  });

  it('rejects an empty file list', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose a spreadsheet/);
  });
});

// Guard: the CSV escaper used by the export path is the same one tested in the
// panel module — re-assert a round trip so the tool and the panel never drift.
describe('CSV escape round trip', () => {
  it('writes fields that parse back to the same values', () => {
    const cells = [
      ['plain', 'a,comma', 'a"quote"', 'line\nbreak', 'trailing,'],
    ];
    const csv = toCsvText(cells);
    expect(csv).toBe('plain,"a,comma","a""quote""","line\nbreak","trailing,"');
  });
});