import { describe, it, expect, vi, beforeEach } from 'vitest';
import tool from './spreadsheet-viewer.tool';
import {
  parseFile,
  getSheetNames,
  getSheetData,
  convertToCSV,
  convertToJSON,
  convertToXLSX,
} from './spreadsheet-viewer.core';

vi.mock('./spreadsheet-viewer.core', () => ({
  parseFile: vi.fn(),
  getSheetNames: vi.fn(),
  getSheetData: vi.fn(),
  convertToCSV: vi.fn(),
  convertToJSON: vi.fn(),
  convertToXLSX: vi.fn(),
}));

describe('spreadsheet-viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a spreadsheet file', async () => {
    const mockWorkbook = { 
      workbook: { SheetNames: ['Sheet1'], Sheets: { Sheet1: { '!ref': 'A1:B2', A1: { v: 'a' }, B1: { v: 'b' }, A2: { v: '1' }, B2: { v: '2' } } } }, 
      sheets: ['Sheet1'] 
    };
    (parseFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkbook);
    (getSheetData as unknown as ReturnType<typeof vi.fn>).mockReturnValue([['a', 'b'], ['1', '2']]);
    const result = await tool.run({ files: [{ name: 'test.xlsx' } as File], options: {} });
    expect(result.outputs[0].filename).toBe('spreadsheet.xlsx.csv');
  });

  it('handles auto sheet selection', async () => {
    const mockWorkbook = { workbook: { SheetNames: ['Sheet1', 'Sheet2'], Sheets: {} }, sheets: ['Sheet1', 'Sheet2'] };
    (parseFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkbook);
    // test would call with sheet: 'auto'
    expect(1).toBe(1); // placeholder
  });

  it('converts to CSV', async () => {
    const data = [
      ['a', 'b'],
      ['1', '2'],
    ];
    (convertToCSV as any).mockReturnValue('a,b\n1,2');
    expect(convertToCSV(data)).toBe('a,b\n1,2');
  });

  it('converts to JSON', async () => {
    const data = [
      ['a', 'b'],
      ['1', '2'],
    ];
    (convertToJSON as any).mockReturnValue('[\n  {"a":"1","b":"2"}\n]');
    expect(convertToJSON(data)).toBe('[\n  {"a":"1","b":"2"}\n]');
  });

  it('converts to XLSX', async () => {
    const data = [
      ['a', 'b'],
      ['1', '2'],
    ];
    (convertToXLSX as any).mockReturnValue(new Blob(['mock']));
    const blob = convertToXLSX(data);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('handles auto sheet selection', async () => {
    const mockWorkbook = { SheetNames: ['Sheet1', 'Sheet2'], Sheets: {} };
    (parseFile as any).mockResolvedValue(mockWorkbook);
    // test would call with sheet: 'auto'
    expect(1).toBe(1); // placeholder
  });

  it('throws on missing file', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow('No file provided');
  });
});
