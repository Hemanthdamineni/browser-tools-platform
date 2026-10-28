import type { ToolError } from '@/lib/types';

const XLSX = typeof window !== 'undefined' ? (window as any).XLSX : null;

export interface SpreadsheetWorkbook {
  workbook: unknown;
  sheets: string[];
}

export async function parseFile(file: File): Promise<SpreadsheetWorkbook> {
  if (!XLSX) {
    throw new ToolError(
      'SheetJS not loaded. Make sure public/vendor/xlsx/xlsx.full.min.js is served.',
      'SheetJS missing',
    );
  }

  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve({
          workbook,
          sheets: workbook.SheetNames || [],
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function getSheetNames(workbook: unknown): string[] {
  return (workbook as any).SheetNames || [];
}

export function getSheetData(workbook: unknown, sheetName: string): unknown[][] {
  const sheet = (workbook as any).Sheets?.[sheetName];
  if (!sheet) return [];
  return sheetToArray(sheet);
}

function sheetToArray(sheet: unknown): unknown[][] {
  if (!sheet) return [];
  const ref = (sheet as any)['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const arr: unknown[][] = [];
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row: unknown[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = (sheet as any)[XLSX.utils.encode_cell({ r: R, c: C })];
      row.push(cell ? cell.v : null);
    }
    arr.push(row);
  }
  return arr;
}

export function convertToCSV(data: unknown[][]): string {
  if (!data || data.length === 0) return '';
  return data
    .map((row) =>
      row
        .map((cell) => {
          if (cell === null || cell === undefined) return '';
          let s = String(cell);
          if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(','),
    )
    .join('\n');
}

export function convertToJSON(data: unknown[][]): string {
  if (!data || data.length === 0) return '[]';
  const headers = Array.from({ length: data[0]?.length || 0 }, (_, i) => `col${i + 1}`);
  return JSON.stringify(
    data.map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]!] = row[i] ?? null;
      }
      return obj;
    }),
    null,
    2,
  );
}

export function convertToXLSX(data: unknown[][], sheetName: string = 'Sheet1'): Blob {
  if (!XLSX) throw new ToolError('SheetJS not loaded', 'SheetJS missing');
  if (!data || data.length === 0)
    return new Blob([], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

  const ws = XLSX.utils.aoa_to_sheet(data as any[][]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const b64 = atob(wbout);
  const arr = new Uint8Array(b64.length);
  for (let i = 0; i < b64.length; i++) {
    arr[i] = b64.charCodeAt(i);
  }
  return new Blob([arr], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function parseCsv(text: string): unknown[][] {
  return [];
}
