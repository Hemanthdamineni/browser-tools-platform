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
  article: [
    {
      heading: 'Properties in, JSON out',
      body: 'In the default direction the tool reads a Java properties file and returns one flat JSON object. Each value comes back as a string, because properties files carry no types. Comments starting with # or ! and blank lines are dropped, and a key ends at the first unescaped =, : or whitespace.',
    },
    {
      heading: 'JSON out to dotted keys',
      body: 'Switch the direction box to JSON to Properties and a JSON object is flattened into dotted keys: app.port, items.0, items.1 and so on, with arrays becoming numbered keys and empty objects written as blank values. Key order is preserved as authored.',
    },
    {
      heading: 'Continuing a Spring config file',
      body: 'A frequent job is turning application.properties into JSON so it can be diffed, checked or fed to a script. Backslash line continuations are joined before parsing, and escapes such as \\n, \\t, \\\\ and \\uXXXX are decoded back into real characters.',
    },
    {
      heading: 'Duplicate keys and escaping outbound',
      body: 'The parser follows Java semantics: when a key appears more than once the last value wins. Serializing escapes backslashes, newlines, tabs and any non-ASCII character, writing the latter as \\uXXXX so the output stays readable in any editor.',
    },
    {
      heading: 'Config never leaves the page',
      body: 'Reading and writing properties happen locally in the tab. Nothing is posted to a server and the tool runs offline, which matters when a config file holds credentials or internal host names.',
    },
  ],
  faq: [
    {
      q: 'Which comment and separator styles are supported?',
      a: 'Lines beginning with # or ! are skipped as comments, and blank lines are ignored. Keys end at the first unescaped =, : , or whitespace, matching Java properties rules.',
    },
    {
      q: 'Are multiline values supported?',
      a: 'Yes. A trailing backslash continues the value onto the next line, and escaped sequences like \\n, \\t, \\\\ and \\uXXXX are decoded into their real characters during parsing.',
    },
    {
      q: 'How does JSON to properties handle nested objects?',
      a: 'Objects are flattened with dotted keys (app.port → app.port), arrays become repeated numbered keys (items.0 = ...), and primitives are written as strings with escaping. Key order is preserved.',
    },
    {
      q: 'How are duplicate keys handled?',
      a: 'Pursuant to Java properties semantics, the last occurrence of a key wins during parsing. When generating, keys are written once.',
    },
  ],
  related: ['ini-convert', 'toml-convert', 'json-to-yaml', 'yaml-to-json', 'dotenv'],
  status: 'stable',
};
