/**
 * Editorial content for the csv-transpose tool page.
 *
 * Kept out of ``csv-transpose.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Rows become columns',
      body: 'Paste delimited text and the tool returns it rotated: the first row turns into the first column and so on. Quoted fields may hold the delimiter, doubled quotes and line breaks, and every output value is re-quoted when it needs to be. The download is named transposed.csv.',
    },
    {
      heading: 'Reshaping a wide export',
      body: 'It is handy when a spreadsheet export comes out landscape with months across the top and you need a tall table instead. Paste the rows, transpose, and the headers land down the left edge in the order they appeared.',
    },
    {
      heading: 'Choosing or detecting the delimiter',
      body: 'The delimiter box offers comma, semicolon, tab and pipe, or auto-detect. Auto examines the first record only and picks whichever of the four appears most often outside quotes, breaking ties in favour of the comma.',
    },
    {
      heading: 'Ragged rows and broken quotes',
      body: 'Rows shorter than the widest one are padded with empty cells so the grid stays rectangular, and a trailing newline does not create a phantom row. A field whose opening quote is never closed stops the run with an error instead of guessing.',
    },
    {
      heading: 'Content stays on the device',
      body: 'Parsing, transposing and quoting all run locally in the page. The pasted data is not sent anywhere, and the tool works with the network switched off.',
    },
  ],
  faq: [
    {
      q: 'How are quoted fields handled?',
      a: 'Fields wrapped in double quotes can contain delimiters, quotes escaped as doubled quotes, and line breaks. Output fields are quoted as needed.',
    },
    {
      q: 'What happens when rows have different lengths?',
      a: 'Short rows are padded with empty fields to the widest row before transposing.',
    },
    {
      q: 'How does auto-detection work?',
      a: 'The first record is checked for comma, semicolon, tab, and pipe separators. The delimiter appearing most often is selected; ties favor comma.',
    },
  ],
} as const;
