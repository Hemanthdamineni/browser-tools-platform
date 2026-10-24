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
  article: [
    {
      heading: 'What it opens',
      body: 'SheetJS detects the format from the file contents, so XLSX, the legacy XLS binary, LibreOffice ODS and plain CSV all open the same way. A workbook with several tabs shows them as a tab bar, and the size beside each name tells you how big it is.',
    },
    {
      heading: 'A preview window, not a smaller export',
      body: 'A sheet can hold a million rows, and drawing them all would lock up the tab, so the grid shows the first 200 rows and 30 columns by default — pick a larger window from the row menu if you need more. The summary line reports the sheet’s real size, and the exports use every row.',
    },
    {
      heading: 'Dates and numbers read as they do in the app',
      body: 'Each cell is shown using the text the spreadsheet itself computed, so a currency cell stays “£1,250.00” and a date keeps the file’s own format instead of turning into a serial number. The exports carry that same text, so a downloaded CSV matches your spreadsheet app.',
    },
    {
      heading: 'Converting a sheet',
      body: 'CSV is written to RFC 4180: fields are quoted only when they hold a comma, a quote or a line break, and inner quotes are doubled. JSON becomes an array of objects keyed by the first row, which is what most APIs want. Choosing XLSX re-saves the whole workbook; VBA macros are not carried over.',
    },
    {
      heading: 'Nothing leaves the tab',
      body: 'The workbook is parsed and the converted file built entirely in your browser — the parser, the grid and the worker all come from this page. Nothing reaches a server, and the tool works offline once loaded.',
    },
  ],
  faq: [
    {
      q: 'Which file types can I open?',
      a: 'XLSX, the legacy XLS binary format, ODS (LibreOffice / OpenOffice) and plain CSV. SheetJS detects the format from the file contents, so an extension is not required.',
    },
    {
      q: 'Are my files uploaded?',
      a: 'No. The file is parsed and rendered entirely in your browser with SheetJS — the page never makes a network request.',
    },
    {
      q: 'My file is huge — will it freeze?',
      a: 'The grid preview is capped to the rows and columns you set (200 × 30 by default) so a million-row sheet still opens instantly. Converting to CSV, JSON or XLSX works on the full sheet in a background worker.',
    },
    {
      q: 'How is JSON exported?',
      a: 'Each data row becomes an object whose keys are the values in the first row of the sheet, so a sheet with a header row maps cleanly onto an array of objects.',
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
