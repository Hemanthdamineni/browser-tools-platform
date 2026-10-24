import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-transpose',
  name: 'CSV Transpose',
  category: 'data',
  summary: 'Swap CSV rows and columns while preserving quoted fields.',
  description:
    'Transpose comma-, semicolon-, tab-, or pipe-delimited data by swapping its rows and columns. Quoted fields, embedded delimiters, escaped quotes, and line breaks are preserved. Ragged rows are padded with empty cells. Processing stays on your device.',
  keywords: [
    'csv transpose',
    'transpose csv',
    'swap rows and columns',
    'rotate csv',
    'transpose tsv',
    'spreadsheet',
    'pivot rows columns',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'comma', label: 'Comma ( , )' },
        { value: 'semicolon', label: 'Semicolon ( ; )' },
        { value: 'tab', label: 'Tab' },
        { value: 'pipe', label: 'Pipe ( | )' },
      ],
    },
  ],
  examples: [
    { title: 'Swap rows and columns', input: 'name,age\nAda,36\nLinus,54' },
    {
      title: 'Quoted values and semicolons',
      input: 'item;note\nbook;"paper; bound"',
      options: { delimiter: 'semicolon' },
    },
    { title: 'Rotate a numeric grid', input: '1,2,3\n4,5,6' },
  ],
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
  related: ['csv-to-json', 'json-to-csv'],
  status: 'stable',
};
