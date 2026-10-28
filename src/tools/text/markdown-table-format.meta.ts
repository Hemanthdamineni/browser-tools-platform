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
  examples: [
    {
      title: 'Ragged table',
      input:
        '| Name | Age | City |\n| --- | ---: | --- |\n| Ada | 36 | London |\n| Grace | 40 | Brooklyn |',
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
  related: [  "markdown-toc",
  "markdown-to-html",
  "csv-to-json",
  "json-to-csv"],
  status: 'stable',
};
