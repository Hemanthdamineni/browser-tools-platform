import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'csv-to-yaml',
  name: 'CSV to YAML',
  category: 'data',
  summary: 'Convert a CSV table into block-style YAML with automatic type detection and quoting.',
  description:
    'Turn a CSV file into clean YAML in one step. The first row becomes the document keys (or you can disable the header), each subsequent row becomes a list item, and cell values are typed: integers stay numbers, decimals stay floats, true/false become booleans, empty cells become null, and everything else is emitted as a safely quoted string. Values and keys that would be ambiguous in YAML are quoted automatically, so the output parses exactly back to the table you started from. All conversion happens on your device.',
  keywords: [
    'csv to yaml',
    'csv yml',
    'convert csv to yaml',
    'spreadsheet to yaml',
    'csv to yaml converter',
    'csv yaml table',
    'yaml from csv',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      choices: [
        { value: ',', label: 'Comma (,)' },
        { value: ';', label: 'Semicolon (;)' },
        { value: '\t', label: 'Tab' },
        { value: '|', label: 'Pipe (|)' },
      ],
      default: ',',
    },
    {
      key: 'header',
      label: 'First row is the header',
      type: 'boolean',
      default: true,
    },
  ],
  examples: [
    {
      title: 'Products table',
      input: 'name,price,stock,live\n"Tea, green",12.5,3,true\nCoffee,8,0,false',
    },
    {
      title: 'Two-column list',
      input: 'key,value\nalpha,1\nbeta,true\n',
      options: { delimiter: ',' },
    },
    {
      title: 'Headerless semicolon export',
      input: 'alpha;1;true\nbeta;2;false',
      options: { delimiter: ';', header: false },
    },
  ],
  related: ['csv-to-json', 'json-to-yaml', 'csv-profiler', 'csv-to-markdown'],
  status: 'stable',
};
