import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './spreadsheet-viewer.meta';
import {
  parseFile,
  getSheetNames,
  getSheetData,
  convertToCSV,
  convertToJSON,
  convertToXLSX,
} from './spreadsheet-viewer.core';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  if (!input.files?.[0]) {
    throw new ToolError('No file provided', 'File required');
  }

  const file = input.files[0];
  const { workbook, sheets } = await parseFile(file);

  const sheetName = String(o.sheet);
  let actualSheetName = sheetName;
  if (sheetName === 'auto') {
    actualSheetName = sheets.length > 0 ? sheets[0] : '';
  }
  let data = getSheetData(workbook, actualSheetName);

  const header = Boolean(o.header);
  if (header && data.length > 0) {
    const firstRow = data[0]!;
    const keys = firstRow.map((h: unknown, i: number) => {
      const k = String(h).trim();
      return k || `col${i + 1}`;
    });
    data = data.slice(1).map((row) => keys.map((k, i) => row[i] ?? null));
  }

  let output: string | Blob = '';
  let filename = o.outputName || 'spreadsheet';
  let mime = 'text/plain';

  switch (String(o.format)) {
    case 'csv':
      output = convertToCSV(data);
      mime = 'text/csv';
      filename += '.csv';
      break;
    case 'json':
      output = convertToJSON(data);
      mime = 'application/json';
      filename += '.json';
      break;
    case 'xlsx':
      output = convertToXLSX(data, actualSheetName);
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename += '.xlsx';
      break;
    default:
      output = convertToCSV(data);
      mime = 'text/csv';
      filename += '.csv';
  }

  const outputs: FileRunResult['outputs'] = [
    {
      filename,
      blob: typeof output === 'string' ? new Blob([output], { type: mime }) : output,
      // preview not needed
    },
  ];

  return {
    outputs,
    render: typeof output === 'string' ? 'code' : undefined,
    language: 'csv', // or json
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
