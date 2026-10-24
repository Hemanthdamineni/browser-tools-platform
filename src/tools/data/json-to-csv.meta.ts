import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-csv',
  name: 'JSON to CSV',
  category: 'data',
  summary: 'Turn a JSON array of objects into CSV, with delimiter, header, and flatten options.',
  description:
    'Convert a JSON array of objects (or an array of arrays) into delimiter-separated text. Keys are unioned across every row, nested objects can be flattened to dotted columns, and fields are quoted per RFC 4180. Runs on your device.',
  keywords: [
    'json to csv',
    'json2csv',
    'convert json to csv',
    'csv',
    'tsv',
    'export json',
    'flatten json',
    'spreadsheet',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      default: 'comma',
      choices: [
        { value: 'comma', label: 'Comma ( , )' },
        { value: 'semicolon', label: 'Semicolon ( ; )' },
        { value: 'tab', label: 'Tab' },
        { value: 'pipe', label: 'Pipe ( | )' },
      ],
    },
    {
      key: 'header',
      label: 'Write header row',
      type: 'boolean',
      default: true,
    },
    {
      key: 'flatten',
      label: 'Flatten nested objects to dotted keys',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Array of objects',
      input: '[{ "name": "Ada", "role": "dev" }, { "name": "Linus", "role": "ops" }]',
    },
    {
      title: 'Flatten nested objects',
      input: '[{ "id": 1, "user": { "name": "Ada", "city": "London" } }]',
      options: { flatten: true },
    },
    {
      title: 'Semicolon, no header',
      input: '[{ "a": 1, "b": 2 }]',
      options: { delimiter: 'semicolon', header: false },
    },
  ],
  article: [
    {
      heading: 'From a JSON array to delimited rows',
      body: 'Paste an array of objects or an array of arrays and the tool emits delimiter-separated text. For objects the column set is the union of keys across every row in first-seen order, so a row missing a key simply gets an empty cell. The result downloads as data.csv.',
    },
    {
      heading: 'Feeding a spreadsheet from an API',
      body: 'When an API hands back a list of records and a colleague wants it in Excel, paste the JSON here and take the CSV straight into the spreadsheet. Values containing the delimiter, a quote or a line break are wrapped in quotes with inner quotes doubled.',
    },
    {
      heading: 'Flatten and header switches',
      body: 'Flatten, on by default, turns nested objects into dotted column names such as user.name; switch it off to keep the whole nested object as a JSON string in one cell. The header toggle writes or omits the key row, and the delimiter box chooses comma, semicolon, tab or pipe.',
    },
    {
      heading: 'What the converter refuses',
      body: 'A row that is a string, number or null is an error once the first element is an object. If the first element is an array instead, every row must be an array and the header and flatten settings are ignored. An empty array produces empty output.',
    },
    {
      heading: 'No data leaves the browser',
      body: 'Parsing and escaping happen entirely in the page. The JSON you paste is never uploaded, so records with personal fields can be converted without a trip through a server.',
    },
  ],
  faq: [
    {
      q: 'How are columns chosen?',
      a: 'The tool takes the union of keys across all rows, in first-seen order, so rows with missing keys get an empty cell.',
    },
    {
      q: 'When are fields quoted?',
      a: 'Only when a value contains the delimiter, a double quote, or a line break. Embedded quotes are doubled, per RFC 4180.',
    },
    {
      q: 'What if a row is not an object?',
      a: 'A row that is a string, number, or null raises an error. Use an array of arrays if you want positional columns.',
    },
  ],
  related: ['csv-to-json', 'json-to-yaml', 'yaml-to-json'],
  status: 'stable',
};
