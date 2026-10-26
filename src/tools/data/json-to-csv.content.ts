/**
 * Editorial content for the json-to-csv tool page.
 *
 * Kept out of ``json-to-csv.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
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
} as const;
