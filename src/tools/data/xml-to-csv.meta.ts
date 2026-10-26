import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'xml-to-csv',
  name: 'XML to CSV',
  category: 'data',
  summary:
    'Flatten repeated XML elements into a CSV table, with attributes and nested values as columns.',
  description:
    'Turn an XML document into a CSV table of its records. The tool finds the repeated element that represents a row — or you name it yourself — then flattens each record into columns: attributes become @name columns, nested elements join with dots, and repeated values are written as JSON. Column order follows first appearance and every row is padded, so the output opens cleanly in any spreadsheet. Everything is converted on your device.',
  keywords: [
    'xml to csv',
    'convert xml to csv',
    'xml table converter',
    'xml records to csv',
    'flatten xml',
    'xml spreadsheet',
    'xml attributes to columns',
    'xml to excel',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'recordPath',
      label: 'Record element (optional)',
      type: 'text',
      default: '',
      placeholder: 'e.g. book or catalog.book',
    },
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      choices: [
        { value: 'comma', label: 'Comma ( , )' },
        { value: 'semicolon', label: 'Semicolon ( ; )' },
        { value: 'tab', label: 'Tab' },
        { value: 'pipe', label: 'Pipe ( | )' },
      ],
      default: 'comma',
    },
    {
      key: 'header',
      label: 'Include header row',
      type: 'boolean',
      default: true,
    },
    {
      key: 'includeAttributes',
      label: 'Include XML attributes',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Repeated records, auto-detected',
      input:
        '<catalog>\n  <book id="1"><title>Dune</title><price>9.99</price></book>\n  <book id="2"><title>Neuromancer</title><price>12.50</price></book>\n</catalog>',
    },
    {
      title: 'Nested elements and a named record path',
      input:
        '<feed><entry><author><name>Ada</name></author><title>Hello</title></entry><entry><author><name>Bob</name></author><title>World</title></entry></feed>',
      options: { recordPath: 'feed.entry' },
    },
    {
      title: 'Attributes and text in one record',
      input:
        '<products><product id="A1" price="9.99"><name>Dune</name></product><product id="B2" price="12.50"><name>It</name></product></products>',
      options: { delimiter: 'semicolon', includeAttributes: true },
    },
  ],
  related: ['xml-json-convert', 'csv-to-json', 'json-to-csv', 'csv-profiler'],
  status: 'stable',
};
