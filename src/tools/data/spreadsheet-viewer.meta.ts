import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'spreadsheet-viewer',
  name: 'Spreadsheet Viewer',
  category: 'data',
  summary:
    'Open XLSX, XLS, ODS or CSV on-device — switch sheets, scan the grid and convert to CSV, JSON or XLSX.',
  description:
    'Drop in a spreadsheet and read it right on your device. Switch between sheets, scan the grid — large files are capped to a preview window — then convert the whole book to CSV, JSON or a fresh XLSX. Parsing and conversion run locally with SheetJS, so nothing is ever uploaded.',
  keywords: [
    'spreadsheet',
    'excel',
    'xlsx',
    'xls',
    'ods',
    'csv',
    'sheet',
    'workbook',
    'viewer',
    'grid',
    'convert',
    'to json',
    'to csv',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept:
    '.xlsx,.xlsm,.xlsb,.xls,.ods,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet,text/csv,text/tab-separated-values,text/plain',
  // The interactive flow — a live sheet switcher and grid preview — cannot be
  // expressed by the generic option form, so the tool opts into its own panel.
  // The options below are the conversion parameters the panel drives; they are
  // read by `run()` through `resolveOptions` and keep the tool usable without
  // the UI.
  panel: 'spreadsheet-viewer',
  options: [
    {
      key: 'sheet',
      label: 'Sheet',
      type: 'text',
      default: '',
      help: 'Sheet to export: its name or a 1-based index (blank = first sheet).',
    },
    {
      key: 'format',
      label: 'Convert to',
      type: 'select',
      default: 'csv',
      choices: [
        { value: 'csv', label: 'CSV' },
        { value: 'json', label: 'JSON' },
        { value: 'xlsx', label: 'XLSX' },
      ],
    },
    {
      key: 'maxRows',
      label: 'Preview rows',
      type: 'number',
      default: 200,
      min: 1,
      max: 1000,
      step: 1,
    },
    {
      key: 'maxCols',
      label: 'Preview columns',
      type: 'number',
      default: 30,
      min: 1,
      max: 200,
      step: 1,
    },
  ],
  examples: [
    { title: 'Open a workbook and switch between its sheets' },
    { title: 'Convert the active sheet to JSON objects', options: { format: 'json' } },
    { title: 'Re-save the whole book as a modern XLSX', options: { format: 'xlsx' } },
    {
      title: 'Export sheet 2 as CSV with a 500-row preview',
      options: { sheet: '2', format: 'csv', maxRows: 500 },
    },
  ],
  related: ['csv-to-json', 'json-to-csv', 'csv-diff', 'csv-to-html'],
  credits: [
    {
      name: 'xlsx (SheetJS)',
      url: 'https://github.com/SheetJS/sheetjs',
      license: 'Apache-2.0',
    },
  ],
  status: 'stable',
};
