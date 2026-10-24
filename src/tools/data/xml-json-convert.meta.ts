import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'xml-json-convert',
  name: 'XML ⇄ JSON Converter',
  category: 'data',
  summary: 'Convert XML documents into JSON and JSON back into XML.',
  description:
    'Turn XML into JSON and back without uploading anything. XML to JSON produces a predictable structure: attributes become @-prefixed keys, repeated sibling elements become arrays, text content becomes #text when an element also has attributes or children, and comments/processing instructions are skipped. JSON to XML turns those same conventions back into well-formed, indented XML with proper escaping. Entity references, CDATA sections, self-closing tags and namespaces are supported.',
  keywords: [
    'XML to JSON',
    'JSON to XML',
    'xml2json',
    'json2xml',
    'convert XML',
    'XML parser',
    'XML attributes',
    'CDATA',
    'SOAP response',
    'RSS feed',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'xml-to-json',
      choices: [
        { value: 'xml-to-json', label: 'XML → JSON' },
        { value: 'json-to-xml', label: 'JSON → XML' },
      ],
    },
    {
      key: 'attributes',
      label: 'Attributes',
      type: 'select',
      default: 'prefix',
      choices: [
        { value: 'prefix', label: 'Prefix with @' },
        { value: 'nest', label: 'Group under @attributes' },
        { value: 'ignore', label: 'Ignore attributes' },
      ],
    },
    { key: 'textKey', label: 'Text key', type: 'text', default: '#text' },
    { key: 'indent', label: 'Indent (spaces)', type: 'number', default: 2 },
  ],
  examples: [
    {
      title: 'XML to JSON',
      input: '<book id="1"><title>Dune</title><author>Herbert</author></book>',
    },
    {
      title: 'JSON to XML',
      input: '{"book":{"@id":"1","title":"Dune","author":"Herbert"}}',
      options: { mode: 'json-to-xml' },
    },
    {
      title: 'Pull only the text, ignoring attributes',
      input: '<book id="1"><title>Dune</title><author>Herbert</author></book>',
      options: { attributes: 'ignore' },
    },
  ],
  faq: [
    {
      q: 'Is my XML uploaded?',
      a: 'No. Parsing and serialization run entirely inside your browser tab.',
    },
    {
      q: 'Why do repeated elements become arrays?',
      a: 'JSON objects cannot hold duplicate keys, so sibling elements sharing a name are collected into an array — a single occurrence stays a plain object or string.',
    },
    {
      q: 'Do comments survive a round trip?',
      a: 'No. Comments, processing instructions and DOCTYPE declarations are ignored; element data, attributes, text and CDATA content are preserved.',
    },
    {
      q: 'Are values converted to numbers or booleans?',
      a: 'Not by default — everything is kept as a string so the conversion is lossless. Numbers are only emitted when you convert a JSON document containing real numbers back to XML.',
    },
  ],
  article: [
    {
      heading: 'Two directions, one set of conventions',
      body: 'XML to JSON reads a document and returns an object whose single key is the root element name, with the element’s contents nested beneath it; the download is named after that root, for example catalog.json. JSON to XML goes the other way and insists on a single root key — that key becomes the root element and the object inside it becomes its contents — then prepends an XML declaration and writes a file named after the root. The pairing means a document can be round-tripped through JSON and back.',
    },
    {
      heading: 'Where attributes and text end up',
      body: 'Attributes have three treatments. The default prefix mode gives each one an at-prefixed sibling key, so id="1" becomes "@id": "1". The nest mode collects them into a single @attributes object, which keeps element names uncluttered. The ignore mode drops them entirely when you only care about content. Text content goes under the configured text key, #text unless you rename it, and only when the element also carries attributes or children — a plain element with only text becomes a simple string value.',
    },
    {
      heading: 'Repeated elements and JSON shapes',
      body: 'XML happily repeats a sibling element, but a JSON object cannot hold two keys with the same name, so the reader collects repeats into an array and leaves a single occurrence as a plain value. Writing back applies the same rule in reverse: a JSON array becomes the element repeated once per item, an empty array or null becomes a self-closing tag, and a non-object value becomes the element’s text. Attribute keys may also be written as @name or inside an @attributes object; either is accepted.',
    },
    {
      heading: 'What is lost, what is not, and privacy',
      body: 'Comments, processing instructions and DOCTYPE declarations are skipped on the way in, so they do not survive a round trip. Values are deliberately left as strings rather than coerced to numbers or booleans, which keeps the conversion lossless; numeric types only appear when you convert real JSON numbers back to XML. Indentation is clamped between 0 and 8 spaces, and attribute names that are not valid XML names are rejected with an error rather than emitted broken. Parsing and serialisation run entirely in the tab — your XML is never uploaded.',
    },
  ],
  related: ['xml-format', 'json-to-yaml', 'yaml-to-json', 'toml-convert'],
  status: 'stable',
};
