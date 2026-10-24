import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-html-table',
  name: 'JSON to HTML Table',
  category: 'data',
  summary: 'Render a JSON array into an HTML table of rows and columns, with multi-level headers.',
  description:
    'Paste a JSON array of objects or an array of arrays and get a clean HTML <table>: one header row from the object keys (or the array values), one row per record, escaped cell text so the markup stays valid. Nested objects and arrays inside a cell are rendered as readable JSON, and null, booleans and numbers keep their JSON type so nothing is lossy. Works entirely on your device.',
  keywords: [
    'json to html table',
    'render json as table',
    'json table',
    'json to html',
    'table from json array',
    'json to grid',
    'export json to html table',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'theme',
      label: 'Style',
      type: 'select',
      choices: [
        { value: 'plain', label: 'Plain (no classes)' },
        { value: 'zebra', label: 'Zebra stripes' },
        { value: 'bordered', label: 'Bordered' },
      ],
      default: 'plain',
    },
    {
      key: 'nestedCells',
      label: 'Pretty-print nested values in cells',
      type: 'boolean',
      default: true,
    },
    {
      key: 'escape',
      label: 'Escape cell text',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Rows from objects',
      input:
        '[ { "name": "Ada", "role": "Admin", "active": true }, { "name": "Lin", "role": "Editor", "active": false } ]',
    },
    {
      title: 'Rows from arrays of arrays',
      input: '[[1, 2, 3], [4, 5, 6], [7, 8, 9]]',
    },
    {
      title: 'Zebra table with compact nested values',
      input: '[ { "id": 1, "tags": ["a", "b"] } ]',
      options: { theme: 'zebra', nestedCells: false },
    },
  ],
  faq: [
    {
      q: 'What input does it accept?',
      a: 'A JSON array. An array of objects uses the object keys as the header; an array of arrays uses the first row as the header (or numbers the columns when there is a single row). Numbers, booleans and null are preserved as their JSON values.',
    },
    {
      q: 'How are nested values handled?',
      a: 'Objects and arrays inside a cell are pretty-printed as JSON so nothing is lost, and cell text is HTML-escaped (with the option to disable it) so the table markup stays valid.',
    },
    {
      q: 'What does the Style option do?',
      a: 'It only adds a class attribute to the table element: plain leaves no class, zebra adds class "zebra" and bordered adds class "bordered". You supply the CSS that styles those classes.',
    },
  ],
  article: [
    {
      heading: 'Turning a JSON array into markup',
      body: 'Paste a JSON array and the tool returns an HTML table with a thead header row and a tbody of records. An array of objects takes its headers from the keys, collecting any key seen across the rows; an array of arrays uses the first row as the header, or numbers the columns when there is only one row, so a single record still renders sensibly.',
    },
    {
      heading: 'When a table beats a JSON blob',
      body: 'It helps when you want to preview API output, a config dump or a small dataset inside a document, a wiki page or an email and real table markup reads far better than a wall of braces.',
    },
    {
      heading: 'Styling and nested values',
      body: 'The style option adds no class, a zebra class or a bordered class to the table element, leaving the CSS to you. Pretty-print nested values keeps objects and arrays inside a cell indented as JSON; switching it off compacts them onto one line.',
    },
    {
      heading: 'Escaping and edge cases',
      body: 'Escaping is on by default, so angle brackets, ampersands and quotes in cell text become entities and the markup stays valid. Input must be a non-empty array and is capped at 1,000,000 characters; strings, numbers and booleans are written as they are, while null becomes an empty cell.',
    },
    {
      heading: 'Built in the page, never transmitted',
      body: 'The table is assembled in the browser from the text you paste, so your JSON is never uploaded and the tool works without a network connection.',
    },
  ],
  related: ['csv-to-html', 'json-format', 'csv-to-json', 'csv-profiler'],
  status: 'stable',
};
