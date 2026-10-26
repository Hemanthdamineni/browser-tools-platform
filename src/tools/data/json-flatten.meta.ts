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
    {
      title: 'Flatten with bracket array paths',
      input: '{"a":{"b":[1,2,3]}}',
      options: { arrayStyle: 'bracket' },
    },
    {
      title: 'Flatten and sort alphabetically',
      input: '{"z":1,"a":{"y":2,"x":3}}',
      options: { sorted: true },
    },
  ],
  related: ['json-format', 'json-to-python', 'json-to-yaml', 'properties-convert'],
  status: 'stable',
};
