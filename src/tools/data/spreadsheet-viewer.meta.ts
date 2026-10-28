import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'spreadsheet-viewer',
  name: 'Spreadsheet Viewer',
  category: 'data',
  summary: 'Open xlsx/xls/ods/csv files; switch sheets; convert to CSV, JSON or XLSX.',
  description:
    'Drop any spreadsheet file (Excel, OpenDocument, CSV) and instantly switch between sheets. Convert the current sheet to CSV, JSON, or a new XLSX file. Everything runs on your device — nothing is uploaded.',
  keywords: [
    'spreadsheet',
    'xlsx',
    'xls',
    'ods',
    'csv',
    'sheetjs',
    'excel',
    'openoffice',
    'google sheets',
    'table',
    'data',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet,application/vnd.oasis.opendocument.spreadsheet-template,text/csv,text/tab-separated-values,.csv,.xlsx,.xls,.ods',
  options: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      default: 'csv',
      choices: [
        { value: 'csv', label: 'CSV (text)' },
        { value: 'json', label: 'JSON array' },
        { value: 'xlsx', label: 'XLSX (new file)' },
      ],
    },
    {
      key: 'sheet',
      label: 'Sheet name',
      type: 'select',
      default: 'auto',
      choices: [], // populated dynamically
    },
    {
      key: 'header',
      label: 'First row is header',
      type: 'boolean',
      default: true,
    },
    {
      key: 'outputName',
      label: 'Download filename (for XLSX)',
      type: 'text',
      default: 'spreadsheet.xlsx',
    },
  ],
  examples: [
    {
      title: 'Open Excel file and convert to CSV',
      input: 'test.xlsx',
    },
    {
      title: 'View ODS sheet',
      input: 'data.ods',
    },
  ],
  faq: [
    {
      q: 'What file formats are supported?',
      a: 'Excel (.xlsx, .xls), OpenDocument (.ods, .fods), and any CSV/TSV.',
    },
    {
      q: 'How do I switch sheets?',
      a: 'The UI shows a dropdown of all sheet names. Select the one you want to view/convert.',
    },
    {
      q: 'Is the file uploaded anywhere?',
      a: 'No. SheetJS runs entirely in your browser. The original file never leaves your device.',
    },
    {
      q: 'Can I convert back to XLSX?',
      a: 'Yes — choose "XLSX" output to get a brand-new spreadsheet file.',
    },
  ],
  related: [  "csv-to-json",
  "json-to-csv",
  "csv-sanitize"],
  status: 'stable',
  updated: '2026-10-26',
};
