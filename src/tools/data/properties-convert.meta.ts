import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'properties-convert',
  name: 'Properties Converter',
  category: 'data',
  summary: 'Convert Java .properties config to JSON or serialize JSON back to .properties.',
  description:
    'Read and write Java-style properties files in a structured JSON view. Parsing handles comments (# and !), the =, : and whitespace separators, backslash line continuations, escaped unicode (\\uXXXX) and escape sequences — producing a flat JSON object. The reverse direction serializes JSON objects to properties syntax with dotted keys and escaping, so config lives anywhere in a document and survives round-trips. Entirely on-device.',
  keywords: [
    'properties to json',
    'json to properties',
    'java properties',
    'properties file',
    'properties parser',
    '.properties',
    'application.properties',
    'config properties',
    'properties converter',
    'key value file',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      default: 'props-to-json',
      choices: [
        { value: 'props-to-json', label: 'Properties → JSON' },
        { value: 'json-to-props', label: 'JSON → Properties' },
      ],
    },
  ],
  examples: [
    {
      title: 'Parse a Spring application.properties',
      input:
        'server.port = 8080\napp.name = demo\napp.debug = true\n# install note\napp.path = C:\\\\apps\\\\demo',
      options: {},
    },
    {
      title: 'Serialize JSON to a properties file',
      input: '{"server.port": 8080, "app": {"name": "demo", "ssl": true}}',
      options: { mode: 'json-to-props' },
    },
    {
      title: 'Colons and escaped unicode',
      input: 'greeting: h\\u00e9llo\npath:C:\\\\tmp',
      options: {},
    },
  ],
  related: ['ini-convert', 'toml-convert', 'json-to-yaml', 'yaml-to-json', 'dotenv'],
  status: 'stable',
};
