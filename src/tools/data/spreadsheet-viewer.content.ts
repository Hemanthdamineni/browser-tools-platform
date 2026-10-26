/**
 * Editorial content for the spreadsheet-viewer tool page.
 *
 * Kept out of ``spreadsheet-viewer.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
