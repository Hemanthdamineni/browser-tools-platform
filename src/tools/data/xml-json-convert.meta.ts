import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'xml-json-convert',
  name: 'XML ⇄ JSON Converter',
  category: 'data',
  summary: 'Convert XML documents into JSON and JSON back into XML.',
  description: 'Turn XML into JSON and back without uploading anything. XML to JSON produces a predictable structure: attributes become @-prefixed keys, repeated sibling elements become arrays, text content becomes #text when an element also has attributes or children, and comments/processing instructions are skipped. JSON to XML turns those same conventions back into well-formed, indented XML with proper escaping. Entity references, CDATA sections, self-closing tags and namespaces are supported.',
  keywords: ['XML to JSON', 'JSON to XML', 'xml2json', 'json2xml', 'convert XML', 'XML parser', 'XML attributes', 'CDATA', 'SOAP response', 'RSS feed'],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'xml-to-json', choices: [{ value: 'xml-to-json', label: 'XML → JSON' }, { value: 'json-to-xml', label: 'JSON → XML' }] },
    { key: 'attributes', label: 'Attributes', type: 'select', default: 'prefix', choices: [{ value: 'prefix', label: 'Prefix with @' }, { value: 'nest', label: 'Group under @attributes' }, { value: 'ignore', label: 'Ignore attributes' }] },
    { key: 'textKey', label: 'Text key', type: 'text', default: '#text' },
    { key: 'indent', label: 'Indent (spaces)', type: 'number', default: 2 },
  ],
  examples: [
    { title: 'XML to JSON', input: '<book id="1"><title>Dune</title><author>Herbert</author></book>' },
    { title: 'JSON to XML', input: '{"book":{"@id":"1","title":"Dune","author":"Herbert"}}', options: { mode: 'json-to-xml' } },
  ],
  faq: [
    { q: 'Is my XML uploaded?', a: 'No. Parsing and serialization run entirely inside your browser tab.' },
    { q: 'Why do repeated elements become arrays?', a: 'JSON objects cannot hold duplicate keys, so sibling elements sharing a name are collected into an array — a single occurrence stays a plain object or string.' },
    { q: 'Do comments survive a round trip?', a: 'No. Comments, processing instructions and DOCTYPE declarations are ignored; element data, attributes, text and CDATA content are preserved.' },
    { q: 'Are values converted to numbers or booleans?', a: 'Not by default — everything is kept as a string so the conversion is lossless. Numbers are only emitted when you convert a JSON document containing real numbers back to XML.' },
  ],
  related: ['xml-format', 'json-to-yaml', 'yaml-to-json', 'toml-convert'],
  status: 'stable',
};
