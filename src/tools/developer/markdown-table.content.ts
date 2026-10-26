/**
 * Editorial content for the markdown-table tool page.
 *
 * Kept out of ``markdown-table.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the Markdown Table Formatter does',
      body: 'Paste one pipe table and it normalises every row to the same column count, trims cell whitespace, rebuilds the separator from your alignment markers and pads cells to the widest content, outputting a GFM pipe table in the markdown language slot.',
    },
    {
      heading: 'When to format a table here',
      body: 'Reach for it when a pasted or generated table has ragged rows, uneven delimiters or missing padding and you want a clean, copy-ready pipe table without hand-counting spaces.',
    },
    {
      heading: 'The options that change the output',
      body: 'Align columns, on by default, re-emits the separator with the alignment markers each column implied. Cell padding accepts a whole number from 0 to 4 and adds that many spaces inside the vertical bars; turning alignment off keeps your literal row text but still normalises rows.',
    },
    {
      heading: 'Limits and what it does not parse',
      body: 'It handles up to 5,000 non-empty rows and 200 columns and raises an error beyond that. It is not a full Markdown parser: escaped pipes and pipes inside matched inline-code spans stay in the cell, but Markdown, HTML and multiline cell syntax are not evaluated.',
    },
    {
      heading: 'Where the formatting happens',
      body: 'The table is rebuilt on your device from the text you paste; nothing is uploaded.',
    },
  ],
  faq: [
    {
      q: 'Does this parse all Markdown table syntax?',
      a: 'No. It formats one pipe table. It preserves escaped pipes and pipes inside matched inline-code spans, but it does not evaluate Markdown, HTML, or multiline cell syntax.',
    },
    {
      q: 'What happens when rows have different cell counts?',
      a: 'Short rows are padded to the widest row. Rows with extra cells are preserved by expanding the table width.',
    },
    {
      q: 'Does alignment change cell content?',
      a: 'Only surrounding whitespace is trimmed. Content characters and backslash escapes are preserved; separator rows are rebuilt using Markdown alignment markers.',
    },
  ],
} as const;
