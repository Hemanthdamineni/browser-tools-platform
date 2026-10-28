import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-flatten',
  name: 'Flatten JSON',
  category: 'data',
  summary:
    'Flatten nested JSON to dotted keys (users.0.name) or collapse dotted keys back into nested JSON.',
  description:
    'Turn a nested JSON object into a flat record of dot notation paths, or do the reverse: paste flat dotted keys such as users.0.name and rebuild the nested structure. Arrays become indexed paths (users.0.role, or users[0].role), leaves keep their JSON types, and keys can be re-nested with unflatten mode. Everything runs on your device with no network.',
  keywords: [
    'flatten json',
    'unflatten json',
    'flatten nested json',
    'dot notation',
    'json to flat',
    'nested object flatten',
    'flatten json to key value',
    'expand dotted keys',
    'rebuild nested json',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'mode',
      label: 'Direction',
      type: 'select',
      choices: [
        { value: 'flatten', label: 'Flatten nested → dotted' },
        { value: 'unflatten', label: 'Rebuild dotted → nested' },
      ],
      default: 'flatten',
    },
    {
      key: 'arrayStyle',
      label: 'Array paths',
      type: 'select',
      choices: [
        { value: 'index', label: 'users.0.name' },
        { value: 'bracket', label: 'users[0].name' },
      ],
      default: 'index',
    },
    {
      key: 'sorted',
      label: 'Sort flattened keys',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    {
      title: 'Flatten a nested config',
      input:
        '{\n  "server": { "host": "localhost", "ports": { "http": 8080, "tls": 8443 } },\n  "users": [{ "name": "ada" }]\n}',
    },
    {
      title: 'Rebuild from dotted keys',
      input:
        '{\n  "server.host": "localhost",\n  "server.ports.http": 8080,\n  "users.0.name": "ada"\n}',
      options: { mode: 'unflatten' },
    },
  ],
  faq: [
    {
      q: 'How are arrays flattened?',
      a: 'Arrays become indexed paths: users.0.name. Switch the "Array paths" option to users[0].name if you prefer bracketed notation.',
    },
    {
      q: 'Can I get back to a nested object?',
      a: 'Yes — switch the direction to "Rebuild dotted". Paste a flat record and it is nested again, and types keep through the round trip.',
    },
    {
      q: 'What if dotted output and nested output conflict?',
      a: 'If a key is both a value and a container (a.b alongside a.b.c) unflatten refuses with a conflict error instead of guessing.',
    },
    {
      q: 'Does it preserve numbers, booleans and null?',
      a: 'Yes. Leaves are kept with their JSON types, and unflatten parses them back the same way they were given.',
    },
  ],
  related: [  "json-format",
  "json-to-python",
  "json-to-yaml",
  "properties-convert"],
  status: 'stable',
};
