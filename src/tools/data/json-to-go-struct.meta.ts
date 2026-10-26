import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'json-to-go-struct',
  name: 'JSON to Go Struct',
  category: 'data',
  summary:
    'Generate idiomatic Go structs with json tags from a JSON sample, ready for encoding/json round-trips.',
  description:
    'Paste any JSON object or array and get Go struct definitions with json tags that round-trip through encoding/json. Types are inferred: string, bool, int, float64, nested structs, slices, and interface{} with a comment when a value is null or mixed. Field names are Pascal-cased with common acronyms (ID, URL, API) kept uppercase.',
  keywords: [
    'json to go',
    'go struct generator',
    'golang struct',
    'json to golang',
    'go type',
    'encoding/json',
    'json tags',
    'struct definition',
    'go code generator',
    'json to go struct',
    'golang json unmarshal',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  options: [
    {
      key: 'rootName',
      label: 'Root struct name',
      type: 'text',
      default: 'MyStruct',
      placeholder: 'MyStruct',
    },
    {
      key: 'omitempty',
      label: 'Add omitempty to json tags',
      type: 'boolean',
      default: true,
    },
    {
      key: 'tags',
      label: 'JSON tags',
      type: 'select',
      default: 'json',
      choices: [
        { value: 'json', label: 'Include json tags' },
        { value: 'none', label: 'No tags' },
      ],
    },
  ],
  examples: [
    {
      title: 'Nested object with arrays',
      input:
        '{"name":"Ada","age":36,"active":true,"score":9.5,"address":{"city":"London","zip":"SW1"},"skills":["go","ts"],"tags":[]}',
      options: { rootName: 'User' },
    },
    {
      title: 'Array of objects',
      input: '[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]',
      options: { rootName: 'User' },
    },
    {
      title: 'Nulls and mixed types',
      input: '{"a":null,"b":[1,"two"],"c":{}}',
      options: { rootName: 'Mixed' },
    },
  ],
  related: ['json-to-typescript', 'json-to-yaml', 'json-format', 'yaml-to-json', 'csv-to-json'],
  status: 'stable',
};
