/**
 * Editorial content for the markdown-table-format tool page.
 *
 * Kept out of ``markdown-table-format.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
