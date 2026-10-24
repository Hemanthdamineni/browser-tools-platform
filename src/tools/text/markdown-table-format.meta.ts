import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'markdown-table-format',
  name: 'Markdown Table Formatter',
  category: 'text',
  summary:
    'Align the pipes in Markdown tables and preserve column alignment from the header divider.',
  description:
    'Align the columns of pasted Markdown tables so the pipes line up. Left, right and center alignment set in the divider row (---:,  :---: and :---) are preserved and the divider is regenerated to match. East Asian wide characters count as two columns so tables with CJK text still align, and lines that are not part of a table are left untouched.',
  keywords: [
    'markdown table format',
    'align markdown table',
    'table formatter',
    'md table align',
    'pipe alignment',
    'markdown table align',
    'markdown columns',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [],
  article: [
    {
      heading: 'What gets realigned',
      body: 'Paste a Markdown table and every row is re-padded so the pipes sit in one column. Each cell is measured by its display width, the widest value in a column sets the width, and one space is added either side of every pipe. Lines that are not part of a table pass through untouched.',
    },
    {
      heading: 'Alignment is read from the divider',
      body: 'The divider row decides each column: :--- is left, :---: is center and ---: is right. Existing markers survive and the divider is rebuilt for the new widths with the same colons, so a right-aligned numeric column stays right-aligned without any extra setting.',
    },
    {
      heading: 'Wide characters and escaped pipes',
      body: 'East Asian wide and full-width characters count as two columns, so tables that mix CJK text with Latin still line up in a monospaced view. A literal pipe inside a cell must be written as a backslash followed by |, and the formatter then treats it as content rather than a column break.',
    },
    {
      heading: 'What counts as a table here',
      body: 'A table begins at a line whose next line is a valid divider, such as |---|, |:--:| or | -: |, and ends at a blank line or the next divider. A block without that divider is copied verbatim, and the stats line reports how many tables were found and how many lines the output holds.',
    },
    {
      heading: 'Local string work, nothing uploaded',
      body: 'Measuring, padding and rebuilding the divider is ordinary string handling in this tab. No table is transmitted to any formatting service, and the tool keeps working offline.',
    },
  ],
  examples: [
    {
      title: 'Ragged table',
      input:
        '| Name | Age | City |\n| --- | ---: | --- |\n| Ada | 36 | London |\n| Grace | 40 | Brooklyn |',
    },
    {
      title: 'Numbers with right alignment',
      input: '| Item | Qty |\n| --- | ---: |\n| Widget | 12 |\n| Gadget | 3 |',
    },
    {
      title: 'Centered header with CJK text',
      input: '| 名前 | Note |\n| :---: | --- |\n| 山田 | first |',
    },
  ],
  faq: [
    {
      q: 'Does it preserve my column alignment?',
      a: 'Yes. Left, right and center alignment markers in the divider row (---:,  :---: and :---) are kept and the divider is regenerated with the same alignment.',
    },
    {
      q: 'How are wide CJK characters measured?',
      a: 'East Asian wide and full-width characters count as two columns, so pipes line up correctly in tables containing Chinese, Japanese or Korean text.',
    },
    {
      q: 'What about a pipe inside a cell?',
      a: 'Escape it as \\| inside the cell. An escaped pipe is treated as part of the cell content, not as a column separator.',
    },
  ],
  related: ['markdown-toc', 'markdown-to-html', 'csv-to-json', 'json-to-csv'],
  status: 'stable',
};
